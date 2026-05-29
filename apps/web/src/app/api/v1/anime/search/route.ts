import { AnimeSearchQuerySchema, AnimeSearchResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { searchPublished } from "@/server/dal/anime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: AnimeSearchQuerySchema,
  response: AnimeSearchResponseSchema,
  async handle({ query }) {
    return searchPublished(query.q);
  },
});
