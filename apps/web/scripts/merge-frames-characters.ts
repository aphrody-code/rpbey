#!/usr/bin/env bun
/**
 * Croise data/anime-frames/character-episodes.json dans data/anime-frames/<slug>.json :
 * pour chaque frame d'un épisode MARQUANT d'un perso, ajoute le nom du perso à
 * `characterNames` et passe `isNotable:true`. Réécrit le <slug>.json (non-destructif).
 *
 * Mapping : character-episodes.json[seriesSlug][charName].notableEpisodes (array de
 * numéros d'épisode). Une frame d'épisode N hérite des persos dont N ∈ notableEpisodes.
 *
 *   cd apps/web && bun scripts/merge-frames-characters.ts <series-slug>
 *   ex.                  bun scripts/merge-frames-characters.ts beyblade-x
 */
import { join } from "node:path";
import { AnimeFrameImportSchema, type AnimeFrameImport } from "@rpbey/api-contract";
import { validateRecords, writeIfNonEmpty } from "./lib/ghost-scraper.ts";

const DIR = join(process.cwd(), "data", "anime-frames");
const MAP_FILE = join(DIR, "character-episodes.json");

type Frames = {
  seriesSlug: string;
  generation: string;
  fancaps: { seriesUrl: string; label: string };
  scrapedAt?: string;
  episodes: unknown[];
  frames: AnimeFrameImport[];
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Bun.file(path).text()) as T;
}

async function main() {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "beyblade-x";
  const framesPath = join(DIR, `${slug}.json`);

  const data = await readJson<Frames>(framesPath);
  const charMap = await readJson<
    Record<
      string,
      Record<
        string,
        {
          notableEpisodes: number[];
          battleEpisodes?: number[];
          role?: string;
        }
      >
    >
  >(MAP_FILE);
  const seriesMap = charMap[slug] ?? {};
  if (Object.keys(seriesMap).length === 0) {
    throw new Error(`aucun mapping perso pour « ${slug} » dans ${MAP_FILE}`);
  }

  // épisode → persos qui y apparaissent (toutes notables) et qui y COMBATTENT.
  // characterNames = toutes apparitions notables ; isNotable = ∃ combat à cet ép.
  const epToChars = new Map<number, Set<string>>();
  const battleEpisodes = new Set<number>();
  for (const [name, { notableEpisodes, battleEpisodes: be }] of Object.entries(seriesMap)) {
    for (const ep of notableEpisodes) {
      (epToChars.get(ep) ?? epToChars.set(ep, new Set()).get(ep)!).add(name);
    }
    for (const ep of be ?? []) battleEpisodes.add(ep);
  }

  let notableFrames = 0;
  let taggedChars = 0;
  for (const f of data.frames) {
    const ep = f.episodeNumber ?? -1;
    const chars = epToChars.get(ep);
    if (chars && chars.size > 0) {
      f.characterNames = [...chars].sort();
      f.isNotable = battleEpisodes.has(ep); // notable = frame d'un épisode de COMBAT
      if (f.isNotable) notableFrames++;
      taggedChars += chars.size;
    } else {
      // re-merge idempotent : une frame d'un épisode non-marquant repasse à neutre.
      f.characterNames = [];
      f.isNotable = false;
    }
  }

  const report = validateRecords(data.frames, AnimeFrameImportSchema);
  if (report.invalid > 0) {
    throw new Error(
      `merge a produit ${report.invalid} frame(s) invalide(s): ${report.errors.join(" · ")}`,
    );
  }
  data.frames = report.valid;

  const notableEps = [...epToChars.keys()].filter((ep) =>
    data.frames.some((f) => f.episodeNumber === ep),
  );
  console.log(
    `Merge ${slug} : ${data.frames.length} frames | ${notableFrames} notables (${notableEps.length} épisodes marquants couverts) | ${taggedChars} tags perso posés.`,
  );

  await writeIfNonEmpty(framesPath, data, data.frames.length);
  const sample = data.frames.find((f) => f.isNotable);
  if (sample) console.log("  exemple notable:", JSON.stringify(sample));
}

main().catch((e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  process.exit(1);
});
