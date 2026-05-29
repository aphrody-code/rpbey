import { SearchResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { buildGlobalSearchIndex } from "@/server/services/global-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  response: SearchResponseSchema,
  async handle() {
    const items = await buildGlobalSearchIndex();
    return { count: items.length, data: items };
  },
});
