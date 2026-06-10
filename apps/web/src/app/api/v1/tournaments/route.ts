import { TournamentsQuerySchema, TournamentsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listTournamentCards } from "@/server/dal/tournaments";

export const GET = getRoute({
  query: TournamentsQuerySchema,
  response: TournamentsListResponseSchema,
  async handle({ query }) {
    return listTournamentCards({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  },
});
