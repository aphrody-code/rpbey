import { z } from "zod";

// ── Offres / produits du catalogue ───────────────────────────────

export const BxOfferSchema = z.object({
  shop: z.string(),
  domain: z.string(),
  region: z.string(),
  type: z.string(),
  title: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  priceEur: z.number().nullable(),
  available: z.boolean(),
  url: z.string(),
  image: z.string().nullable(),
});
export type BxOffer = z.infer<typeof BxOfferSchema>;

export const PartTierSchema = z.enum(["S", "A", "B", "C"]);

export const PartAnalysisSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  usageCount: z.number(),
  normalizedUsage: z.number(),
  tier: PartTierSchema,
  metaScore: z.number(),
});
export type PartAnalysis = z.infer<typeof PartAnalysisSchema>;

export const RecommendedProductSchema = z.object({
  key: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  cheapestEur: z.number().nullable(),
  shopCount: z.number(),
  imageUrl: z.string().nullable(),
  offers: z.array(BxOfferSchema),
  metaRelevanceScore: z.number(),
  hypeScore: z.number(),
  priceEfficiencyScore: z.number(),
  overallScore: z.number(),
  includedParts: z.array(PartAnalysisSchema),
  classifications: z.array(z.string()),
});
export type RecommendedProduct = z.infer<typeof RecommendedProductSchema>;

// ── Requête /v1/recommend (query string, valeurs coercées) ───────

const weight = z.coerce.number().min(0).max(1).optional();
const score01 = z.coerce.number().min(0).max(1).optional();

export const RecommendQuerySchema = z.object({
  metaRelevanceWeight: weight,
  hypeWeight: weight,
  priceEfficiencyWeight: weight,
  minMetaRelevance: score01,
  minHypeScore: score01,
  minPriceEfficiency: score01,
  maxPriceEur: z.coerce.number().positive().optional(),
  productType: z.string().optional(),
  productLine: z.string().optional(),
  availableOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type RecommendQuery = z.infer<typeof RecommendQuerySchema>;

export const RecommendResponseSchema = z.object({
  count: z.number(),
  weights: z.object({
    metaRelevanceWeight: z.number(),
    hypeWeight: z.number(),
    priceEfficiencyWeight: z.number(),
  }),
  data: z.array(RecommendedProductSchema),
});
export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;

// ── /v1/search (recherche globale) ───────────────────────────────

export const SearchCategorySchema = z.enum([
  "product",
  "part",
  "tournament",
  "blader",
  "lexicon",
  "combo",
  "anime",
  "site",
  "page",
]);
export type SearchCategory = z.infer<typeof SearchCategorySchema>;

export const GlobalSearchItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: SearchCategorySchema,
  url: z.string(),
  details: z.string().optional(),
  badge: z.string().optional(),
  price: z.number().nullable().optional(),
  /** Score de pertinence (présent uniquement sur une réponse triée par requête). */
  score: z.number().optional(),
});
export type GlobalSearchItem = z.infer<typeof GlobalSearchItemSchema>;

export const SearchResponseSchema = z.object({
  count: z.number(),
  data: z.array(GlobalSearchItemSchema),
  /** Requête appliquée côté serveur (absent = index complet non filtré). */
  query: z.string().optional(),
  /** Nombre de résultats par catégorie (facettes/onglets). */
  facets: z.record(z.string(), z.number()).optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
