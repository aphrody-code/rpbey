#!/usr/bin/env bun
/**
 * import-anime-frames.ts — ingère `data/anime-frames/<slug>.json` (produit par
 * scrape-anime-frames.ts) dans la table `anime_frames` + re-héberge chaque frame
 * en **PNG lossless** sur le CDN rpbey avec un filename préfixé.
 *
 * Pipeline par frame (Bun-natif, concurrence bornée) :
 *   fetch(imageUrl HD proxifié) → sharp JPEG→PNG → oxipng (lossless) →
 *   écrit  <CDN_DIR>/<slug>/ep<NN>/frame-<sourceId>.png →
 *   upsert anime_frames (dédup sur (source, sourceId)) avec imageUrl = URL CDN re-hébergée.
 *
 *   bun scripts/import-anime-frames.ts <slug> [--limit N] [--notable-only] [--concurrency K]
 *
 * Idempotent / resumable : une frame déjà sur disque + en DB est sautée.
 * Sert : gacha (cartes persos non dessinés), backgrounds, recherche « Google Images ».
 */
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { AnimeFrameImportSchema } from "@rpbey/api-contract";
import { db, schema } from "@rpbey/db";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

const CDN_DIR =
	process.env.ANIME_FRAMES_CDN_DIR ?? "/var/www/cdn/static/rpb-dashboard/anime";
const CDN_BASE = (
	process.env.ANIME_FRAMES_CDN_BASE ??
	"https://cdn.rpbey.fr/static/rpb-dashboard/anime"
).replace(/\/+$/, "");

const FileSchema = z.object({
	seriesSlug: z.string().min(1),
	generation: z.enum(["ORIGINAL", "METAL", "BURST", "X"]),
	fancaps: z
		.object({ seriesUrl: z.string(), label: z.string() })
		.partial()
		.optional(),
	episodes: z
		.array(z.object({ number: z.number().int(), title: z.string().nullish() }))
		.optional(),
	frames: z.array(AnimeFrameImportSchema),
});

const log = (m: string) => process.stderr.write(`${m}\n`);

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** Résout la série par slug, ou la crée (minimale, non publiée) si absente. */
async function resolveSeriesId(
	slug: string,
	generation: string,
	label?: string,
) {
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

const exists = (p: string) =>
	stat(p).then(
		() => true,
		() => false,
	);

async function main() {
	const slug = process.argv[2];
	if (!slug || slug.startsWith("--")) {
		log(
			"Usage: bun scripts/import-anime-frames.ts <slug> [--limit N] [--notable-only] [--concurrency K]",
		);
		process.exit(1);
	}
	const limit = arg("limit") ? Number(arg("limit")) : Infinity;
	const notableOnly = hasFlag("notable-only");
	const concurrency = Math.max(1, Number(arg("concurrency") ?? "6") || 6);

	const raw = await Bun.file(
		`${import.meta.dir}/../data/anime-frames/${slug}.json`,
	).json();
	const parsed = FileSchema.safeParse(raw);
	if (!parsed.success) {
		log(`JSON invalide: ${parsed.error.issues[0]?.message}`);
		process.exit(1);
	}
	const data = parsed.data;
	const seriesId = await resolveSeriesId(
		data.seriesSlug,
		data.generation,
		data.fancaps?.label,
	);
	const epMap = await episodeIdMap(seriesId);

	let frames = data.frames;
	if (notableOnly) frames = frames.filter((f) => f.isNotable);
	if (Number.isFinite(limit)) frames = frames.slice(0, limit);
	log(
		`[import] ${data.seriesSlug} — ${frames.length} frames (concurrence ${concurrency}) → ${CDN_DIR}`,
	);

	let done = 0;
	let skipped = 0;
	let failed = 0;

	async function importOne(f: (typeof frames)[number]) {
		const ep = f.episodeNumber ?? 0;
		const epDir = `ep${String(ep).padStart(2, "0")}`;
		const relPath = `${data.seriesSlug}/${epDir}/frame-${f.sourceId}.png`;
		const diskPath = `${CDN_DIR}/${relPath}`;
		const finalUrl = `${CDN_BASE}/${relPath}`;

		try {
			// Resumable : fichier présent + ligne en DB → skip.
			if (await exists(diskPath)) {
				const row = await db
					.select({ id: schema.animeFrames.id })
					.from(schema.animeFrames)
					.where(
						and(
							eq(schema.animeFrames.source, f.source),
							eq(schema.animeFrames.sourceId, f.sourceId),
						),
					)
					.limit(1);
				if (row[0]) {
					skipped++;
					return;
				}
			} else {
				// Télécharge le HD proxifié → PNG lossless (sharp) → oxipng.
				const res = await fetch(f.imageUrl, {
					signal: AbortSignal.timeout(30_000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const jpg = Buffer.from(await res.arrayBuffer());
				const meta = await sharp(jpg).metadata();
				const png = await sharp(jpg)
					.png({ compressionLevel: 9, effort: 10 })
					.toBuffer();
				await mkdir(dirname(diskPath), { recursive: true });
				await Bun.write(diskPath, png);
				// oxipng en place (lossless, strip safe) — best-effort.
				await Bun.spawn([
					"oxipng",
					"-o",
					"4",
					"--strip",
					"safe",
					"-q",
					diskPath,
				]).exited;
				f.width = f.width ?? meta.width ?? null;
				f.height = f.height ?? meta.height ?? null;
			}

			await db
				.insert(schema.animeFrames)
				.values({
					seriesId,
					episodeId: f.episodeNumber
						? (epMap.get(f.episodeNumber) ?? null)
						: null,
					episodeNumber: f.episodeNumber ?? null,
					source: f.source,
					sourceId: f.sourceId,
					sourceUrl: f.sourceUrl ?? null,
					imageUrl: finalUrl,
					thumbUrl: f.thumbUrl ?? null,
					width: f.width ?? null,
					height: f.height ?? null,
					characterNames: f.characterNames,
					tags: f.tags,
					caption: f.caption ?? null,
					isNotable: f.isNotable,
					sortOrder: f.sortOrder,
					updatedAt: new Date().toISOString(),
				})
				.onConflictDoUpdate({
					target: [schema.animeFrames.source, schema.animeFrames.sourceId],
					set: {
						seriesId,
						episodeId: f.episodeNumber
							? (epMap.get(f.episodeNumber) ?? null)
							: null,
						episodeNumber: f.episodeNumber ?? null,
						imageUrl: finalUrl,
						thumbUrl: f.thumbUrl ?? null,
						width: f.width ?? null,
						height: f.height ?? null,
						characterNames: f.characterNames,
						tags: f.tags,
						caption: f.caption ?? null,
						isNotable: f.isNotable,
						sortOrder: f.sortOrder,
						updatedAt: new Date().toISOString(),
					},
				});
			done++;
			if ((done + skipped) % 100 === 0)
				log(`  … ${done} importées, ${skipped} sautées, ${failed} échecs`);
		} catch (e) {
			failed++;
			if (failed <= 10) log(`  ✗ ${f.sourceId}: ${(e as Error).message}`);
		}
	}

	// Pool à concurrence bornée (Bun-natif, perf — pas de lib externe).
	let idx = 0;
	async function worker() {
		while (idx < frames.length) {
			const f = frames[idx++];
			if (f) await importOne(f);
		}
	}
	await Promise.all(Array.from({ length: concurrency }, () => worker()));

	log(
		`\n[import] OK — ${done} importées, ${skipped} sautées, ${failed} échecs / ${frames.length}`,
	);
	process.exit(failed > frames.length / 2 ? 1 : 0);
}

await main();
