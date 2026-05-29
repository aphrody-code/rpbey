import { db, schema, count, isNotNull } from "@/lib/db";
import { loadCatalog, computeGroups } from "@/lib/bx-catalog";
import type { BxProductGroup } from "@/lib/bx-catalog";

// -------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------

export interface RecommendationWeights {
  metaRelevanceWeight?: number;
  hypeWeight?: number;
  priceEfficiencyWeight?: number;
}

export interface RecommendationFilters {
  minMetaRelevance?: number;
  minHypeScore?: number;
  minPriceEfficiency?: number;
  maxPriceEur?: number;
  productType?: string; // e.g. "STARTER", "BOOSTER", "SET", "RANDOM_BOOSTER", "TOOL"
  productLine?: string; // e.g. "BX", "UX", "CX"
  availableOnly?: boolean;
}

export interface RecommendationOptions {
  weights?: RecommendationWeights;
  filters?: RecommendationFilters;
}

export interface PartAnalysis {
  id: string;
  name: string;
  type: string;
  usageCount: number;
  normalizedUsage: number;
  tier: "S" | "A" | "B" | "C";
  metaScore: number;
}

export interface RecommendedProduct {
  key: string;
  code: string | null;
  name: string;
  slug: string;
  cheapestEur: number | null;
  shopCount: number;
  imageUrl: string | null;
  offers: any[];

  // Calculated Scores (0.0 to 1.0)
  metaRelevanceScore: number;
  hypeScore: number;
  priceEfficiencyScore: number;
  overallScore: number;

  // Component & Product Metadata analysis
  includedParts: PartAnalysis[];
  classifications: string[];
}

// -------------------------------------------------------------
// Constants and WBO Meta Mappings
// -------------------------------------------------------------

const WBO_BLADE_TIERS: Record<string, "S" | "A" | "B" | "C"> = {
  "wizard rod": "S",
  "phoenix wing": "S",
  "cobalt dragoon": "S",
  "shark edge": "A",
  "shark scale": "A",
  "dran buster": "A",
  "tyranno beat": "A",
  "hells chain": "A",
  "hells scythe": "B",
  "unicorn sting": "B",
  "weiss tiger": "B",
  "knight shield": "B",
  "dran sword": "B",
  "knight lance": "B",
  "leon claw": "B",
  "viper tail": "B",
};

const WBO_RATCHET_TIERS: Record<string, "S" | "A" | "B" | "C"> = {
  "9-60": "S",
  "5-60": "S",
  "3-60": "A",
  "1-60": "A",
  "7-60": "A",
  "4-60": "B",
  "0-60": "B",
  "3-80": "B",
  "5-80": "B",
};

const WBO_BIT_TIERS: Record<string, "S" | "A" | "B" | "C"> = {
  ball: "S",
  "b (ball)": "S",
  orb: "S",
  "o (orb)": "S",
  hexa: "S",
  "h (hexa)": "S",
  "l (level)": "S",
  level: "S",
  "low rush": "S",
  "lr (low rush)": "S",
  rush: "A",
  "r (rush)": "A",
  flat: "A",
  "f (flat)": "A",
  point: "A",
  "p (point)": "A",
  "gear point": "A",
  "gp (gear point)": "A",
  elevate: "B",
  "e (elevate)": "B",
  needle: "B",
  "n (needle)": "B",
};

const BIT_ABBREVIATIONS: Record<string, string> = {
  F: "Flat",
  LF: "Low Flat",
  B: "Ball",
  O: "Orb",
  HN: "High Needle",
  GP: "Gear Point",
  GF: "Gear Flat",
  DB: "Disc Ball",
  T: "Taper",
  N: "Needle",
  H: "Hexa",
  L: "Level",
  LR: "Low Rush",
  R: "Rush",
  E: "Elevate",
  K: "Kick",
  P: "Point",
  U: "Unite",
  M: "Metal",
  Q: "Quake",
  S: "Savage",
  C: "Charge",
  A: "Assault",
  D: "Dual",
  G: "Guard",
};

// -------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------

function getWboTier(partName: string, partType: string): "S" | "A" | "B" | "C" {
  const nameLower = partName.toLowerCase();
  const tiersMap =
    partType === "BLADE"
      ? WBO_BLADE_TIERS
      : partType === "RATCHET"
        ? WBO_RATCHET_TIERS
        : partType === "BIT"
          ? WBO_BIT_TIERS
          : {};

  for (const [key, tier] of Object.entries(tiersMap)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return tier;
    }
  }
  return "C";
}

function getTierScore(tier: "S" | "A" | "B" | "C"): number {
  switch (tier) {
    case "S":
      return 1.0;
    case "A":
      return 0.75;
    case "B":
      return 0.5;
    case "C":
      return 0.2;
  }
}

function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------------------------------------------------------------
// Main Recommendation Library
// -------------------------------------------------------------

export async function getRecommendations(
  options: RecommendationOptions = {},
): Promise<RecommendedProduct[]> {
  // 1. Fetch live database usage stats from deckItems
  const [bladeUsage, ratchetUsage, bitUsage] = await Promise.all([
    db
      .select({ id: schema.deckItems.bladeId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bladeId))
      .groupBy(schema.deckItems.bladeId),
    db
      .select({ id: schema.deckItems.ratchetId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.ratchetId))
      .groupBy(schema.deckItems.ratchetId),
    db
      .select({ id: schema.deckItems.bitId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bitId))
      .groupBy(schema.deckItems.bitId),
  ]);

  const usageMap = new Map<string, number>();
  let maxBladeCount = 1;
  let maxRatchetCount = 1;
  let maxBitCount = 1;

  for (const row of bladeUsage) {
    if (row.id) {
      usageMap.set(row.id, row.count);
      if (row.count > maxBladeCount) maxBladeCount = row.count;
    }
  }
  for (const row of ratchetUsage) {
    if (row.id) {
      usageMap.set(row.id, row.count);
      if (row.count > maxRatchetCount) maxRatchetCount = row.count;
    }
  }
  for (const row of bitUsage) {
    if (row.id) {
      usageMap.set(row.id, row.count);
      if (row.count > maxBitCount) maxBitCount = row.count;
    }
  }

  // 2. Fetch database parts and products
  const [dbParts, dbProducts] = await Promise.all([
    db.query.parts.findMany(),
    db.query.products.findMany({
      with: {
        beyblades: {
          with: {
            part_bladeId: true,
            part_ratchetId: true,
            part_bitId: true,
          },
        },
      },
    }),
  ]);

  // 3. Load product catalog
  const catalog = await loadCatalog();
  if (!catalog) {
    return [];
  }

  // Group catalog items (use minShops = 1 to keep all items)
  const productGroups = computeGroups(catalog, 1);
  let maxShopCountInCatalog = 1;
  for (const group of productGroups) {
    if (group.shopCount > maxShopCountInCatalog) {
      maxShopCountInCatalog = group.shopCount;
    }
  }

  // 4. Calculate Scores for Each Product Group
  const now = new Date("2026-05-29T00:00:00Z").getTime();
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  interface ScoredGroup {
    group: BxProductGroup;
    matchedDbProduct: any | null;
    parts: any[];
    metaRelevanceScore: number;
    hypeScore: number;
    rawEfficiencyRatio: number;
  }

  const scoredGroups: ScoredGroup[] = [];

  for (const group of productGroups) {
    const title = group.name;

    // A. Find matched database product via code (BX-XX, UX-XX, CX-XX)
    const codeMatch = title.match(/\b([BUC]X-\d{2,3}[A-Z]?)\b/i);
    let matchedDbProduct = null;
    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].toUpperCase();
      matchedDbProduct = dbProducts.find((p) => p.code.toUpperCase() === code);
    }

    // B. Match parts included in product
    const matchedPartsMap = new Map<string, any>();

    // From DB product relations
    if (matchedDbProduct && matchedDbProduct.beyblades) {
      for (const bey of matchedDbProduct.beyblades) {
        if (bey.part_bladeId) matchedPartsMap.set(bey.part_bladeId.id, bey.part_bladeId);
        if (bey.part_ratchetId) matchedPartsMap.set(bey.part_ratchetId.id, bey.part_ratchetId);
        if (bey.part_bitId) matchedPartsMap.set(bey.part_bitId.id, bey.part_bitId);
      }
    }

    // Extract from title via combo codes (e.g. 3-60LF or 9-60B)
    const comboMatch = title.match(/\b(\d-\d{2})([A-Z]{1,3})\b/i);
    if (comboMatch && comboMatch[1] && comboMatch[2]) {
      const ratchetName = comboMatch[1];
      const bitAbbr = comboMatch[2].toUpperCase();

      const rPart = dbParts.find(
        (p) => p.type === "RATCHET" && p.name.toLowerCase() === ratchetName.toLowerCase(),
      );
      if (rPart) matchedPartsMap.set(rPart.id, rPart);

      const bPart = dbParts.find((p) => {
        if (p.type !== "BIT") return false;
        const nameLower = p.name.toLowerCase();
        if (nameLower === bitAbbr.toLowerCase()) return true;
        const mappedName = BIT_ABBREVIATIONS[bitAbbr];
        if (mappedName && nameLower.includes(mappedName.toLowerCase())) return true;
        return false;
      });
      if (bPart) matchedPartsMap.set(bPart.id, bPart);
    }

    // Substring match on part name (with alphanumeric normalization)
    const titleNorm = normalizeForMatch(title);
    for (const part of dbParts) {
      if (!part.name) continue;
      const partNameNorm = normalizeForMatch(part.name);

      if (partNameNorm.length < 3) {
        // Avoid false matching of short names unless they are exact word boundaries
        const regex = new RegExp(`\\b${escapeRegExp(part.name)}\\b`, "i");
        if (regex.test(title)) {
          matchedPartsMap.set(part.id, part);
        }
      } else {
        if (titleNorm.includes(partNameNorm)) {
          matchedPartsMap.set(part.id, part);
        }
      }
    }

    const partsList = Array.from(matchedPartsMap.values());

    // C. Calculate Meta Relevance Score (S_meta)
    let metaRelevanceScore = 0.0;
    if (partsList.length > 0) {
      let maxPartMetaScore = 0.0;
      let sumPartMetaScore = 0.0;

      for (const part of partsList) {
        const usage = usageMap.get(part.id) ?? 0;
        const maxUsage =
          part.type === "BLADE"
            ? maxBladeCount
            : part.type === "RATCHET"
              ? maxRatchetCount
              : part.type === "BIT"
                ? maxBitCount
                : 1;

        const normUsage = usage / (maxUsage || 1);
        const tier = getWboTier(part.name, part.type);
        const tierScore = getTierScore(tier);

        // Hybrid metric: 50% database usage popularity + 50% WBO tier classification
        const partMetaScore = 0.5 * normUsage + 0.5 * tierScore;

        if (partMetaScore > maxPartMetaScore) {
          maxPartMetaScore = partMetaScore;
        }
        sumPartMetaScore += partMetaScore;
      }

      const avgPartMetaScore = sumPartMetaScore / partsList.length;

      // Product meta relevance is determined primarily by its strongest component (70%)
      // and secondarily by its overall build quality average (30%)
      metaRelevanceScore = 0.7 * maxPartMetaScore + 0.3 * avgPartMetaScore;
    }

    // D. Calculate Hype Factor Score (S_hype)
    let newness = 0.5;
    if (matchedDbProduct && matchedDbProduct.releaseDate) {
      const releaseTime = new Date(matchedDbProduct.releaseDate).getTime();
      const ageMs = now - releaseTime;
      newness = Math.max(0, Math.min(1, 1 - ageMs / ONE_YEAR_MS));
    }

    const popularity = group.shopCount / (maxShopCountInCatalog || 1);

    let demand = 0.5;
    if (matchedDbProduct) {
      if (matchedDbProduct.isLimited) demand += 0.3;
      if (matchedDbProduct.productType === "SET") demand += 0.2;
      if (matchedDbProduct.productType === "RANDOM_BOOSTER") demand += 0.1;
      if (demand > 1.0) demand = 1.0;
    }

    const hypeScore = 0.4 * newness + 0.4 * popularity + 0.2 * demand;

    // E. Calculate Raw Price Efficiency Ratio
    const cheapestPrice = group.cheapestEur ?? 0;
    let rawEfficiencyRatio = 0;
    if (cheapestPrice > 0) {
      // Set high baseline performance for non-beyblade items like launcher grips, stadiums, etc.
      let performanceVal = 0.7 * metaRelevanceScore + 0.3 * hypeScore;
      if (partsList.length === 0 && matchedDbProduct) {
        const type = matchedDbProduct.productType;
        if (type === "TOOL" || matchedDbProduct.name.toLowerCase().includes("stadium")) {
          performanceVal = 0.5; // Accessories are necessary but won't have parts, give them a baseline value
        }
      }
      rawEfficiencyRatio = performanceVal / cheapestPrice;
    }

    scoredGroups.push({
      group,
      matchedDbProduct,
      parts: partsList,
      metaRelevanceScore,
      hypeScore,
      rawEfficiencyRatio,
    });
  }

  // 5. Min-Max Normalize the Price Efficiency Score
  let maxRatio = 0.0001;
  let minRatio = Infinity;
  for (const sg of scoredGroups) {
    if (sg.rawEfficiencyRatio > maxRatio) maxRatio = sg.rawEfficiencyRatio;
    if (sg.rawEfficiencyRatio < minRatio) minRatio = sg.rawEfficiencyRatio;
  }

  const finalRecommendations: RecommendedProduct[] = [];

  const metaRelevanceWeight = options.weights?.metaRelevanceWeight ?? 0.5;
  const hypeWeight = options.weights?.hypeWeight ?? 0.2;
  const priceEfficiencyWeight = options.weights?.priceEfficiencyWeight ?? 0.3;

  for (const sg of scoredGroups) {
    const cheapestPrice = sg.group.cheapestEur;
    if (cheapestPrice === null) continue;

    // Normalize price efficiency score between 0.0 and 1.0
    let priceEfficiencyScore = 0.0;
    if (maxRatio > minRatio) {
      priceEfficiencyScore = (sg.rawEfficiencyRatio - minRatio) / (maxRatio - minRatio);
    } else {
      priceEfficiencyScore = 0.5;
    }

    // Calculate Overall Score
    const overallScore =
      metaRelevanceWeight * sg.metaRelevanceScore +
      hypeWeight * sg.hypeScore +
      priceEfficiencyWeight * priceEfficiencyScore;

    // Construct PartAnalysis details
    const includedParts: PartAnalysis[] = sg.parts.map((part) => {
      const usage = usageMap.get(part.id) ?? 0;
      const maxUsage =
        part.type === "BLADE"
          ? maxBladeCount
          : part.type === "RATCHET"
            ? maxRatchetCount
            : part.type === "BIT"
              ? maxBitCount
              : 1;

      const normUsage = usage / (maxUsage || 1);
      const tier = getWboTier(part.name, part.type);
      const tierScore = getTierScore(tier);
      const partMetaScore = 0.5 * normUsage + 0.5 * tierScore;

      return {
        id: part.id,
        name: part.name,
        type: part.type,
        usageCount: usage,
        normalizedUsage: normUsage,
        tier,
        metaScore: partMetaScore,
      };
    });

    // F. Classify products using multi-criteria thresholds
    const classifications: string[] = [];

    if (sg.metaRelevanceScore >= 0.7 && priceEfficiencyScore >= 0.5) {
      classifications.push("Competitive Pick");
    }
    if (sg.hypeScore >= 0.7) {
      classifications.push("Hype / New Release");
    }
    if (priceEfficiencyScore >= 0.75 && cheapestPrice < 25) {
      classifications.push("Budget / Great Value");
    }
    if (sg.matchedDbProduct?.isLimited) {
      classifications.push("Collector Choice");
    }
    if (sg.matchedDbProduct?.productType === "STARTER" && sg.metaRelevanceScore >= 0.4) {
      classifications.push("Starter Pick");
    }
    if (
      sg.matchedDbProduct?.productType === "TOOL" ||
      sg.group.name.toLowerCase().includes("stadium") ||
      sg.group.name.toLowerCase().includes("grip")
    ) {
      classifications.push("Essential Accessory");
    }

    finalRecommendations.push({
      key: sg.group.key,
      code: sg.matchedDbProduct?.code ?? sg.group.code ?? null,
      name: sg.group.name,
      slug: sg.group.slug ?? "",
      cheapestEur: cheapestPrice,
      shopCount: sg.group.shopCount,
      imageUrl: sg.group.cheapest?.image ?? null,
      offers: sg.group.offers,
      metaRelevanceScore: sg.metaRelevanceScore,
      hypeScore: sg.hypeScore,
      priceEfficiencyScore,
      overallScore,
      includedParts,
      classifications,
    });
  }

  // 6. Apply filters
  let filtered = finalRecommendations;

  const filters = options.filters;
  if (filters) {
    if (filters.minMetaRelevance !== undefined) {
      filtered = filtered.filter((r) => r.metaRelevanceScore >= filters.minMetaRelevance!);
    }
    if (filters.minHypeScore !== undefined) {
      filtered = filtered.filter((r) => r.hypeScore >= filters.minHypeScore!);
    }
    if (filters.minPriceEfficiency !== undefined) {
      filtered = filtered.filter((r) => r.priceEfficiencyScore >= filters.minPriceEfficiency!);
    }
    if (filters.maxPriceEur !== undefined) {
      filtered = filtered.filter(
        (r) => r.cheapestEur !== null && r.cheapestEur <= filters.maxPriceEur!,
      );
    }
    if (filters.productType !== undefined) {
      filtered = filtered.filter((r) => {
        const dbType = dbProducts.find(
          (p) => p.code.toUpperCase() === r.code?.toUpperCase(),
        )?.productType;
        return dbType?.toUpperCase() === filters.productType!.toUpperCase();
      });
    }
    if (filters.productLine !== undefined) {
      filtered = filtered.filter((r) => {
        const dbLine = dbProducts.find(
          (p) => p.code.toUpperCase() === r.code?.toUpperCase(),
        )?.productLine;
        return dbLine?.toUpperCase() === filters.productLine!.toUpperCase();
      });
    }
    if (filters.availableOnly) {
      filtered = filtered.filter((r) => r.offers.some((o) => o.available));
    }
  }

  // 7. Sort by Overall Score descending
  return filtered.sort((a, b) => b.overallScore - a.overallScore);
}
