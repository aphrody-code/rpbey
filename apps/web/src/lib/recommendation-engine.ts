import { getPartUsageStats, getPartsAndProducts } from "@/server/dal/recommendations";
import { loadCatalog, computeGroups, groupSlug } from "@/lib/bx-catalog";
import { loadJsonSafe } from "@/lib/data-cache";
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

type Tier = "S" | "A" | "B" | "C";

/** Tier WBO du composant, ou `null` si non répertorié (→ scoring piloté par l'usage). */
function getWboTierMatch(partName: string, partType: string): Tier | null {
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
  return null;
}

function getTierScore(tier: Tier): number {
  switch (tier) {
    case "S":
      return 1.0;
    case "A":
      return 0.78;
    case "B":
      return 0.55;
    case "C":
      return 0.3;
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Courbe d'usage adoucie : `sqrt` comprime le haut et relève le milieu, pour
 * qu'une pièce moyennement jouée ne soit pas écrasée par la plus jouée (linéaire).
 */
function scoreUsage(normUsage: number): number {
  return Math.sqrt(clamp01(normUsage));
}

/** p-ième percentile (0..1) d'un tableau de nombres, robuste aux outliers. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = clamp01(p) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
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

// Cache mémoïsé du résultat "par défaut" (poids/filtres standards) : le scoring
// de ~600 groupes × pièces est coûteux → recalculé au plus 1×/5 min.
let _defaultRecoCache: { at: number; data: RecommendedProduct[] } | null = null;
const RECO_CACHE_TTL_MS = 5 * 60 * 1000;

function isDefaultOptions(o: RecommendationOptions): boolean {
  const w = o.weights;
  const f = o.filters;
  const noWeights =
    !w ||
    (w.metaRelevanceWeight === undefined &&
      w.hypeWeight === undefined &&
      w.priceEfficiencyWeight === undefined);
  const noFilters = !f || Object.values(f).every((v) => v === undefined);
  return noWeights && noFilters;
}

export async function getRecommendations(
  options: RecommendationOptions = {},
): Promise<RecommendedProduct[]> {
  const useCache = isDefaultOptions(options);
  if (useCache && _defaultRecoCache && Date.now() - _defaultRecoCache.at < RECO_CACHE_TTL_MS) {
    return _defaultRecoCache.data;
  }

  // 1. Live database usage stats from deckItems (via DAL).
  const { bladeUsage, ratchetUsage, bitUsage } = await getPartUsageStats();

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

  // 2. Database parts and products (via DAL).
  const { parts: dbParts, products: dbProducts } = await getPartsAndProducts();

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

  // Load Reddit Hype Data if available (via le loader canonique : FS en
  // dev/standalone, fetch CDN sur Vercel — cf. data-cache.ts).
  let redditHypeScores: Record<string, number> = {};
  const hypeReport = await loadJsonSafe<{
    hypeScores?: Record<string, number>;
  }>("data/reddit-hype.json");
  if (hypeReport?.hypeScores) {
    redditHypeScores = hypeReport.hypeScores;
  }

  // 4. Calculate Scores for Each Product Group
  const now = Date.now();
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // ── Index pré-calculés (1×, hors boucle groupes) — élimine le scan O(groupes×pièces). ──
  const dbProductByCode = new Map<string, (typeof dbProducts)[number]>();
  for (const p of dbProducts) dbProductByCode.set(p.code.toUpperCase(), p);

  const ratchetByName = new Map<string, (typeof dbParts)[number]>();
  const bitParts: (typeof dbParts)[number][] = [];
  const longParts: Array<{ part: (typeof dbParts)[number]; norm: string }> = [];
  const shortParts: Array<{ part: (typeof dbParts)[number]; regex: RegExp }> = [];
  for (const part of dbParts) {
    if (!part.name) continue;
    if (part.type === "RATCHET") ratchetByName.set(part.name.toLowerCase(), part);
    if (part.type === "BIT") bitParts.push(part);
    const norm = normalizeForMatch(part.name);
    if (norm.length < 3) {
      shortParts.push({
        part,
        regex: new RegExp(`\\b${escapeRegExp(part.name)}\\b`, "i"),
      });
    } else {
      longParts.push({ part, norm });
    }
  }

  // Analyse méta par pièce, mémoïsée (usage adouci en √, fallback usage si tier non répertorié).
  const partAnalysisById = new Map<string, PartAnalysis>();
  function getPartAnalysis(part: (typeof dbParts)[number]): PartAnalysis {
    const cached = partAnalysisById.get(part.id);
    if (cached) return cached;
    const usage = usageMap.get(part.id) ?? 0;
    const maxUsage =
      part.type === "BLADE"
        ? maxBladeCount
        : part.type === "RATCHET"
          ? maxRatchetCount
          : part.type === "BIT"
            ? maxBitCount
            : 1;
    const normUsage = clamp01(usage / (maxUsage || 1));
    const u = scoreUsage(normUsage);
    const tierMatch = getWboTierMatch(part.name, part.type);
    // Tier répertorié → 55% tier curé + 45% usage ; sinon → piloté par l'usage
    // depuis une base neutre (une pièce non-mappée mais jouée n'est plus écrasée à 0.3).
    const metaScore = tierMatch
      ? clamp01(0.55 * getTierScore(tierMatch) + 0.45 * u)
      : clamp01(0.35 + 0.45 * u);
    const pa: PartAnalysis = {
      id: part.id,
      name: part.name,
      type: part.type,
      usageCount: usage,
      normalizedUsage: normUsage,
      tier: tierMatch ?? "C",
      metaScore,
    };
    partAnalysisById.set(part.id, pa);
    return pa;
  }

  // La hype Reddit est-elle exploitable (variance), ou plate (toutes à 0.5) ?
  const redditActive = new Set(Object.values(redditHypeScores)).size > 1;

  interface ScoredGroup {
    group: BxProductGroup;
    matchedDbProduct: (typeof dbProducts)[number] | null;
    parts: (typeof dbParts)[number][];
    analyzed: PartAnalysis[];
    metaRelevanceScore: number;
    hypeScore: number;
    rawEfficiencyRatio: number;
  }

  const scoredGroups: ScoredGroup[] = [];

  for (const group of productGroups) {
    const title = group.name;

    // A. Match DB product via code (BX/UX/CX-XX) — lookup O(1).
    const codeMatch = title.match(/\b([BUC]X-\d{2,3}[A-Z]?)\b/i);
    const matchedDbProduct =
      (codeMatch?.[1] ? dbProductByCode.get(codeMatch[1].toUpperCase()) : undefined) ?? null;

    // B. Collecte des pièces incluses.
    const matchedPartsMap = new Map<string, (typeof dbParts)[number]>();

    // Depuis les relations du produit DB.
    if (matchedDbProduct?.beyblades) {
      for (const bey of matchedDbProduct.beyblades) {
        if (bey.part_bladeId) matchedPartsMap.set(bey.part_bladeId.id, bey.part_bladeId);
        if (bey.part_ratchetId) matchedPartsMap.set(bey.part_ratchetId.id, bey.part_ratchetId);
        if (bey.part_bitId) matchedPartsMap.set(bey.part_bitId.id, bey.part_bitId);
      }
    }

    // Depuis le code combo du titre (ex. 3-60LF) — ratchet via index, bit via petite liste.
    const comboMatch = title.match(/\b(\d-\d{2})([A-Z]{1,3})\b/i);
    if (comboMatch?.[1] && comboMatch[2]) {
      const rPart = ratchetByName.get(comboMatch[1].toLowerCase());
      if (rPart) matchedPartsMap.set(rPart.id, rPart);
      const bitAbbr = comboMatch[2].toUpperCase();
      const mappedName = BIT_ABBREVIATIONS[bitAbbr]?.toLowerCase();
      for (const p of bitParts) {
        const nameLower = p.name.toLowerCase();
        if (nameLower === bitAbbr.toLowerCase() || (mappedName && nameLower.includes(mappedName))) {
          matchedPartsMap.set(p.id, p);
          break;
        }
      }
    }

    // Substring match via index normalisé pré-calculé (plus de re-normalisation par groupe).
    const titleNorm = normalizeForMatch(title);
    for (const { part, norm } of longParts) {
      if (titleNorm.includes(norm)) matchedPartsMap.set(part.id, part);
    }
    for (const { part, regex } of shortParts) {
      if (regex.test(title)) matchedPartsMap.set(part.id, part);
    }

    const partsList = Array.from(matchedPartsMap.values());

    // C. Meta-relevance — analyse par pièce mémoïsée (getPartAnalysis).
    const analyzedParts = partsList.map(getPartAnalysis);
    let metaRelevanceScore = 0.0;
    if (analyzedParts.length > 0) {
      let maxPartMetaScore = 0.0;
      let sumPartMetaScore = 0.0;
      for (const pa of analyzedParts) {
        if (pa.metaScore > maxPartMetaScore) maxPartMetaScore = pa.metaScore;
        sumPartMetaScore += pa.metaScore;
      }
      const avgPartMetaScore = sumPartMetaScore / analyzedParts.length;
      // 65% meilleur composant (la pièce-clé porte le combo) + 35% qualité moyenne du build.
      metaRelevanceScore = clamp01(0.65 * maxPartMetaScore + 0.35 * avgPartMetaScore);
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

    // Blend Reddit Hype Score if available (weight: 25% Reddit, 30% newness, 30% popularity/shop count, 15% demand)
    // Match sur le code du produit DB, sinon sur le code du groupe catalogue.
    let redditScore = 0.5;
    const hypeCode = (matchedDbProduct?.code ?? group.code)?.toUpperCase();
    if (hypeCode && redditHypeScores[hypeCode] !== undefined) {
      redditScore = redditHypeScores[hypeCode];
    }

    // Hype adaptatif : si la hype Reddit est plate (toutes à 0.5), redistribuer
    // son poids vers nouveauté + popularité plutôt qu'injecter un 0.5 inerte.
    const hypeScore = clamp01(
      redditActive
        ? 0.25 * newness + 0.3 * popularity + 0.15 * demand + 0.3 * redditScore
        : 0.38 * newness + 0.42 * popularity + 0.2 * demand,
    );

    // E. Ratio brut d'efficacité-prix (performance par euro).
    const cheapestPrice = group.cheapestEur ?? 0;
    let rawEfficiencyRatio = 0;
    if (cheapestPrice > 0) {
      let performanceVal = 0.7 * metaRelevanceScore + 0.3 * hypeScore;
      if (analyzedParts.length === 0 && matchedDbProduct) {
        const type = matchedDbProduct.productType;
        if (type === "TOOL" || matchedDbProduct.name.toLowerCase().includes("stadium")) {
          performanceVal = 0.5; // accessoires nécessaires sans pièces → valeur plancher
        }
      }
      rawEfficiencyRatio = performanceVal / cheapestPrice;
    }

    scoredGroups.push({
      group,
      matchedDbProduct,
      parts: partsList,
      analyzed: analyzedParts,
      metaRelevanceScore,
      hypeScore,
      rawEfficiencyRatio,
    });
  }

  // 5. Normalisation robuste de l'efficacité-prix : référence = 90ᵉ percentile des
  // ratios (résiste aux outliers ultra-cheap qui écrasaient tout en min-max), puis √
  // pour étaler le bas de gamme. Un ratio ≥ p90 → score 1.
  const positiveRatios = scoredGroups
    .map((s) => s.rawEfficiencyRatio)
    .filter((r) => r > 0)
    .sort((a, b) => a - b);
  const p90Ratio = percentile(positiveRatios, 0.9) || 0.0001;

  const finalRecommendations: RecommendedProduct[] = [];

  const metaRelevanceWeight = options.weights?.metaRelevanceWeight ?? 0.5;
  const hypeWeight = options.weights?.hypeWeight ?? 0.2;
  const priceEfficiencyWeight = options.weights?.priceEfficiencyWeight ?? 0.3;

  for (const sg of scoredGroups) {
    const cheapestPrice = sg.group.cheapestEur;
    if (cheapestPrice === null) continue;

    const priceEfficiencyScore = clamp01(Math.sqrt(sg.rawEfficiencyRatio / p90Ratio));

    // Calculate Overall Score
    const overallScore =
      metaRelevanceWeight * sg.metaRelevanceScore +
      hypeWeight * sg.hypeScore +
      priceEfficiencyWeight * priceEfficiencyScore;

    // PartAnalysis : réutilise l'analyse pré-calculée (cohérence + zéro recompute).
    const includedParts: PartAnalysis[] = sg.analyzed;

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
      slug: sg.group.slug ?? groupSlug(sg.group),
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
        const dbType = dbProductByCode.get(r.code?.toUpperCase() ?? "")?.productType;
        return dbType?.toUpperCase() === filters.productType!.toUpperCase();
      });
    }
    if (filters.productLine !== undefined) {
      filtered = filtered.filter((r) => {
        const dbLine = dbProductByCode.get(r.code?.toUpperCase() ?? "")?.productLine;
        return dbLine?.toUpperCase() === filters.productLine!.toUpperCase();
      });
    }
    if (filters.availableOnly) {
      filtered = filtered.filter((r) => r.offers.some((o) => o.available));
    }
  }

  // 7. Sort by Overall Score descending
  const result = filtered.sort((a, b) => b.overallScore - a.overallScore);
  if (useCache) _defaultRecoCache = { at: Date.now(), data: result };
  return result;
}
