import "server-only";
import {
  getAnimeSeries as sdkGetAnimeSeries,
  listAnimeSeries as sdkListAnimeSeries,
  listAnimeSeriesByGeneration as sdkListAnimeSeriesByGeneration,
} from "@rpbey/api-client";
import { isRemote, unwrap } from "@/server/data-source";
import {
  type AnimeFramesFilter,
  getSeriesBySlug,
  listAnimeFrames,
  listFeaturedSeries,
  listSeriesByGeneration,
} from "@/server/dal/anime";

/**
 * Service anime — orchestration DAL ↔ SDK derrière le seam `isRemote`.
 * UI-agnostic. En mode co-localisé (VPS) tape la DAL (chemin identique à l'ancien
 * accès inline RSC, iso-comportement exact) ; en standalone (Vercel) lit l'API
 * distante (`/api/v1/anime*`) via le SDK généré.
 *
 * Type de retour = forme DAL (canonique, ce que les composants consomment déjà).
 * La branche SDK (dormante tant que `API_BASE` n'est pas défini) renvoie la même
 * forme contrat ; on la coerce (`as`) vers la forme DAL : seule différence connue,
 * `null` côté DAL vs `null | undefined` côté contrat (nullish) — sans incidence
 * d'affichage, et l'artefact Drizzle `enableRLS` n'est jamais lu par l'UI.
 */

type FeaturedSeries = Awaited<ReturnType<typeof listFeaturedSeries>>;
type SeriesByGeneration = Awaited<ReturnType<typeof listSeriesByGeneration>>;
type SeriesDetail = Awaited<ReturnType<typeof getSeriesBySlug>>;

/**
 * Séries vedettes (publiées + bannière), pour le hero `/anime`.
 *
 * Co-localisé : `listFeaturedSeries()` (DAL, iso). Standalone : `/api/v1/anime?featured=true`
 * (la route sert exactement `listFeaturedSeries` ; même forme, timestamps ISO).
 */
export async function getFeaturedSeries(): Promise<FeaturedSeries> {
  if (isRemote) {
    const { series } = unwrap(await sdkListAnimeSeries({ query: { featured: "true" } }));
    return series as unknown as FeaturedSeries;
  }
  return listFeaturedSeries();
}

/**
 * Séries publiées regroupées par génération (carrousels `/anime`).
 *
 * Co-localisé : `listSeriesByGeneration()` (DAL, iso). Standalone : `/api/v1/anime/by-generation`
 * (la route sert exactement `listSeriesByGeneration` ; même map `{ GEN: Series[] }`).
 */
export async function getSeriesByGeneration(): Promise<SeriesByGeneration> {
  if (isRemote) {
    const { byGeneration } = unwrap(await sdkListAnimeSeriesByGeneration());
    return byGeneration as unknown as SeriesByGeneration;
  }
  return listSeriesByGeneration();
}

/**
 * Détail d'une série par slug (épisodes publiés + sources actives), ou `null`.
 *
 * Co-localisé : `getSeriesBySlug(slug)` (DAL, iso). Standalone : `/api/v1/anime/{slug}`
 * (la route sert exactement `getSeriesBySlug` ; même forme `{ ...series, episodes }`).
 */
export async function getSeriesDetail(slug: string): Promise<SeriesDetail> {
  if (isRemote) {
    const { series } = unwrap(await sdkGetAnimeSeries({ path: { slug } }));
    return (series ?? null) as unknown as SeriesDetail;
  }
  return getSeriesBySlug(slug);
}

/**
 * Galerie de frames d'anime (captures fancaps re-hébergées en PNG lossless),
 * filtrable série/épisode/personnage/marquant. Sert la galerie « Google Images »
 * + le gacha. Co-localisé : DAL `listAnimeFrames`. La branche SDK
 * (`/api/v1/anime/frames`) sera branchée après `bun run gen:api`.
 */
export async function getAnimeFrames(filter: AnimeFramesFilter) {
  return listAnimeFrames(filter);
}
