#!/usr/bin/env bun
/**
 * import-anime-frames.ts — ingère `data/anime-frames/<slug>.json` (produit par
 * scrape-anime-frames.ts / scrape-fandom-frames.ts) dans la table `anime_frames`.
 *
 * ⚠️ Plus de ré-hébergement disque. Les `imageUrl`/`thumbUrl` du JSON sont déjà
 * des **URLs distantes durables** — on les stocke telles quelles :
 *   - fandom  → static.wikia.nocookie.net (hotlink direct)
 *   - fancaps → cdn.rpbey.fr/fancaps-anime{,-full}/<id>.jpg (proxy_cache nginx → fancaps)
 * L'ancien pipeline re-téléchargeait chaque frame en PNG lossless sur le CDN
 * (~3.8 GB pour ~10k frames) : inutile, retiré le 2026-06-02.
 *
 *   bun scripts/import-anime-frames.ts <slug> [--limit N] [--notable-only]
 *
 * Idempotent : upsert sur (source, sourceId).
 * Sert : gacha (cartes persos non dessinés), backgrounds, recherche « Google Images ».
 */
import { AnimeFrameImportSchema } from "@rpbey/api-contract";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const FileSchema = z.object({
  seriesSlug: z.string().min(1),
  generation: z.enum(["ORIGINAL", "METAL", "BURST", "X"]),
  fancaps: z.object({ seriesUrl: z.string(), label: z.string() }).partial().optional(),
  episodes: z.array(z.object({ number: z.number().int(), title: z.string().nullish() })).optional(),
  frames: z.array(AnimeFrameImportSchema),
});

const log = (m: string) => process.stderr.write(`${m}\n`);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** Résout la série par slug, ou la crée (minimale, non publiée) si absente. */
async function resolveSeriesId(slug: string, generation: string, label?: string) {
  const found = await db
    .select({ id: schema.animeSeries.id })
    .from(schema.animeSeries)
    .where(eq(schema.animeSeries.slug, slug))
    .limit(1);
  if (found[0]) return found[0].id;
  const [created] = await db
    .insert(schema.animeSeries)
    .values({
      slug,
      title: label ?? slug,
      generation: generation as never,
      year: 0,
      isPublished: false,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: schema.animeSeries.id });
  log(`  série créée (non publiée) : ${slug}`);
  return created!.id;
}

/** Map episodeNumber → episodeId (épisodes déjà en DB pour cette série). */
async function episodeIdMap(seriesId: string) {
  const rows = await db
    .select({
      id: schema.animeEpisodes.id,
      number: schema.animeEpisodes.number,
    })
    .from(schema.animeEpisodes)
    .where(eq(schema.animeEpisodes.seriesId, seriesId));
  return new Map(rows.map((r) => [r.number, r.id]));
}

async function main() {
  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    log("Usage: bun scripts/import-anime-frames.ts <slug> [--limit N] [--notable-only]");
    process.exit(1);
  }
  const limit = arg("limit") ? Number(arg("limit")) : Infinity;
  const notableOnly = hasFlag("notable-only");

  const raw = await Bun.file(`${import.meta.dir}/../data/anime-frames/${slug}.json`).json();
  const parsed = FileSchema.safeParse(raw);
  if (!parsed.success) {
    log(`JSON invalide: ${parsed.error.issues[0]?.message}`);
    process.exit(1);
  }
  const data = parsed.data;
  const seriesId = await resolveSeriesId(data.seriesSlug, data.generation, data.fancaps?.label);
  const epMap = await episodeIdMap(seriesId);

  let frames = data.frames;
  if (notableOnly) frames = frames.filter((f) => f.isNotable);
  if (Number.isFinite(limit)) frames = frames.slice(0, limit);
  log(`[import] ${data.seriesSlug} — ${frames.length} frames (URLs distantes, zéro disque)`);

  let done = 0;
  let failed = 0;

  for (const f of frames) {
    try {
      const values = {
        seriesId,
        episodeId: f.episodeNumber ? (epMap.get(f.episodeNumber) ?? null) : null,
        episodeNumber: f.episodeNumber ?? null,
        source: f.source,
        sourceId: f.sourceId,
        sourceUrl: f.sourceUrl ?? null,
        imageUrl: f.imageUrl,
        thumbUrl: f.thumbUrl ?? null,
        width: f.width ?? null,
        height: f.height ?? null,
        characterNames: f.characterNames,
        tags: f.tags,
        caption: f.caption ?? null,
        isNotable: f.isNotable,
        sortOrder: f.sortOrder,
        updatedAt: new Date().toISOString(),
      };
      await db
        .insert(schema.animeFrames)
        .values(values)
        .onConflictDoUpdate({
          target: [schema.animeFrames.source, schema.animeFrames.sourceId],
          set: {
            seriesId: values.seriesId,
            episodeId: values.episodeId,
            episodeNumber: values.episodeNumber,
            imageUrl: values.imageUrl,
            thumbUrl: values.thumbUrl,
            width: values.width,
            height: values.height,
            characterNames: values.characterNames,
            tags: values.tags,
            caption: values.caption,
            isNotable: values.isNotable,
            sortOrder: values.sortOrder,
            updatedAt: values.updatedAt,
          },
        });
      done++;
      if (done % 500 === 0) log(`  … ${done} importées`);
    } catch (e) {
      failed++;
      if (failed <= 10) log(`  ✗ ${f.sourceId}: ${(e as Error).message}`);
    }
  }

  log(`\n[import] OK — ${done} importées, ${failed} échecs / ${frames.length}`);
  process.exit(failed > frames.length / 2 ? 1 : 0);
}

await main();
