import { AnimeListQuerySchema, AnimeSeriesListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listFeaturedSeries, listPublishedSeries } from "@/server/dal/anime";

export const GET = getRoute({
  query: AnimeListQuerySchema,
  response: AnimeSeriesListResponseSchema,
  async handle({ query }) {
    const series = query.featured ? await listFeaturedSeries() : await listPublishedSeries();
    const filtered = query.generation
      ? series.filter((s) => s.generation === query.generation)
      : series;
    return { series: filtered };
  },
});
