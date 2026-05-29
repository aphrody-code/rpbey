import "server-only";
import { getRecommendations as sdkGetRecommendations } from "@rpbey/api-client";
import {
  getRecommendations as engineGetRecommendations,
  type RecommendationOptions,
  type RecommendedProduct,
} from "@/lib/recommendation-engine";
import { isRemote, unwrap } from "@/server/data-source";

/**
 * Service recommandations — porte le seam DAL↔SDK (`isRemote`) pour le moteur
 * de reco produits (méta-relevance / hype / efficacité-prix).
 *
 * - Co-localisé (VPS) : délègue à `@/lib/recommendation-engine` (logique +
 *   lectures DAL `@/server/dal/recommendations`) → rendu strictement inchangé.
 * - Standalone (Vercel) : lit l'API distante via le SDK généré `@rpbey/api-client`
 *   (`getRecommendations`). L'enveloppe SDK est `{ ok, data: { count, weights, data } }`
 *   (le contrat `RecommendResponse` imbrique le tableau dans son champ `data`) →
 *   on déballe les deux niveaux pour rendre le même `RecommendedProduct[]`.
 *
 * Consommé par les RSC marketing `/comparateur` et `/search`.
 */
export async function getRecommendations(
  options: RecommendationOptions = {},
): Promise<RecommendedProduct[]> {
  if (isRemote) {
    const res = await sdkGetRecommendations({
      query: {
        metaRelevanceWeight: options.weights?.metaRelevanceWeight,
        hypeWeight: options.weights?.hypeWeight,
        priceEfficiencyWeight: options.weights?.priceEfficiencyWeight,
        minMetaRelevance: options.filters?.minMetaRelevance,
        minHypeScore: options.filters?.minHypeScore,
        minPriceEfficiency: options.filters?.minPriceEfficiency,
        maxPriceEur: options.filters?.maxPriceEur,
        productType: options.filters?.productType,
        productLine: options.filters?.productLine,
        availableOnly:
          options.filters?.availableOnly === undefined
            ? undefined
            : options.filters.availableOnly
              ? "true"
              : "false",
      },
    });
    return unwrap(res).data as RecommendedProduct[];
  }
  return engineGetRecommendations(options);
}
