#!/usr/bin/env bun
/**
 * Scrape les FRAMES d'anime Beyblade depuis fancaps.net → data/anime-frames/<slug>.json.
 *
 * Recon (2026-05-29, profil `static` = DOM zigquery 0-JS ; curl direct & profil
 * `http` curl-impersonate → 403 sur l'IP datacenter du VPS, mais `static` passe) :
 *
 *   Structure fancaps :
 *     - index alpha :  showList.php?<lettre>          (≠ pagination — liste A-Z)
 *     - page série  :  showimages.php?<showId>-<Slug> → liens episodeimages.php
 *     - page épisode:  episodeimages.php?<epId>-<Slug>/Episode_<N>[&page=<P>]
 *         · ~40 frames / page ; nav de pages = FENÊTRE glissante (ne donne PAS le
 *           dernier numéro d'emblée) → on suit page+1 tant qu'on récolte des ids.
 *         · chaque frame : <a href="…/picture.php?/<id>"> + <img src="…/<id>.jpg">
 *     - thumbnails ANIME sur ant.fancaps.net/<id>.jpg ; HD sur
 *       cdni.fancaps.net/file/fancaps-animeimages/<id>.jpg
 *       (≠ tv-images — d'où les deux proxys CDN dédiés ci-dessous).
 *
 *   Couverture Beyblade sur fancaps : SEULE "Beyblade X" (showId 43349) est
 *   présente. Les générations ORIGINAL (Bakuten) / METAL / BURST n'y sont pas
 *   listées (vérifié sur les pages ?b et ?m). On scrape donc Beyblade X.
 *
 *   URLs CDN proxifiées (nginx cdn.rpbey.fr, cache 90j) :
 *     thumbUrl = https://cdn.rpbey.fr/fancaps-anime/<id>.jpg
 *     fullUrl  = https://cdn.rpbey.fr/fancaps-anime-full/<id>.jpg
 *
 * Sortie NON-DESTRUCTIVE (writeIfNonEmpty). Les images NE sont PAS téléchargées
 * (import géré ailleurs) — on ne produit que le JSON + URLs.
 *
 *   cd apps/web && bun scripts/scrape-anime-frames.ts <series-slug> [--max-eps N] [--max-pages P]
 *   ex.                  bun scripts/scrape-anime-frames.ts beyblade-x
 */
import { join } from "node:path";
import {
  AnimeFrameImportSchema,
  FancapsEpisodeSchema,
  type AnimeFrameImport,
  type FancapsEpisode,
} from "@rpbey/api-contract";
import * as cheerio from "cheerio";
import {
  closeBrowser,
  fetchSource,
  validateRecords,
  writeIfNonEmpty,
} from "./lib/ghost-scraper.ts";

const FANCAPS = "https://fancaps.net/anime";
const CDN = "https://cdn.rpbey.fr";
const OUT_DIR = join(process.cwd(), "data", "anime-frames");

type Generation = "ORIGINAL" | "METAL" | "BURST" | "X";

/** Séries Beyblade disponibles sur fancaps (showId + slug de sortie + génération). */
const SERIES: Record<
  string,
  { showId: string; fancapsSlug: string; label: string; generation: Generation }
> = {
  "beyblade-x": {
    showId: "43349",
    fancapsSlug: "Beyblade_X",
    label: "Beyblade X",
    generation: "X",
  },
};

const THROTTLE_MS = 700; // pause entre fetches pour ne pas marteler fancaps
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Args {
  slug: string;
  maxEps: number;
  maxPages: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith("--")) ?? "beyblade-x";
  const num = (flag: string, def: number) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
  };
  return {
    slug,
    maxEps: num("--max-eps", Infinity),
    maxPages: num("--max-pages", 60),
  };
}

async function getHtml(url: string): Promise<cheerio.CheerioAPI | null> {
  const r = await fetchSource(url, {
    profile: "static",
    retries: 3,
    minHtmlLength: 400,
  });
  if (!r) return null;
  return cheerio.load(r.html);
}

/** Liste les épisodes d'une série depuis sa page showimages. */
async function listEpisodes(showId: string, fancapsSlug: string): Promise<FancapsEpisode[]> {
  const url = `${FANCAPS}/showimages.php?${showId}-${fancapsSlug}`;
  const $ = await getHtml(url);
  if (!$) throw new Error(`page série injoignable: ${url}`);
  const seen = new Map<number, FancapsEpisode>();
  $(`a[href*="episodeimages.php"]`).each((_, el) => {
    const href = $(el).attr("href") ?? "";
    // episodeimages.php?43350-Beyblade_X/Episode_1
    const m = href.match(/episodeimages\.php\?(\d+)-[^/]+\/Episode_(\d+)/i);
    if (!m) return;
    const number = Number(m[2]);
    if (seen.has(number)) return;
    const abs = href.startsWith("http") ? href : `${FANCAPS}/${href.replace(/^\/anime\//, "")}`;
    seen.set(number, {
      number,
      fancapsId: m[1],
      url: abs,
      title: `Episode ${number}`,
    });
  });
  return [...seen.values()].sort((a, b) => a.number - b.number);
}

/** Extrait les ids fancaps d'une page d'épisode + détecte la page suivante. */
function extractPage($: cheerio.CheerioAPI): {
  ids: string[];
  maxPageInNav: number;
} {
  const ids: string[] = [];
  const seen = new Set<string>();
  $(`a[href*="picture.php"]`).each((_, el) => {
    const m = ($(el).attr("href") ?? "").match(/picture\.php\?\/(\d+)/);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  });
  const maxPageInNav = Math.max(
    1,
    ...$(`a[href*="&page="]`)
      .map((_, el) => Number(($(el).attr("href") ?? "").match(/&page=(\d+)/)?.[1] ?? 0))
      .get(),
  );
  return { ids, maxPageInNav };
}

/** Tous les ids fancaps d'un épisode, en suivant la pagination glissante. */
async function episodeImageIds(ep: FancapsEpisode, maxPages: number): Promise<string[]> {
  const all: string[] = [];
  const global = new Set<string>();
  let page = 1;
  while (page <= maxPages) {
    const url = page === 1 ? ep.url : `${ep.url}&page=${page}`;
    const $ = await getHtml(url);
    await sleep(THROTTLE_MS);
    if (!$) break;
    const { ids, maxPageInNav } = extractPage($);
    const fresh = ids.filter((id) => !global.has(id));
    // Page sans aucun id neuf → fancaps a clampé sur le dernier (fin de l'épisode).
    if (fresh.length === 0) break;
    for (const id of fresh) {
      global.add(id);
      all.push(id);
    }
    // Si la fenêtre n'expose pas de page > courante, on est au bout.
    if (page >= maxPageInNav) break;
    page++;
  }
  return all;
}

async function main() {
  const { slug, maxEps, maxPages } = parseArgs();
  const series = SERIES[slug];
  if (!series) {
    throw new Error(
      `slug inconnu "${slug}". Disponibles: ${Object.keys(SERIES).join(", ")} (seul Beyblade X est présent sur fancaps).`,
    );
  }
  const seriesUrl = `${FANCAPS}/showimages.php?${series.showId}-${series.fancapsSlug}`;
  console.log(`Recon fancaps (profil static) — série « ${series.label} » → ${seriesUrl}`);

  let episodes = await listEpisodes(series.showId, series.fancapsSlug);
  console.log(`  ${episodes.length} épisode(s) listé(s).`);
  if (episodes.length === 0) throw new Error("0 épisode — page série vide ou bloquée.");
  if (Number.isFinite(maxEps)) episodes = episodes.slice(0, maxEps);

  const rawFrames: AnimeFrameImport[] = [];
  let sortOrder = 0;
  for (const ep of episodes) {
    const ids = await episodeImageIds(ep, maxPages);
    console.log(`  ep ${String(ep.number).padStart(3)} : ${ids.length} frames`);
    for (const id of ids) {
      rawFrames.push({
        source: "fancaps",
        sourceId: id,
        sourceUrl: `${FANCAPS}/picture.php?/${id}`,
        episodeNumber: ep.number,
        imageUrl: `${CDN}/fancaps-anime-full/${id}.jpg`,
        thumbUrl: `${CDN}/fancaps-anime/${id}.jpg`,
        width: null,
        height: null,
        characterNames: [], // rempli par le merge (livrable 3)
        tags: [],
        caption: null,
        isNotable: false,
        sortOrder: sortOrder++,
      });
    }
  }

  const epReport = validateRecords(episodes, FancapsEpisodeSchema);
  const frameReport = validateRecords(rawFrames, AnimeFrameImportSchema);
  console.log(
    `\nÉpisodes valides: ${epReport.valid.length}/${episodes.length} | frames valides: ${frameReport.valid.length}/${rawFrames.length} (rejets ${frameReport.invalid})`,
  );
  if (frameReport.invalid > 0) console.warn(`  rejets frames: ${frameReport.errors.join(" · ")}`);

  // fancapsId = id galerie de l'épisode (≠ ids images). On garde les deux.
  const payload = {
    seriesSlug: slug,
    generation: series.generation,
    fancaps: { seriesUrl, label: series.label },
    scrapedAt: new Date().toISOString(),
    episodes: epReport.valid,
    frames: frameReport.valid,
  };

  const out = join(OUT_DIR, `${slug}.json`);
  await writeIfNonEmpty(out, payload, frameReport.valid.length);
  console.log("  exemple frame:", JSON.stringify(frameReport.valid[0]));
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  await closeBrowser();
  process.exit(1);
});
