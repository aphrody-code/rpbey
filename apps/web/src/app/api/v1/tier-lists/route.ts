import { TierListsListQuerySchema, TierListsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listTierLists } from "@/server/dal/polls";

export const GET = getRoute({
  query: TierListsListQuerySchema,
  response: TierListsListResponseSchema,
  async handle({ query }) {
    return listTierLists(query);
  },
});
