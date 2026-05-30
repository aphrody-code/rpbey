import "server-only";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  schema,
  sql,
} from "@/lib/db";
import type { AnimeEpisodeInput, AnimeEpisodeSourceInput, AnimeSeriesInput } from "@rpbey/types";

/**
 * Data Access Layer — anime (séries / épisodes / sources / progression).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Invariant timestamp : toutes les tables anime sont `mode:"string"` (PgTimestampString)
 * → les valeurs sont déjà des strings ISO en lecture ; les écritures de colonne timestamp
 * (`completedAt`) passent une string ISO (`new Date().toISOString()`).
 */

type AnimeGeneration = (typeof schema.animeGeneration.enumValues)[number];
type AnimeSourceType = NonNullable<AnimeEpisodeSourceInput["type"]>;

// ---- Lectures publiques (sans session) ----

/** Séries publiées, triées par ordre d'affichage. */
export async function listPublishedSeries() {
  return db.query.animeSeries.findMany({
    where: eq(schema.animeSeries.isPublished, true),
    orderBy: asc(schema.animeSeries.sortOrder),
  });
}

/** Séries publiées regroupées par génération. */
export async function listSeriesByGeneration() {
  const series = await listPublishedSeries();
  const grouped: Record<string, typeof series> = {};
  for (const s of series) {
    (grouped[s.generation] ??= []).push(s);
  }
  return grouped;
}

/** Séries vedettes (publiées + bannière), limitées à 5. */
export async function listFeaturedSeries() {
  return db.query.animeSeries.findMany({
    where: and(eq(schema.animeSeries.isPublished, true), isNotNull(schema.animeSeries.bannerUrl)),
    orderBy: asc(schema.animeSeries.sortOrder),
    limit: 5,
  });
}

/** Série par slug + ses épisodes publiés (sources actives), forme `{ ...series, episodes }`. */
export async function getSeriesBySlug(slug: string) {
  const series = await db.query.animeSeries.findFirst({
    where: eq(schema.animeSeries.slug, slug),
    with: {
      animeEpisodes: {
        where: eq(schema.animeEpisodes.isPublished, true),
        orderBy: asc(schema.animeEpisodes.number),
        with: {
          animeEpisodeSources: {
            where: eq(schema.animeEpisodeSources.isActive, true),
            orderBy: desc(schema.animeEpisodeSources.priority),
          },
        },
      },
    },
  });
  if (!series) return null;
  return {
    ...series,
    episodes: series.animeEpisodes.map((e) => ({
      ...e,
      sources: e.animeEpisodeSources,
    })),
  };
}

/**
 * Épisode (par slug + numéro) avec sources, série, prev/next et liste légère de tous les
 * épisodes pour la sidebar du lecteur. Forme inchangée pour la page épisode.
 */
export async function getEpisodeByNumber(slug: string, episodeNumber: number) {
  const series = await db.query.animeSeries.findFirst({
    where: eq(schema.animeSeries.slug, slug),
  });
  if (!series) return null;

  const episodeRow = await db.query.animeEpisodes.findFirst({
    where: and(
      eq(schema.animeEpisodes.seriesId, series.id),
      eq(schema.animeEpisodes.number, episodeNumber),
    ),
    with: {
      animeEpisodeSources: {
        where: eq(schema.animeEpisodeSources.isActive, true),
        orderBy: desc(schema.animeEpisodeSources.priority),
      },
      animeSery: true,
    },
  });
  if (!episodeRow) return null;

  const episode = {
    ...episodeRow,
    sources: episodeRow.animeEpisodeSources,
    series: episodeRow.animeSery,
  };

  const [prev, next, allEpisodes] = await Promise.all([
    db.query.animeEpisodes.findFirst({
      where: and(
        eq(schema.animeEpisodes.seriesId, series.id),
        lt(schema.animeEpisodes.number, episodeNumber),
        eq(schema.animeEpisodes.isPublished, true),
      ),
      orderBy: desc(schema.animeEpisodes.number),
      columns: { number: true, title: true, titleFr: true },
    }),
    db.query.animeEpisodes.findFirst({
      where: and(
        eq(schema.animeEpisodes.seriesId, series.id),
        gt(schema.animeEpisodes.number, episodeNumber),
        eq(schema.animeEpisodes.isPublished, true),
      ),
      orderBy: asc(schema.animeEpisodes.number),
      columns: { number: true, title: true, titleFr: true },
    }),
    db.query.animeEpisodes.findMany({
      where: and(
        eq(schema.animeEpisodes.seriesId, series.id),
        eq(schema.animeEpisodes.isPublished, true),
      ),
      orderBy: asc(schema.animeEpisodes.number),
      columns: {
        id: true,
        number: true,
        title: true,
        titleFr: true,
        thumbnailUrl: true,
        duration: true,
      },
    }),
  ]);

  return {
    episode,
    series,
    prev: prev ?? null,
    next: next ?? null,
    allEpisodes,
  };
}

/** Recherche full-text simple sur séries + épisodes publiés. */
export async function searchPublished(query: string) {
  const pattern = `%${query}%`;
  const [series, episodeRows] = await Promise.all([
    db.query.animeSeries.findMany({
      where: and(
        eq(schema.animeSeries.isPublished, true),
        or(
          ilike(schema.animeSeries.title, pattern),
          ilike(schema.animeSeries.titleFr, pattern),
          ilike(schema.animeSeries.titleJp, pattern),
        ),
      ),
      limit: 10,
    }),
    db.query.animeEpisodes.findMany({
      where: and(
        eq(schema.animeEpisodes.isPublished, true),
        or(
          ilike(schema.animeEpisodes.title, pattern),
          ilike(schema.animeEpisodes.titleFr, pattern),
        ),
      ),
      with: { animeSery: { columns: { slug: true, title: true } } },
      limit: 10,
    }),
  ]);
  const episodes = episodeRows.map((e) => ({ ...e, series: e.animeSery }));
  return { series, episodes };
}

// ---- Admin (mutations + lectures complètes) ----

/** Toutes les séries (publiées ou non) + compte d'épisodes (`_count.episodes`). */
export async function listAllSeriesWithCounts() {
  const series = await db.query.animeSeries.findMany({
    orderBy: asc(schema.animeSeries.sortOrder),
  });
  const counts = await db
    .select({ seriesId: schema.animeEpisodes.seriesId, value: count() })
    .from(schema.animeEpisodes)
    .groupBy(schema.animeEpisodes.seriesId);
  const countMap = new Map(counts.map((c) => [c.seriesId, c.value]));
  return series.map((s) => ({
    ...s,
    _count: { episodes: countMap.get(s.id) ?? 0 },
  }));
}

/** Série par id + tous ses épisodes (toutes sources), avec `_count.sources` par épisode. */
export async function getSeriesByIdFull(id: string) {
  const series = await db.query.animeSeries.findFirst({
    where: eq(schema.animeSeries.id, id),
    with: {
      animeEpisodes: {
        orderBy: asc(schema.animeEpisodes.number),
        with: {
          animeEpisodeSources: {
            orderBy: desc(schema.animeEpisodeSources.priority),
          },
        },
      },
    },
  });
  if (!series) return null;
  return {
    ...series,
    episodes: series.animeEpisodes.map((e) => ({
      ...e,
      sources: e.animeEpisodeSources,
      _count: { sources: e.animeEpisodeSources.length },
    })),
  };
}

export async function upsertSeries(data: {
  id?: string;
  slug: string;
  title: string;
  titleJp?: string;
  titleFr?: string;
  generation: AnimeGeneration;
  synopsis?: string;
  posterUrl?: string;
  bannerUrl?: string;
  year: number;
  episodeCount: number;
  sortOrder: number;
  isPublished: boolean;
}) {
  const { id, ...rest } = data;
  if (id) {
    const [row] = await db
      .update(schema.animeSeries)
      .set(rest)
      .where(eq(schema.animeSeries.id, id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(schema.animeSeries)
    .values(rest satisfies AnimeSeriesInput)
    .returning();
  return row;
}

export async function deleteSeries(id: string) {
  const [row] = await db
    .delete(schema.animeSeries)
    .where(eq(schema.animeSeries.id, id))
    .returning();
  return row;
}

export async function upsertEpisode(data: {
  id?: string;
  seriesId: string;
  number: number;
  title: string;
  titleFr?: string;
  titleJp?: string;
  synopsis?: string;
  thumbnailUrl?: string;
  duration: number;
  isPublished: boolean;
}) {
  const { id, ...rest } = data;
  if (id) {
    const [row] = await db
      .update(schema.animeEpisodes)
      .set(rest)
      .where(eq(schema.animeEpisodes.id, id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(schema.animeEpisodes)
    .values(rest satisfies AnimeEpisodeInput)
    .returning();
  return row;
}

export async function deleteEpisode(id: string) {
  const [row] = await db
    .delete(schema.animeEpisodes)
    .where(eq(schema.animeEpisodes.id, id))
    .returning();
  return row;
}

export async function upsertSource(data: {
  id?: string;
  episodeId: string;
  type: AnimeSourceType;
  url: string;
  quality: string;
  language: string;
  priority: number;
  isActive: boolean;
}) {
  const { id, ...rest } = data;
  if (id) {
    const [row] = await db
      .update(schema.animeEpisodeSources)
      .set(rest)
      .where(eq(schema.animeEpisodeSources.id, id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(schema.animeEpisodeSources)
    .values(rest satisfies AnimeEpisodeSourceInput)
    .returning();
  return row;
}

export async function deleteSource(id: string) {
  const [row] = await db
    .delete(schema.animeEpisodeSources)
    .where(eq(schema.animeEpisodeSources.id, id))
    .returning();
  return row;
}

export async function bulkUpsertEpisodes(
  seriesId: string,
  episodes: Array<{
    number: number;
    title: string;
    titleFr?: string;
    duration?: number;
  }>,
) {
  const results = [];
  for (const ep of episodes) {
    const [result] = await db
      .insert(schema.animeEpisodes)
      .values({
        seriesId,
        number: ep.number,
        title: ep.title,
        titleFr: ep.titleFr,
        duration: ep.duration ?? 0,
      })
      .onConflictDoUpdate({
        target: [schema.animeEpisodes.seriesId, schema.animeEpisodes.number],
        set: {
          title: ep.title,
          titleFr: ep.titleFr,
          duration: ep.duration ?? 0,
        },
      })
      .returning();
    results.push(result);
  }
  return results;
}

// ---- Progression de visionnage (par utilisateur ; appelée depuis des actions/route
// qui résolvent la session avant — la DAL ne touche jamais `@/lib/auth`). ----

/** Reprises en cours d'un utilisateur (épisode + série minimale). */
export async function listContinueWatching(userId: string) {
  const rows = await db.query.animeWatchProgress.findMany({
    where: and(
      eq(schema.animeWatchProgress.userId, userId),
      eq(schema.animeWatchProgress.status, "IN_PROGRESS"),
    ),
    orderBy: desc(schema.animeWatchProgress.updatedAt),
    limit: 20,
    with: {
      animeEpisode: {
        with: {
          animeSery: { columns: { slug: true, title: true, posterUrl: true } },
        },
      },
    },
  });
  return rows.map((p) => ({
    ...p,
    episode: { ...p.animeEpisode, series: p.animeEpisode.animeSery },
  }));
}

/** Map épisodeId → progression pour tous les épisodes d'une série, pour un utilisateur. */
export async function getSeriesProgressMap(userId: string, seriesId: string) {
  const episodes = await db
    .select({ id: schema.animeEpisodes.id })
    .from(schema.animeEpisodes)
    .where(eq(schema.animeEpisodes.seriesId, seriesId));
  const episodeIds = episodes.map((e) => e.id);

  const progress = episodeIds.length
    ? await db.query.animeWatchProgress.findMany({
        where: and(
          eq(schema.animeWatchProgress.userId, userId),
          inArray(schema.animeWatchProgress.episodeId, episodeIds),
        ),
      })
    : [];

  const map: Record<string, { status: string; progressTime: number; episodeId: string }> = {};
  for (const p of progress) {
    map[p.episodeId] = {
      status: p.status,
      progressTime: p.progressTime,
      episodeId: p.episodeId,
    };
  }
  return map;
}

/** Progression d'un épisode précis pour un utilisateur, ou null. */
export async function getEpisodeProgressFor(userId: string, episodeId: string) {
  const row = await db.query.animeWatchProgress.findFirst({
    where: and(
      eq(schema.animeWatchProgress.userId, userId),
      eq(schema.animeWatchProgress.episodeId, episodeId),
    ),
  });
  return row ?? null;
}

/**
 * Enregistre/maj la progression d'un épisode. `completedAt` est une string ISO
 * (colonne `mode:"string"`). Marque COMPLETED au-delà de 90% de la durée.
 */
export async function saveWatchProgress(
  userId: string,
  episodeId: string,
  progressTime: number,
  duration: number,
) {
  const isCompleted = duration > 0 && progressTime / duration > 0.9;
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const [row] = await db
    .insert(schema.animeWatchProgress)
    .values({
      userId,
      episodeId,
      progressTime: Math.floor(progressTime),
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      completedAt,
    })
    .onConflictDoUpdate({
      target: [schema.animeWatchProgress.userId, schema.animeWatchProgress.episodeId],
      set: {
        progressTime: Math.floor(progressTime),
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
        completedAt,
      },
    })
    .returning();
  return row ?? null;
}

// ---- Frames d'anime (galerie de captures — table `anime_frames`) ----

export interface AnimeFramesFilter {
  series?: string; // slug de série
  episode?: number; // numéro d'épisode
  character?: string; // nom de personnage (tag jsonb)
  notable?: boolean; // uniquement les moments marquants
  q?: string; // recherche libre (caption + personnages)
  limit?: number;
  cursor?: string; // createdAt ISO (pagination descendante)
}

/** Galerie de frames filtrée (série/épisode/personnage/marquant/recherche) + pagination curseur. */
export async function listAnimeFrames(params: AnimeFramesFilter) {
  const { series, episode, character, notable, q, limit = 40, cursor } = params;
  const cap = Math.min(100, Math.max(1, limit));
  const conds = [];
  if (series) {
    const s = await db.query.animeSeries.findFirst({
      where: eq(schema.animeSeries.slug, series),
      columns: { id: true },
    });
    if (!s) return { frames: [], nextCursor: null, total: 0 };
    conds.push(eq(schema.animeFrames.seriesId, s.id));
  }
  if (episode !== undefined) conds.push(eq(schema.animeFrames.episodeNumber, episode));
  if (notable) conds.push(eq(schema.animeFrames.isNotable, true));
  // Containment jsonb : la frame est taggée avec ce personnage.
  if (character)
    conds.push(sql`${schema.animeFrames.characterNames} @> ${JSON.stringify([character])}::jsonb`);
  if (q)
    conds.push(
      or(
        ilike(schema.animeFrames.caption, `%${q}%`),
        sql`${schema.animeFrames.characterNames}::text ILIKE ${`%${q}%`}`,
      ),
    );
  if (cursor) conds.push(lt(schema.animeFrames.createdAt, cursor));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [rows, totalRes] = await Promise.all([
    db
      .select()
      .from(schema.animeFrames)
      .where(where)
      .orderBy(desc(schema.animeFrames.createdAt))
      .limit(cap + 1),
    db.select({ value: count() }).from(schema.animeFrames).where(where),
  ]);
  const hasMore = rows.length > cap;
  const frames = rows.slice(0, cap);
  return {
    frames,
    nextCursor: hasMore ? (frames[frames.length - 1]?.createdAt ?? null) : null,
    total: totalRes[0]?.value ?? 0,
  };
}

interface FrameIndexRow {
  id: string;
  thumbUrl: string | null;
  imageUrl: string;
  episodeNumber: number | null;
  characterNames: string[];
  caption: string | null;
  seriesSlug: string;
  seriesTitle: string;
  generation: string;
}

/**
 * Frames marquantes pour l'index de recherche « Google Images ».
 *
 * Sélection DIVERSE : plafonnée à `perEpisode` frames par (série, épisode) via
 * `row_number()`, pour couvrir les 244 épisodes / toutes les générations plutôt
 * que de gaver l'index des frames d'une seule série (Beyblade X = 63 % du total)
 * avec un simple `LIMIT … ORDER BY createdAt`. `characterNames` est le cast de
 * l'épisode (même tag-set pour toutes les frames d'un épisode) — on en garde
 * quelques-unes par épisode pour la galerie sans inonder la recherche texte.
 */
export async function listAnimeFramesForIndex(max = 3000, perEpisode = 12) {
  const rows = await db.execute(sql`
    SELECT sub.id,
           sub."thumbUrl"        AS "thumbUrl",
           sub."imageUrl"        AS "imageUrl",
           sub."episodeNumber"   AS "episodeNumber",
           sub."characterNames"  AS "characterNames",
           sub.caption           AS caption,
           s.slug                AS "seriesSlug",
           s.title               AS "seriesTitle",
           s.generation          AS generation
      FROM (
        SELECT f.*,
               row_number() OVER (
                 PARTITION BY f."seriesId", f."episodeNumber"
                 ORDER BY f."sortOrder", f.id
               ) AS rn
          FROM ${schema.animeFrames} f
         WHERE f."isNotable" = true
      ) sub
      JOIN ${schema.animeSeries} s ON s.id = sub."seriesId"
     WHERE sub.rn <= ${perEpisode}
     ORDER BY s.title, sub."episodeNumber", sub.rn
     LIMIT ${max}
  `);
  // postgres-js renvoie les lignes brutes ; `characterNames` (jsonb) est déjà parsé.
  return (rows as unknown as FrameIndexRow[]).map((r) => ({
    ...r,
    characterNames: Array.isArray(r.characterNames) ? r.characterNames : [],
  }));
}
