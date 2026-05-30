import { TierListsListQuerySchema, TierListsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listTierLists } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: TierListsListQuerySchema,
  response: TierListsListResponseSchema,
  async handle({ query }) {
    return listTierLists(query);
  },
});
