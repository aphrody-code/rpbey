import { GachaLeaderboardQuerySchema, GachaLeaderboardResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getGachaLeaderboardEntries } from "@/server/services/gacha";

export const GET = getRoute({
  query: GachaLeaderboardQuerySchema,
  response: GachaLeaderboardResponseSchema,
  async handle({ query }) {
    return getGachaLeaderboardEntries(query.limit);
  },
});
