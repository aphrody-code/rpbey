import { GachaCardsQuerySchema, GachaCardsResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getGachaCards } from "@/server/services/gacha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: GachaCardsQuerySchema,
  response: GachaCardsResponseSchema,
  async handle({ query }) {
    return getGachaCards({
      rarity: query.rarity,
      dropId: query.dropId,
      series: query.series,
      search: query.search,
      activeOnly: query.activeOnly,
      limit: query.limit,
    });
  },
});
