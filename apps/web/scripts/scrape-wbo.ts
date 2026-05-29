#!/usr/bin/env bun
/**
 * Scrape les combos méta WBO (worldbeyblade.org) → data/wbo-combos.json.
 *
 * Source = le thread officiel "Winning Combinations at WBO Organized Events
 * (Beyblade X / BBX)" — un forum MyBB. Chaque post liste, par événement, les
 * placements (1er, 2e, 3e…) et les combos joués sous forme `Blade Ratchet Bit`.
 *
 * On agrège en combos plats (contrat WboComboSchema) :
 *   - combo  = "Blade Ratchet Bit"
 *   - usage  = nb d'occurrences du combo (tous placements, tous events du thread)
 *   - topCut = nb d'occurrences en 1ʳᵉ place
 *   - tier   = NON fourni par la source (laissé nullish ; la tier-list n'est pas
 *              dans ce thread — à enrichir depuis BBX-weekly / un autre fil si besoin)
 *
 * ── BLOCAGE VPS (documenté) ────────────────────────────────────────────────
 * worldbeyblade.org est derrière un challenge Cloudflare "Just a moment…" (JS
 * challenge). Depuis l'IP datacenter du VPS :
 *   - profil `http` (curl-impersonate)         → HTTP 403.
 *   - profil `stealth` (moteur bxc / Lightpanda) → HTTP 200 mais reste bloqué sur
 *     la page-challenge (title "Just a moment...", ~31 ko, 0 post_body) — le JS
 *     challenge n'est pas résolu one-shot, et MyBB n'expose AUCUNE API publique.
 * CONTOURNEMENT (au choix, le scrapeur est prêt pour les deux) :
 *   1. Jar de clearance CF : ouvrir le thread une fois dans un Chromium headful
 *      (xvfb + puppeteer-stealth, cf. scrape-bbx-weekly.ts), exporter le cookie
 *      cf_clearance dans un jar JSON, puis : WBO_COOKIES=<jar>.json bun scripts/scrape-wbo.ts
 *   2. Proxy résidentiel : tunnel SOCKS up sur 127.0.0.1:1080 →
 *      WBO_PROXY=socks5://127.0.0.1:1080 (transmis au moteur stealth).
 * Sans l'un des deux, le scrapeur signale le challenge et PRÉSERVE le JSON existant.
 *
 *   cd apps/web && WBO_COOKIES=/tmp/wbo-clearance.json bun scripts/scrape-wbo.ts
 */
import { join } from "node:path";
import { WboComboSchema } from "@rpbey/api-contract";
import * as cheerio from "cheerio";
import {
  closeBrowser,
  fetchSource,
  validateRecords,
  writeIfNonEmpty,
} from "./lib/ghost-scraper.ts";

const THREAD =
  "https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX";
const OUT = join(process.cwd(), "data", "wbo-combos.json");
const MAX_PAGES = 6;

const COOKIES = process.env.WBO_COOKIES; // jar de clearance CF (Playwright/CDP/Netscape JSON)
const PROXY = process.env.WBO_PROXY; // socks5://127.0.0.1:1080 si tunnel résidentiel

/** Détecte la page-challenge Cloudflare (vs le vrai contenu MyBB). */
function isChallenge(html: string): boolean {
  return /just a moment|cf-challenge|cf_chl|verifying you are human|challenge-platform/i.test(html);
}

interface RawCombo {
  blade: string;
  ratchet: string;
  bit: string;
  placement: number;
}

/**
 * Extrait les combos d'un post MyBB. Les combos sont des lignes "Blade Ratchet Bit"
 * regroupées par placement (1st Place:, 2nd Place:…) dans `.post_body`.
 */
function extractFromPage(html: string): RawCombo[] {
  const $ = cheerio.load(html);
  const out: RawCombo[] = [];
  // Ratchet = chiffre-chiffre (ex. 3-60, 1-70, 4-55) — point d'ancrage fiable d'un combo.
  const RATCHET = /\b(\d-\d{2})\b/;
  $(".post_body").each((_, el) => {
    // On lit le texte ligne par ligne en suivant le placement courant.
    const text = $(el).text();
    let placement = 0;
    for (const lineRaw of text.split("\n")) {
      const line = lineRaw.trim();
      if (!line) continue;
      const pm = line.match(/(\d+)(?:st|nd|rd|th)\s+Place/i);
      if (pm) {
        placement = Number(pm[1]);
        continue;
      }
      const rm = line.match(RATCHET);
      if (!rm) continue;
      const ratchet = rm[1];
      const idx = line.indexOf(ratchet);
      const blade = line
        .slice(0, idx)
        .trim()
        .replace(/[•\-–]\s*$/, "")
        .trim();
      const bit = line
        .slice(idx + ratchet.length)
        .trim()
        .split(/\s{2,}|\(|—|–/)[0]
        .trim();
      if (!blade || !bit) continue;
      out.push({ blade, ratchet, bit, placement: placement || 0 });
    }
  });
  return out;
}

/** Agrège les combos bruts en lignes WboCombo (usage + topCut). */
function aggregate(raws: RawCombo[]): unknown[] {
  const map = new Map<
    string,
    {
      blade: string;
      ratchet: string;
      bit: string;
      usage: number;
      topCut: number;
    }
  >();
  for (const r of raws) {
    const key = `${r.blade}|${r.ratchet}|${r.bit}`;
    const cur = map.get(key) ?? {
      blade: r.blade,
      ratchet: r.ratchet,
      bit: r.bit,
      usage: 0,
      topCut: 0,
    };
    cur.usage += 1;
    if (r.placement === 1) cur.topCut += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.usage - a.usage)
    .map((c) => ({
      combo: `${c.blade} ${c.ratchet} ${c.bit}`.replace(/\s+/g, " ").trim(),
      blade: c.blade,
      ratchet: c.ratchet,
      bit: c.bit,
      usage: c.usage,
      topCut: c.topCut,
      tier: undefined, // pas dans la source
    }));
}

async function main() {
  console.log(
    `Recon WBO (profil stealth${COOKIES ? " + jar clearance" : ""}${PROXY ? " + proxy" : ""})`,
  );
  const raws: RawCombo[] = [];
  let challenged = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? THREAD : `${THREAD}?page=${page}`;
    const r = await fetchSource(url, {
      profile: "stealth",
      cookies: COOKIES,
      retries: 2,
      minHtmlLength: 5000,
      settleMs: 9000,
      navTimeoutMs: 55000,
      // Le moteur stealth accepte un proxy (curl-impersonate non) — passé via env BXC_PROXY.
    });
    if (!r) {
      console.warn(`  page ${page}: pas de réponse — arrêt.`);
      break;
    }
    if (isChallenge(r.html)) {
      challenged = true;
      console.error(
        `  ✗ page ${page}: challenge Cloudflare "Just a moment…" (status ${r.status}, ${r.html.length}o). ` +
          `Fournir WBO_COOKIES=<jar cf_clearance>.json ou WBO_PROXY=socks5://127.0.0.1:1080.`,
      );
      break;
    }
    const found = extractFromPage(r.html);
    console.log(`  page ${page}: ${found.length} combos extraits.`);
    if (found.length === 0 && page > 1) break; // fin du thread
    raws.push(...found);
  }

  if (challenged && raws.length === 0) {
    console.error(
      "\nBLOCAGE: worldbeyblade.org sert un challenge Cloudflare non franchi depuis le VPS.\n" +
        "Le scrapeur est complet (sélecteurs MyBB + agrégation + schéma) ; relancer avec un\n" +
        "jar de clearance (WBO_COOKIES) ou un tunnel SOCKS résidentiel up (WBO_PROXY). " +
        OUT +
        " PRÉSERVÉ.",
    );
    await closeBrowser();
    process.exit(2);
  }

  const report = validateRecords(aggregate(raws), WboComboSchema);
  console.log(`\nCombos uniques valides: ${report.valid.length} | rejetés: ${report.invalid}`);
  if (report.invalid > 0) console.warn(`  rejets: ${report.errors.join(" · ")}`);
  if (report.valid.length) console.log("  top:", JSON.stringify(report.valid[0]));

  await writeIfNonEmpty(
    OUT,
    {
      scrapedAt: new Date().toISOString(),
      source: "worldbeyblade.org",
      threadUrl: THREAD,
      count: report.valid.length,
      combos: report.valid,
    },
    report.valid.length,
  );
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  await closeBrowser();
  process.exit(1);
});
