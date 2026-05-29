#!/usr/bin/env bun
/**
 * Scrape les FRAMES d'anime Beyblade depuis beyblade.fandom.com (MediaWiki API)
 * → data/anime-frames/<slug>.json. C'est la source de captures pour TOUTES les
 * générations SAUF Beyblade X (qui vient de fancaps, cf. scrape-anime-frames.ts).
 *
 * Recon (2026-05-29, profil `static` = DOM zigquery 0-JS ; le profil `http`
 * curl-impersonate renvoie null sur fandom depuis l'IP datacenter du VPS) :
 *
 *   - fancaps.net n'a QUE Beyblade X (re-vérifié : showList.php?b → 1 seule série,
 *     search.php → HTTP 500). Donc pour les autres saisons on passe par Fandom.
 *   - beyblade.fandom.com = wiki canonique (85 573 fichiers, couvre toutes les
 *     générations). beyblade-burst.fandom.com est quasi vide (3 fichiers) → ignoré.
 *   - Les VRAIES captures HQ frame-par-frame vivent sur les PAGES D'ÉPISODE
 *     (`<Série> - Episode NN`). Via `generator=images` + `imageinfo`, on récupère
 *     les fichiers liés ; on filtre les captures (jpeg, largeur ≥ 800) et on écarte
 *     logos/title cards (heuristique de nom). Chaque capture est en 1280x720 (720p)
 *     ou plus pour Metal Fusion ; title cards souvent 1920x1080.
 *   - Les images static.wikia.nocookie.net sont fetchables DIRECTEMENT depuis le
 *     VPS (200) → l'import les re-hébergera sans proxy. sourceId = `<wiki>:<pageid>`
 *     (id de fichier MediaWiki, stable). thumbUrl = thumb 360px (iiurlwidth).
 *
 *   Couverture HQ réelle (caps/ep, échantillon 4 épisodes/série) :
 *     metal-fusion ~40-88 · beyblade-2000 ~25 (10 eps listés) · metal-fury ~5 ·
 *     reste (masters, shogun, v-force, g-rev, tous les Burst) ~0-1 → surtout des
 *     title cards. Les saisons riches sont donc metal-fusion et bakuten/2000.
 *
 * Sortie NON-DESTRUCTIVE (writeIfNonEmpty). Aucune image téléchargée ici.
 *
 *   cd apps/web && bun scripts/scrape-fandom-frames.ts <series-slug> [--max-eps N]
 *   ex.                  bun scripts/scrape-fandom-frames.ts metal-fight-beyblade
 */
import { join } from "node:path";
import { AnimeFrameImportSchema, type AnimeFrameImport } from "@rpbey/api-contract";
import {
  closeBrowser,
  fetchSource,
  validateRecords,
  writeIfNonEmpty,
} from "./lib/ghost-scraper.ts";

const API = "https://beyblade.fandom.com/api.php";
const WIKI = "beyblade"; // préfixe de sourceId (un seul wiki canonique)
const OUT_DIR = join(process.cwd(), "data", "anime-frames");
const THUMB_W = 360;
const THROTTLE_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Generation = "ORIGINAL" | "METAL" | "BURST" | "X";

/**
 * Slug DB → config Fandom. `episodeCategory` = catégorie MediaWiki des pages
 * d'épisode ; `episodeRe` extrait le numéro d'épisode depuis le titre de page.
 */
const SERIES: Record<
  string,
  {
    label: string;
    generation: Generation;
    episodeCategory: string;
    episodeRe: RegExp;
  }
> = {
  "bakuten-shoot-beyblade": {
    label: "Bakuten Shoot Beyblade",
    generation: "ORIGINAL",
    episodeCategory: "Category:Beyblade: 2000 episodes",
    episodeRe: /Beyblade - Episode\s+(\d+)/i,
  },
  "beyblade-v-force": {
    label: "Beyblade V-Force",
    generation: "ORIGINAL",
    episodeCategory: "Category:Beyblade: V-Force episodes",
    episodeRe: /V-?Force - Episode\s+(\d+)/i,
  },
  "beyblade-g-revolution": {
    label: "Beyblade G-Revolution",
    generation: "ORIGINAL",
    episodeCategory: "Category:Beyblade: G-Revolution episodes",
    episodeRe: /G-Revolution - Episode\s+(\d+)/i,
  },
  "metal-fight-beyblade": {
    label: "Metal Fight Beyblade",
    generation: "METAL",
    episodeCategory: "Category:Beyblade: Metal Fusion episodes",
    episodeRe: /Metal Fusion - Episode\s+(\d+)/i,
  },
  "metal-fight-beyblade-baku": {
    label: "Metal Fight Beyblade: Baku",
    generation: "METAL",
    episodeCategory: "Category:Beyblade: Metal Masters episodes",
    episodeRe: /Metal Masters - Episode\s+(\d+)/i,
  },
  "metal-fight-beyblade-4d": {
    label: "Metal Fight Beyblade 4D",
    generation: "METAL",
    episodeCategory: "Category:Beyblade: Metal Fury episodes",
    episodeRe: /Metal Fury - Episode\s+(\d+)/i,
  },
  "beyblade-shogun-steel": {
    label: "Beyblade: Shogun Steel",
    generation: "METAL",
    episodeCategory: "Category:Beyblade: Shogun Steel episodes",
    episodeRe: /Shogun Steel - Episode\s+(\d+)/i,
  },
  "beyblade-burst": {
    label: "Beyblade Burst",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst (anime) episodes",
    episodeRe: /Beyblade Burst - Episode\s+(\d+)/i,
  },
  "beyblade-burst-god": {
    label: "Beyblade Burst God",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst Evolution episodes",
    episodeRe: /Evolution - Episode\s+(\d+)/i,
  },
  "beyblade-burst-chouzetsu": {
    label: "Beyblade Burst Chouzetsu",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst Turbo episodes",
    episodeRe: /Turbo - Episode\s+(\d+)/i,
  },
  "beyblade-burst-gt": {
    label: "Beyblade Burst GT",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst Rise episodes",
    episodeRe: /Rise - Episode\s+(\d+)/i,
  },
  "beyblade-burst-superking": {
    label: "Beyblade Burst Superking",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst Surge episodes",
    episodeRe: /Surge - Episode\s+(\d+)/i,
  },
  "beyblade-burst-db": {
    label: "Beyblade Burst Dynamite Battle",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst QuadDrive episodes",
    episodeRe: /QuadDrive - Episode\s+(\d+)/i,
  },
  "beyblade-burst-quadstrike": {
    label: "Beyblade Burst QuadStrike",
    generation: "BURST",
    episodeCategory: "Category:Beyblade Burst QuadStrike episodes",
    episodeRe: /QuadStrike - Episode\s+(\d+)/i,
  },
};

interface Args {
  slug: string;
  maxEps: number;
}
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith("--")) ?? "";
  const i = argv.indexOf("--max-eps");
  const maxEps = i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : Infinity;
  return { slug, maxEps };
}

async function apiJson(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  const r = await fetchSource(`${API}?${qs}`, { profile: "static", retries: 4, minHtmlLength: 5 });
  if (!r) throw new Error(`API MediaWiki injoignable (${qs.slice(0, 70)})`);
  const body = r.html.includes("<pre>")
    ? (r.html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? r.html)
    : r.html;
  return JSON.parse(body);
}

/** Pages d'une catégorie (pagination cmcontinue). */
async function categoryPages(cat: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const j = await apiJson({
      action: "query",
      list: "categorymembers",
      cmtitle: cat,
      cmtype: "page",
      cmlimit: "500",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const m of j.query?.categorymembers ?? []) titles.push(m.title);
    cont = j.continue?.cmcontinue;
    await sleep(THROTTLE_MS);
  } while (cont);
  return titles;
}

interface FileImg {
  pageid: number;
  name: string;
  url: string;
  thumb: string | null;
  width: number;
  height: number;
  mime: string;
}

/** Tous les fichiers liés à une page (generator=images, pagination gimcontinue). */
async function pageImages(title: string): Promise<FileImg[]> {
  const out: FileImg[] = [];
  let cont: Record<string, string> | undefined;
  do {
    const j = await apiJson({
      action: "query",
      generator: "images",
      titles: title,
      gimlimit: "200",
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: String(THUMB_W),
      ...(cont ?? {}),
    });
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii || !p.pageid) continue;
      out.push({
        pageid: p.pageid,
        name: String(p.title).replace(/^File:/, ""),
        url: ii.url,
        thumb: ii.thumburl ?? null,
        width: ii.width ?? 0,
        height: ii.height ?? 0,
        mime: ii.mime ?? "",
      });
    }
    cont = j.continue ? { gimcontinue: j.continue.gimcontinue } : undefined;
    if (cont) await sleep(THROTTLE_MS);
  } while (cont);
  return out;
}

/**
 * Garde les captures d'écran (screencaps) HQ et écarte logos / title cards /
 * artworks de fiche : jpeg, largeur ≥ 800, ratio ~16:9 ou 4:3 (pas portrait),
 * et nom non typé "logo/title/card/render/box/promo".
 */
const REJECT_NAME =
  /logo|title|titlecard|eptitle|card|render|box|promo|cover|menu|flag|symbol|emblem/i;
function isScreencap(f: FileImg): boolean {
  if (!/^image\/(jpe?g|png)$/.test(f.mime)) return false;
  if (f.width < 800 || f.height < 400) return false;
  const ratio = f.width / f.height;
  if (ratio < 1.1 || ratio > 2.1) return false; // exclut portraits/bannières
  if (REJECT_NAME.test(f.name)) return false;
  return true;
}

async function main() {
  const { slug, maxEps } = parseArgs();
  const cfg = SERIES[slug];
  if (!cfg) {
    throw new Error(`slug inconnu "${slug}". Disponibles: ${Object.keys(SERIES).join(", ")}`);
  }
  console.log(`Recon Fandom (profil static) — « ${cfg.label} » → ${cfg.episodeCategory}`);

  const pages = (await categoryPages(cfg.episodeCategory)).sort();
  const eps = pages
    .map((title) => {
      const n = Number(title.match(cfg.episodeRe)?.[1]);
      return Number.isFinite(n) ? { title, number: n } : null;
    })
    .filter((x): x is { title: string; number: number } => x !== null)
    .sort((a, b) => a.number - b.number)
    .filter((e) => e.number <= maxEps);
  console.log(
    `  ${pages.length} pages dans la catégorie · ${eps.length} pages d'épisode reconnues.`,
  );
  if (eps.length === 0) throw new Error("0 page d'épisode reconnue — vérifier episodeRe.");

  const raw: AnimeFrameImport[] = [];
  const seen = new Set<number>(); // pageid déjà émis (dédoublonne cross-épisode)
  let sortOrder = 0;
  let totalCaps = 0;
  for (const ep of eps) {
    const imgs = await pageImages(ep.title);
    await sleep(THROTTLE_MS);
    const caps = imgs.filter(isScreencap);
    let kept = 0;
    for (const f of caps) {
      if (seen.has(f.pageid)) continue;
      seen.add(f.pageid);
      raw.push({
        source: "fandom",
        sourceId: `${WIKI}:${f.pageid}`,
        sourceUrl: `https://beyblade.fandom.com/wiki/File:${encodeURIComponent(f.name)}`,
        episodeNumber: ep.number,
        imageUrl: f.url,
        thumbUrl: f.thumb,
        width: f.width,
        height: f.height,
        characterNames: [],
        tags: [],
        caption: null,
        isNotable: false,
        sortOrder: sortOrder++,
      });
      kept++;
    }
    totalCaps += kept;
    console.log(
      `  ep ${String(ep.number).padStart(3)} : ${kept} caps (${imgs.length} fichiers liés)`,
    );
  }

  const report = validateRecords(raw, AnimeFrameImportSchema);
  console.log(
    `\nFrames valides: ${report.valid.length}/${raw.length} (rejets ${report.invalid}) · ${totalCaps} captures HQ retenues sur ${eps.length} épisodes.`,
  );
  if (report.invalid > 0) console.warn(`  rejets: ${report.errors.join(" · ")}`);

  const payload = {
    seriesSlug: slug,
    generation: cfg.generation,
    fancaps: {
      seriesUrl: `https://beyblade.fandom.com/wiki/${cfg.episodeCategory.replace("Category:", "")}`,
      label: cfg.label,
    },
    scrapedAt: new Date().toISOString(),
    episodes: eps.map((e) => ({ number: e.number, title: e.title })),
    frames: report.valid,
  };
  const out = join(OUT_DIR, `${slug}.json`);
  await writeIfNonEmpty(out, payload, report.valid.length);
  if (report.valid[0]) console.log("  exemple frame:", JSON.stringify(report.valid[0]));
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  await closeBrowser();
  process.exit(1);
});
