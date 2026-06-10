import { AnimeFramesQuerySchema, AnimeFramesResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listAnimeFrames } from "@/server/dal/anime";

/**
 * GET /api/v1/anime/frames — galerie publique de frames d'anime (captures fancaps
 * re-hébergées). Filtres : série (slug), épisode, personnage, marquant, recherche.
 * Sert le gacha, les backgrounds, et la recherche « Google Images ».
 */
export const GET = getRoute({
  query: AnimeFramesQuerySchema,
  response: AnimeFramesResponseSchema,
  async handle({ query }) {
    return listAnimeFrames({
      series: query.series,
      episode: query.episode,
      character: query.character,
      notable: query.notable,
      q: query.q,
      limit: query.limit,
      cursor: query.cursor,
    });
  },
});
