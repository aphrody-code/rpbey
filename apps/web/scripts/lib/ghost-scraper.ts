#!/usr/bin/env bun
/**
 * Fondation de scraping bxc — sur mesure pour les sources rpbey.
 *
 * Bâtie sur l'API unifiée du package **`@aphrody/bxc`** (`Browser.newPage`),
 * pas sur des chemins de source absolus. Un seul point d'entrée `fetchSource`
 * choisit le profil bxc adapté :
 *   - `static`  : DOM zigquery (SSR/HTML statique, 0 JS) — le plus rapide
 *   - `http`    : curl-impersonate (TLS-fingerprint Chrome) — JSON APIs, Shopify, Challonge
 *   - `fast`    : moteur bxc (vrai Chrome CDP via Lightpanda) — SPA / JS rendu
 *   - `stealth` : moteur bxc + anti-détection — sites anti-bot
 * `cookies` (jar JSON Playwright/CDP/Netscape) permet de rejouer une clearance
 * Cloudflare/Vercel. Puis : extraction cheerio, **validation Zod** contre le type
 * attendu par l'API/DB, et écriture **non-destructive** (jamais d'écrasement par du vide).
 *
 * curl-impersonate (`http`) n'a PAS de proxy ; pour contourner un blocage IP,
 * utiliser `fast`/`stealth` (le moteur accepte un proxy) ou un jar de clearance. Bun only.
 */
import { Browser } from "@aphrody/bxc/browser";
import * as cheerio from "cheerio";
import { z } from "zod";

import { homedir } from "node:os";
import { join } from "node:path";

// Moteur natif compilé (profils fast/stealth) — pointé via spawnOpts.binaryPath.
const home = process.env.HOME || homedir();
const ENGINE_BIN =
  process.env.BXC_ENGINE_BIN ?? join(home, "bxc/rust-bridge/target/release/bxc-engine");
if (!process.env.BXC_CHROME_BIN) process.env.BXC_CHROME_BIN = "/usr/local/bin/chromium";

export type Profile = "static" | "http" | "fast" | "stealth";

export interface FetchOptions {
  profile?: Profile;
  /** Fingerprint curl-impersonate (profil http), ex. "chrome131". */
  impersonate?: string;
  /** Chemin d'un jar de cookies JSON (clearance CF/Vercel, session). */
  cookies?: string;
  /** Attente post-navigation (hydratation JS) pour fast/stealth. */
  settleMs?: number;
  retries?: number;
  navTimeoutMs?: number;
  /** Taille minimale d'HTML pour valider la page (anti page-challenge/blocage). */
  minHtmlLength?: number;
  /** Override du binaire moteur (fast/stealth). */
  engineBin?: string;
}

export interface FetchResult {
  html: string;
  title: string;
  status: number;
  url: string;
}

const DEFAULTS = {
  profile: "http" as Profile,
  navTimeoutMs: 30_000,
  settleMs: 3_500,
  retries: 2,
  minHtmlLength: 800,
};

// Marqueurs de page-challenge anti-bot (CF/Vercel). Une telle page renvoie 200 +
// un HTML volumineux → passe le seuil minHtmlLength : il faut la détecter par
// contenu, sinon on valide un blocage comme une réussite (faux positif).
const CHALLENGE_MARKERS = [
  "just a moment",
  "vercel security checkpoint",
  "attention required! | cloudflare",
  "checking your browser before",
  "enable javascript and cookies to continue",
  "cf-browser-verification",
  "__cf_chl_",
  "challenge-platform",
  "/cdn-cgi/challenge-platform",
];

/** Détecte une page-challenge (titre court + marqueur connu) malgré un 200 et un gros HTML. */
function isChallengePage(html: string, title: string): boolean {
  const t = title.toLowerCase();
  const head = html.slice(0, 4_000).toLowerCase();
  return CHALLENGE_MARKERS.some((m) => t.includes(m) || head.includes(m));
}

async function fetchOnce(url: string, o: FetchOptions): Promise<FetchResult | null> {
  const profile = o.profile ?? DEFAULTS.profile;
  const needsEngine = profile === "fast" || profile === "stealth";
  const page = await Browser.newPage({
    profile,
    cookies: o.cookies,
    httpOpts:
      profile === "http"
        ? {
            profile: (o.impersonate ?? "chrome131") as never,
            timeoutMs: o.navTimeoutMs,
          }
        : undefined,
    spawnOpts: needsEngine ? { binaryPath: o.engineBin ?? ENGINE_BIN } : undefined,
  });
  try {
    const nav = await page.goto(url, {
      timeoutMs: o.navTimeoutMs ?? DEFAULTS.navTimeoutMs,
    });
    if (needsEngine) await Bun.sleep(o.settleMs ?? DEFAULTS.settleMs);
    const html = await page.content();
    const title = await page.title().catch(() => "");
    return { html, title, status: nav?.status ?? 200, url };
  } catch {
    return null;
  } finally {
    await page.close?.();
  }
}

/** Récupère une URL (profil bxc au choix) avec retries + seuil de taille HTML. */
export async function fetchSource(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchResult | null> {
  const retries = opts.retries ?? DEFAULTS.retries;
  const minLen = opts.minHtmlLength ?? DEFAULTS.minHtmlLength;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetchOnce(url, opts);
    if (res && isChallengePage(res.html, res.title)) {
      console.warn(
        `  ⚠ page-challenge anti-bot détectée (« ${res.title.slice(0, 40)} ») : ${url} — contournement requis (cookies clearance / proxy résidentiel).`,
      );
      if (attempt < retries) await Bun.sleep(2_000);
      continue;
    }
    if (res && res.status >= 200 && res.status < 400 && res.html.length >= minLen) {
      console.log(`  [${res.status}] ${res.html.length}o « ${res.title.slice(0, 50)} » <- ${url}`);
      return res;
    }
    console.warn(
      `  tentative ${attempt}/${retries} (${res?.status ?? "no-res"}, ${res?.html.length ?? 0}o) : ${url}`,
    );
    if (attempt < retries) await Bun.sleep(2_000);
  }
  return null;
}

/** Libère le navigateur singleton bxc (à appeler en fin de script). */
export async function closeBrowser(): Promise<void> {
  await Browser.close?.();
}

export interface ValidationReport<T> {
  valid: T[];
  invalid: number;
  errors: string[];
}

/** Valide chaque enregistrement brut contre le schéma Zod attendu (API/DB). */
export function validateRecords<T>(raw: unknown[], schema: z.ZodType<T>): ValidationReport<T> {
  const valid: T[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = schema.safeParse(raw[i]);
    if (r.success) valid.push(r.data);
    else if (errors.length < 5) errors.push(`#${i}: ${z.prettifyError(r.error).split("\n")[0]}`);
  }
  return { valid, invalid: raw.length - valid.length, errors };
}

/**
 * Écriture NON-DESTRUCTIVE + atomique : refuse d'écraser une sortie existante
 * par un payload vide (0 enregistrement) — un blocage scraper ne détruit pas les données.
 */
export async function writeIfNonEmpty(
  path: string,
  payload: unknown,
  count: number,
): Promise<boolean> {
  if (count <= 0) {
    console.error(`  ✗ 0 enregistrement → ${path} PRÉSERVÉ (non-destructif).`);
    return false;
  }
  const tmp = `${path}.tmp`;
  await Bun.write(tmp, JSON.stringify(payload, null, 2));
  await Bun.write(path, Bun.file(tmp));
  await Bun.file(tmp)
    .unlink?.()
    .catch(() => {});
  console.log(`  ✓ ${count} enregistrement(s) → ${path}`);
  return true;
}

export interface ScrapeTypedConfig<T> {
  url: string;
  schema: z.ZodType<T>;
  /** Extraction propre au site (cheerio) → tableau d'objets bruts. */
  extract: (ctx: { $: cheerio.CheerioAPI; html: string; title: string }) => unknown[];
  fetch?: FetchOptions;
}

/** Pipeline : fetch → extract (cheerio) → validate Zod → enregistrements valides typés. */
export async function scrapeTyped<T>(
  cfg: ScrapeTypedConfig<T>,
): Promise<ValidationReport<T> | null> {
  const res = await fetchSource(cfg.url, cfg.fetch);
  if (!res) return null;
  const $ = cheerio.load(res.html);
  const raw = cfg.extract({ $, html: res.html, title: res.title });
  const report = validateRecords(raw, cfg.schema);
  if (report.invalid > 0) {
    console.warn(`  ⚠ ${report.invalid} rejeté(s) par le schéma : ${report.errors.join(" · ")}`);
  }
  return report;
}
