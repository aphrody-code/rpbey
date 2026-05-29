import { GachaDropsResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getGachaDrops } from "@/server/services/gacha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  response: GachaDropsResponseSchema,
  async handle() {
    return getGachaDrops();
  },
});
