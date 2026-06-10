import { AnimeSeriesByGenerationResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listSeriesByGeneration } from "@/server/dal/anime";

export const GET = getRoute({
  response: AnimeSeriesByGenerationResponseSchema,
  async handle() {
    const byGeneration = await listSeriesByGeneration();
    return { byGeneration };
  },
});
