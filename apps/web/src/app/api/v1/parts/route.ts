import { PartsQuerySchema, PartsListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listPublicParts } from "@/server/dal/parts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: PartsQuerySchema,
  response: PartsListResponseSchema,
  async handle({ query }) {
    return listPublicParts({
      search: query.search,
      type: query.type as never,
      systems: query.systems,
      spin: query.spin,
      beyTypes: query.beyTypes,
      page: query.page,
      pageSize: query.pageSize,
    });
  },
});
