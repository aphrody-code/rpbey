import { PollsListQuerySchema, PollsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listPolls } from "@/server/dal/polls";

export const GET = getRoute({
  query: PollsListQuerySchema,
  response: PollsListResponseSchema,
  async handle({ query }) {
    return listPolls(query);
  },
});
