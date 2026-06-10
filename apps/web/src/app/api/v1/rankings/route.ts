import { RankingsListResponseSchema, RankingsQuerySchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getRankings } from "@/server/services/rankings";

export const GET = getRoute({
  query: RankingsQuerySchema,
  response: RankingsListResponseSchema,
  async handle({ query }) {
    return getRankings(query);
  },
});
