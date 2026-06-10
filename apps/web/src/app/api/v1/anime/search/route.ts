import { AnimeSearchQuerySchema, AnimeSearchResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { searchPublished } from "@/server/dal/anime";

export const GET = getRoute({
  query: AnimeSearchQuerySchema,
  response: AnimeSearchResponseSchema,
  async handle({ query }) {
    return searchPublished(query.q);
  },
});
