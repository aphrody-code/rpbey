import "server-only";
import type { EnrichedCombo } from "@rpbey/api-contract";
import { canonicalKey, lookupTier, type Tier } from "@/lib/beyblade-entity";
import { type BxProductGroup, computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { loadJsonSafe } from "@/lib/data-cache";
import { vectorNeighborsById } from "@/server/services/embeddings";

/**
 * Graphe d'entités Beyblade — **jointure runtime** qui réunit, autour d'une même
 * entité (une blade / un produit), les faits éparpillés dans le corpus :
 *   - son **tier** méta (table canonique partagée),
 *   - son **score méta** WBO (`bbx-weekly`),
 *   - son **buzz communautaire** (`meta-enrichment` : X + Reddit + web),
 *   - ses **meilleurs combos gagnants** (`wbo-combos-enriched`),
 *   - ses **produits sémantiquement proches** (voisins du vecteur dense).
 *
 * C'est le moteur du « site plus intelligent » : la page produit, demain le
 * builder et la méta, consomment cette vue unifiée plutôt que de re-joindre à la
 * main. Tous les index sources sont mémoïsés au niveau module (chargés ≤ 1×/process,
 * comme le catalogue) ; chaque branche dégrade proprement (absente → vide/null).
 */

export interface CommunityIntel {
  score: number;
  xEngagement: number;
  redditScore: number;
  xMentions: number;
  redditPosts: number;
}

export interface RelatedProduct {
  slug: string;
  name: string;
  code: string | null;
  cheapestEur: number | null;
  imageUrl: string | null;
  similarity: number;
}

export interface ProductIntel {
  /** Nom de la blade détectée dans le titre du produit (ou `null`). */
  blade: string | null;
  tier: Tier | null;
  /** Score méta WBO de la blade (0-100). */
  metaScore: number | null;
  community: CommunityIntel | null;
  /** Meilleurs combos gagnants contenant cette blade (triés par qualité). */
  topCombos: EnrichedCombo[];
  /** Produits proches (voisins denses), résolus en groupes catalogue. */
  related: RelatedProduct[];
}

// ── Index mémoïsés (combos enrichis, méta, communauté) ──────────────────────────

let _comboIdx: Promise<Map<string, EnrichedCombo[]>> | null = null;
let _metaIdx: Promise<Map<string, number>> | null = null;
let _communityIdx: Promise<Map<string, CommunityIntel>> | null = null;

/** combos enrichis groupés par clé canonique de blade, triés qualité décroissante. */
function comboIndex(): Promise<Map<string, EnrichedCombo[]>> {
  _comboIdx ??= (async () => {
    const data = await loadJsonSafe<{ combos?: EnrichedCombo[] }>("data/wbo-combos-enriched.json");
    const map = new Map<string, EnrichedCombo[]>();
    for (const c of data?.combos ?? []) {
      const arr = map.get(c.bladeKey);
      if (arr) arr.push(c);
      else map.set(c.bladeKey, [c]);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.qualityScore - a.qualityScore);
    return map;
  })();
  return _comboIdx;
}

/** score méta WBO (toutes catégories) par clé canonique de composant. */
function metaIndex(): Promise<Map<string, number>> {
  _metaIdx ??= (async () => {
    const data = await loadJsonSafe<{
      periods?: Record<
        string,
        {
          categories?: Array<{
            components?: Array<{ name?: string; score?: number }>;
          }>;
        }
      >;
    }>("data/bbx-weekly.json");
    const period = data?.periods?.["4weeks"] ?? data?.periods?.["2weeks"];
    const map = new Map<string, number>();
    for (const cat of period?.categories ?? []) {
      for (const comp of cat.components ?? []) {
        const k = canonicalKey(comp.name);
        if (k && typeof comp.score === "number" && !map.has(k)) map.set(k, comp.score);
      }
    }
    return map;
  })();
  return _metaIdx;
}

/** signaux communautaires par clé canonique de blade. */
function communityIndex(): Promise<Map<string, CommunityIntel>> {
  _communityIdx ??= (async () => {
    const data = await loadJsonSafe<{
      blades?: Array<{
        name?: string;
        xMentions?: number;
        xEngagement?: number;
        redditPosts?: number;
        redditScore?: number;
        communityScore?: number;
      }>;
    }>("data/meta-enrichment.json");
    const map = new Map<string, CommunityIntel>();
    for (const b of data?.blades ?? []) {
      const k = canonicalKey(b.name);
      if (!k) continue;
      map.set(k, {
        score: Math.round(b.communityScore ?? 0),
        xEngagement: b.xEngagement ?? 0,
        redditScore: b.redditScore ?? 0,
        xMentions: b.xMentions ?? 0,
        redditPosts: b.redditPosts ?? 0,
      });
    }
    return map;
  })();
  return _communityIdx;
}

// ── Détection de la blade d'un produit + résolution des voisins ─────────────────

let _groupsById: Promise<Map<string, BxProductGroup>> | null = null;

function groupsById(): Promise<Map<string, BxProductGroup>> {
  _groupsById ??= (async () => {
    const catalog = await loadCatalog();
    const map = new Map<string, BxProductGroup>();
    if (catalog) for (const g of computeGroups(catalog)) map.set(g.key, g);
    return map;
  })();
  return _groupsById;
}

/**
 * Détecte la blade canonique présente dans le titre d'un groupe produit : on
 * cherche, parmi les blades connues (combos enrichis), la plus longue clé qui est
 * sous-chaîne de la clé canonique du titre. Renvoie sa clé + son nom d'affichage.
 */
async function detectBlade(group: BxProductGroup): Promise<{ key: string; name: string } | null> {
  const titleKey = canonicalKey(group.name);
  if (!titleKey) return null;
  const combos = await comboIndex();
  let bestKey: string | null = null;
  let bestName = "";
  let bestLen = 0;
  for (const [bladeKey, arr] of combos) {
    if (bladeKey.length > bestLen && titleKey.includes(bladeKey)) {
      bestKey = bladeKey;
      bestLen = bladeKey.length;
      bestName = arr[0]?.blade ?? "";
    }
  }
  return bestKey ? { key: bestKey, name: bestName } : null;
}

/**
 * Intel unifiée d'un produit : tier + score méta + buzz + top combos + produits
 * proches. Best-effort — chaque branche peut être vide sans casser les autres.
 */
export async function getProductIntel(group: BxProductGroup): Promise<ProductIntel> {
  const [combos, meta, community] = await Promise.all([
    comboIndex(),
    metaIndex(),
    communityIndex(),
  ]);

  const detected = await detectBlade(group);
  const bladeKey = detected?.key ?? canonicalKey(group.name);

  const topCombos = (combos.get(bladeKey) ?? []).slice(0, 6);
  const metaScore = meta.get(bladeKey) ?? null;
  const communityIntel = community.get(bladeKey) ?? null;
  const tier =
    (detected ? lookupTier(detected.name, "BLADE") : null) ??
    topCombos[0]?.tier ??
    (metaScore != null
      ? metaScore >= 88
        ? "S"
        : metaScore >= 75
          ? "A"
          : metaScore >= 55
            ? "B"
            : "C"
      : null);

  const related = await getRelatedProducts(group);

  return {
    blade: detected?.name ?? null,
    tier,
    metaScore,
    community: communityIntel,
    topCombos,
    related,
  };
}

/**
 * Produits sémantiquement proches via les voisins du vecteur dense de ce groupe
 * (`group-<key>`), résolus en groupes catalogue (mêmes id) et dédupliqués.
 */
export async function getRelatedProducts(
  group: BxProductGroup,
  limit = 6,
): Promise<RelatedProduct[]> {
  const neighbors = await vectorNeighborsById(`group-${group.key}`, limit * 3);
  if (neighbors.length === 0) return [];
  const byId = await groupsById();
  const out: RelatedProduct[] = [];
  for (const n of neighbors) {
    if (!n.id.startsWith("group-")) continue; // on ne lie que des produits
    const key = n.id.slice("group-".length);
    if (key === group.key) continue;
    const g = byId.get(key);
    if (!g) continue;
    out.push({
      slug: groupSlug(g),
      name: g.name,
      code: g.code,
      cheapestEur: g.cheapestEur,
      imageUrl: g.cheapest?.image ?? null,
      similarity: n.sim,
    });
    if (out.length >= limit) break;
  }
  return out;
}
