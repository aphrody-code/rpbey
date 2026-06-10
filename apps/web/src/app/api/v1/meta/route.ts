import { MetaResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getEnrichedMeta } from "@/server/services/meta";

export const GET = getRoute({
  response: MetaResponseSchema,
  async handle() {
    return { data: await getEnrichedMeta() };
  },
});
