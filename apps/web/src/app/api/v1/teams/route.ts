import { TeamsListQuerySchema, TeamsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listTeams } from "@/server/dal/teams";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: TeamsListQuerySchema,
  response: TeamsListResponseSchema,
  async handle({ query }) {
    return listTeams(query);
  },
});
