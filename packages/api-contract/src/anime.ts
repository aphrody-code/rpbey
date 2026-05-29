import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Anime Beyblade — séries / épisodes / sources / progression de visionnage.
// Reflet des tables `animeSeries` / `animeEpisodes` / `animeEpisodeSources`
// (@rpbey/db, toutes en `mode:"string"` → timestamps ISO sur le fil).
// Surface PUBLIQUE (lectures sans session) consommée par `(marketing)/anime` + SDK.

export const AnimeGenerationSchema = z.enum(["ORIGINAL", "METAL", "BURST", "X"]);
export type AnimeGenerationContract = z.infer<typeof AnimeGenerationSchema>;

export const AnimeSourceTypeSchema = z.enum(["YOUTUBE", "DAILYMOTION", "MP4", "HLS", "IFRAME"]);
export type AnimeSourceType = z.infer<typeof AnimeSourceTypeSchema>;

export const AnimeWatchStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
export type AnimeWatchStatus = z.infer<typeof AnimeWatchStatusSchema>;

export const AnimeSeriesSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  titleJp: z.string().nullish(),
  titleFr: z.string().nullish(),
  generation: AnimeGenerationSchema,
  synopsis: z.string().nullish(),
  posterUrl: z.string().nullish(),
  bannerUrl: z.string().nullish(),
  year: z.number().int(),
  episodeCount: z.number().int(),
  sortOrder: z.number().int(),
  isPublished: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type AnimeSeriesContract = z.infer<typeof AnimeSeriesSchema>;

export const AnimeEpisodeSourceSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  type: AnimeSourceTypeSchema,
  url: z.string(),
  quality: z.string(),
  language: z.string(),
  priority: z.number().int(),
  isActive: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type AnimeEpisodeSourceContract = z.infer<typeof AnimeEpisodeSourceSchema>;

export const AnimeEpisodeSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  number: z.number().int(),
  title: z.string(),
  titleFr: z.string().nullish(),
  titleJp: z.string().nullish(),
  synopsis: z.string().nullish(),
  thumbnailUrl: z.string().nullish(),
  duration: z.number().int(),
  isPublished: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type AnimeEpisodeContract = z.infer<typeof AnimeEpisodeSchema>;

/** Épisode enrichi de ses sources actives (détail série / lecteur). */
export const AnimeEpisodeWithSourcesSchema = AnimeEpisodeSchema.extend({
  sources: z.array(AnimeEpisodeSourceSchema),
});
export type AnimeEpisodeWithSources = z.infer<typeof AnimeEpisodeWithSourcesSchema>;

/** Série + ses épisodes publiés (page de détail `/anime/[slug]`). */
export const AnimeSeriesDetailSchema = AnimeSeriesSchema.extend({
  episodes: z.array(AnimeEpisodeWithSourcesSchema),
});
export type AnimeSeriesDetail = z.infer<typeof AnimeSeriesDetailSchema>;

// ---- Query ----

export const AnimeListQuerySchema = z.object({
  generation: AnimeGenerationSchema.optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type AnimeListQuery = z.infer<typeof AnimeListQuerySchema>;

export const AnimeSearchQuerySchema = z.object({
  q: z.string().min(1),
});
export type AnimeSearchQuery = z.infer<typeof AnimeSearchQuerySchema>;

// ---- Responses ----

export const AnimeSeriesListResponseSchema = z.object({
  series: z.array(AnimeSeriesSchema),
});
export type AnimeSeriesListResponse = z.infer<typeof AnimeSeriesListResponseSchema>;

/**
 * Séries regroupées par génération (`{ ORIGINAL: [...], METAL: [...] }`).
 * Clés string libres : seules les générations ayant des séries publiées sont présentes
 * (`z.record(enum, …)` exigerait toutes les clés de l'enum).
 */
export const AnimeSeriesByGenerationResponseSchema = z.object({
  byGeneration: z.record(z.string(), z.array(AnimeSeriesSchema)),
});
export type AnimeSeriesByGenerationResponse = z.infer<typeof AnimeSeriesByGenerationResponseSchema>;

export const AnimeSeriesDetailResponseSchema = z.object({
  series: AnimeSeriesDetailSchema.nullable(),
});
export type AnimeSeriesDetailResponse = z.infer<typeof AnimeSeriesDetailResponseSchema>;

/** Lien minimal de série pour les résultats de recherche d'épisode. */
export const AnimeSeriesRefSchema = z.object({
  slug: z.string(),
  title: z.string(),
});

export const AnimeSearchResponseSchema = z.object({
  series: z.array(AnimeSeriesSchema),
  episodes: z.array(
    AnimeEpisodeSchema.extend({
      series: AnimeSeriesRefSchema,
    }),
  ),
});
export type AnimeSearchResponse = z.infer<typeof AnimeSearchResponseSchema>;
