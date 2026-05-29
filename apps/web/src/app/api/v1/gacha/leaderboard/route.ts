import { GachaLeaderboardQuerySchema, GachaLeaderboardResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getGachaLeaderboardEntries } from "@/server/services/gacha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: GachaLeaderboardQuerySchema,
  response: GachaLeaderboardResponseSchema,
  async handle({ query }) {
    return getGachaLeaderboardEntries(query.limit);
  },
});
