import { RecommendQuerySchema, RecommendResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getRecommendations } from "@/lib/recommendation-engine";

export const GET = getRoute({
  query: RecommendQuerySchema,
  response: RecommendResponseSchema,
  async handle({ query }) {
    const data = await getRecommendations({
      weights: {
        metaRelevanceWeight: query.metaRelevanceWeight,
        hypeWeight: query.hypeWeight,
        priceEfficiencyWeight: query.priceEfficiencyWeight,
      },
      filters: {
        minMetaRelevance: query.minMetaRelevance,
        minHypeScore: query.minHypeScore,
        minPriceEfficiency: query.minPriceEfficiency,
        maxPriceEur: query.maxPriceEur,
        productType: query.productType,
        productLine: query.productLine,
        availableOnly: query.availableOnly,
      },
    });

    return {
      count: data.length,
      weights: {
        metaRelevanceWeight: query.metaRelevanceWeight ?? 0.5,
        hypeWeight: query.hypeWeight ?? 0.2,
        priceEfficiencyWeight: query.priceEfficiencyWeight ?? 0.3,
      },
      data,
    };
  },
});
