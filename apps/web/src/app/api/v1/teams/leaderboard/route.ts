import { TeamLeaderboardQuerySchema, TeamLeaderboardResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getTeamsLeaderboard } from "@/server/dal/teams";

export const GET = getRoute({
  query: TeamLeaderboardQuerySchema,
  response: TeamLeaderboardResponseSchema,
  async handle({ query }) {
    return { teams: await getTeamsLeaderboard(query.limit) };
  },
});
