import { RankingsListResponseSchema, RankingsQuerySchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getRankings } from "@/server/services/rankings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: RankingsQuerySchema,
  response: RankingsListResponseSchema,
  async handle({ query }) {
    return getRankings(query);
  },
});
