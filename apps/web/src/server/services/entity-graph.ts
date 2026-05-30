import "server-only";
import type { EnrichedCombo, WikiEntity } from "@rpbey/api-contract";
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

/** Contexte encyclopédique d'une entité (depuis le Beyblade Wiki). */
export interface WikiIntel {
  title: string;
  generation: WikiEntity["generation"];
  beyType: string | null;
  system: string | null;
  jpName: string | null;
  summary: string;
  imageUrl: string | null;
  url: string;
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
  /** Fiche encyclopédique wiki de la blade (génération, description, JP…). */
  wiki: WikiIntel | null;
}

/** Vitrine d'une génération pour la page anime : entités wiki cross-linkées. */
export interface GenerationShowcase {
  beys: WikiIntel[];
  characters: WikiIntel[];
  games: WikiIntel[];
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

// ── Index connaissance wiki (Beyblade Fandom) ───────────────────────────────────

let _wikiByKey: Promise<Map<string, WikiEntity>> | null = null;
let _wikiByGen: Promise<Map<string, WikiEntity[]>> | null = null;

function toWikiIntel(e: WikiEntity): WikiIntel {
  return {
    title: e.title,
    generation: e.generation,
    beyType: e.beyType,
    system: e.system,
    jpName: e.jpName,
    summary: e.summary,
    imageUrl: e.imageUrl,
    url: e.url,
  };
}

/** Entité wiki par clé canonique de titre (priorité bey > part > autre si collision). */
function wikiByKey(): Promise<Map<string, WikiEntity>> {
  _wikiByKey ??= (async () => {
    const data = await loadJsonSafe<{ entities?: WikiEntity[] }>("data/beyblade-knowledge.json");
    const map = new Map<string, WikiEntity>();
    const rank: Record<string, number> = { bey: 3, part: 2 };
    for (const e of data?.entities ?? []) {
      const k = canonicalKey(e.title);
      if (!k) continue;
      const prev = map.get(k);
      if (!prev || (rank[e.type] ?? 0) > (rank[prev.type] ?? 0)) map.set(k, e);
    }
    return map;
  })();
  return _wikiByKey;
}

/** Entités wiki groupées par génération (pour la vitrine de la page anime). */
function wikiByGeneration(): Promise<Map<string, WikiEntity[]>> {
  _wikiByGen ??= (async () => {
    const data = await loadJsonSafe<{ entities?: WikiEntity[] }>("data/beyblade-knowledge.json");
    const map = new Map<string, WikiEntity[]>();
    for (const e of data?.entities ?? []) {
      if (!e.generation) continue;
      const arr = map.get(e.generation);
      if (arr) arr.push(e);
      else map.set(e.generation, [e]);
    }
    return map;
  })();
  return _wikiByGen;
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
  const [combos, meta, community, wiki] = await Promise.all([
    comboIndex(),
    metaIndex(),
    communityIndex(),
    wikiByKey(),
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

  // Fiche wiki : la blade détectée, sinon une correspondance directe sur le titre.
  const wikiEntity = wiki.get(bladeKey) ?? wiki.get(canonicalKey(group.name));

  const related = await getRelatedProducts(group);

  return {
    blade: detected?.name ?? null,
    tier,
    metaScore,
    community: communityIntel,
    topCombos,
    related,
    wiki: wikiEntity ? toWikiIntel(wikiEntity) : null,
  };
}

/** Aliases de génération côté DB anime → enum wiki (`WikiGeneration`). */
const GEN_ALIASES: Record<string, WikiEntity["generation"]> = {
  ORIGINAL: "ORIGINAL",
  PLASTIC: "ORIGINAL",
  HMS: "HMS",
  METAL: "METAL",
  METAL_SAGA: "METAL",
  METAL_FUSION: "METAL",
  BURST: "BURST",
  X: "X",
  BEYBLADE_X: "X",
};

/**
 * Vitrine cross-linkée d'une génération (page anime) : meilleures toupies +
 * personnages + jeux de cette génération, depuis la connaissance wiki. Priorise
 * les entités avec image + résumé (les plus riches). `generation` = valeur DB
 * (mappée vers l'enum wiki).
 */
export async function getGenerationShowcase(
  generation: string,
  limits: { beys?: number; characters?: number; games?: number } = {},
): Promise<GenerationShowcase> {
  const gen = GEN_ALIASES[generation?.toUpperCase()] ?? null;
  const empty: GenerationShowcase = { beys: [], characters: [], games: [] };
  if (!gen) return empty;
  const byGen = await wikiByGeneration();
  const pool = byGen.get(gen) ?? [];
  // Tri : image + résumé d'abord (plus présentable), puis résumé le plus long.
  const score = (e: WikiEntity) => (e.imageUrl ? 2 : 0) + (e.summary.length > 60 ? 1 : 0);
  const pick = (type: WikiEntity["type"], n: number) =>
    pool
      .filter((e) => e.type === type)
      .sort((a, b) => score(b) - score(a) || b.summary.length - a.summary.length)
      .slice(0, n)
      .map(toWikiIntel);
  return {
    beys: pick("bey", limits.beys ?? 12),
    characters: pick("character", limits.characters ?? 12),
    games: pick("game", limits.games ?? 6),
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
