/**
 * Moteur de ranking de recherche — pur, partagé client + serveur (aucun import server-only).
 *
 * Implémente un **BM25F** (Okapi BM25 par champ, avec field boosts) spécialisé
 * Beyblade : tokenisation accent-fold (NFD), saturation de fréquence + normalisation
 * par longueur, expansion de synonymes/alias FR/EN/JP, **tolérance aux typos**
 * (Damerau-Levenshtein bornée par longueur), bonus exact/préfixe et signaux de
 * popularité (tier, prix). Opère sur `GlobalSearchItem[]`, corpus mémoïsé par
 * référence de tableau (l'index client est stable → recalcul O(1) entre frappes).
 */
import type { GlobalSearchItem, SearchCategory } from "@rpbey/api-contract";
import { COMMUNITY_ALIASES } from "./discord-lexicon.generated";

/** Normalise : minuscules, sans accents (NFD), espaces compactés. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "le",
  "la",
  "les",
  "de",
  "du",
  "des",
  "un",
  "une",
  "et",
  "ou",
  "a",
  "au",
  "aux",
  "the",
  "of",
  "for",
  "and",
  "or",
  "to",
  "in",
  "x",
]);

/** Découpe en tokens normalisés (≥2 chars ou bloc CJK), hors stop-words. */
export function tokenize(s: string): string[] {
  const norm = normalize(s);
  const tokens: string[] = [];
  for (const raw of norm.split(/[\s/|,;:!?.()[\]{}'"`#@]+/)) {
    const t = raw.trim();
    if (!t) continue;
    if ((t.length >= 2 || /[0-9぀-ヿ一-鿿]/.test(t)) && !STOP_WORDS.has(t)) tokens.push(t);
  }
  return tokens;
}

/**
 * Alias/synonymes spécifiques Beyblade. Chaque groupe = termes équivalents ;
 * un hit sur n'importe quel membre étend la requête aux autres (recall).
 */
const SYNONYM_GROUPS: string[][] = [
  ["wizard rod", "wiz rod", "ウィザードロッド", "wizard arrow"],
  ["phoenix wing", "phoenix", "フェニックスウイング"],
  ["cobalt dragoon", "cobalt drake", "コバルトドレイク", "drake", "dragoon"],
  ["shark edge", "シャークエッジ", "shark"],
  ["dran sword", "ドランソード", "dran"],
  ["dran buster", "ドランバスター", "buster"],
  ["dran dagger", "ドランダガー"],
  ["hells scythe", "hells chain", "ヘルズサイズ", "hells", "hell scythe"],
  ["leon claw", "leon crest", "レオンクロー", "leon"],
  ["weiss tiger", "ヴァイスタイガー", "weiss"],
  ["unicorn sting", "ユニコーンスティング", "unicorn"],
  ["knight shield", "knight lance", "ナイトシールド", "knight"],
  ["tyranno beat", "ティラノビート", "tyranno"],
  ["black shell", "ブラックシェル"],
  ["viper tail", "バイパーテイル", "viper"],
  // bits / drivers
  ["ball", "ボール", "bit ball"],
  ["needle", "ニードル"],
  ["flat", "フラット"],
  ["taper", "テーパー"],
  ["orb", "オーブ"],
  ["rush", "ラッシュ"],
  ["gear ball", "gb"],
  ["high taper", "ht"],
  ["low flat", "lf"],
  // généraux
  ["beyblade x", "bx", "ベイブレードx", "beyblade", "ベイブレード"],
  ["stamina", "スタミナ", "endurance", "defense stamina"],
  ["attack", "アタック", "attaque", "attacker", "rush attack"],
  ["defense", "defence", "ディフェンス", "defense type"],
  ["combo", "combinaison", "build", "setup"],
  ["tournoi", "tournament", "tournaments", "compet", "competition", "cnc"],
  ["classement", "ranking", "rankings", "leaderboard", "tier list", "tier"],
  ["lanceur", "launcher", "string launcher", "ワインダー", "winder"],
  ["deck", "decks", "équipe", "team"],
  ["boutique", "shop", "magasin", "store", "acheter", "prix", "price"],
  ["anime", "アニメ", "épisode", "episode", "saison", "season"],
];

// Synonymes curés + alias communautaires CONFIRMÉS (initialismes/contractions minés
// dans le salon Discord Beyblade X, cf. discord-lexicon.generated.ts). Le contenu
// Discord lui-même n'entre jamais dans le corpus ni les réponses — seul ce vocabulaire
// d'alias informe l'expansion de requête (recall sur l'argot communautaire).
const ALL_SYNONYM_GROUPS: string[][] = [...SYNONYM_GROUPS, ...COMMUNITY_ALIASES];

// Index inversé : terme normalisé -> set d'ID de groupes contenant ce terme.
const TERM_TO_GROUPS = new Map<string, Set<number>>();
for (let g = 0; g < ALL_SYNONYM_GROUPS.length; g++) {
  const group = ALL_SYNONYM_GROUPS[g];
  if (!group) continue;
  for (const term of group) {
    const key = normalize(term);
    let set = TERM_TO_GROUPS.get(key);
    if (!set) {
      set = new Set();
      TERM_TO_GROUPS.set(key, set);
    }
    set.add(g);
  }
}

/** Étend une requête (texte) avec tous les termes des groupes de synonymes touchés. */
export function expandSynonyms(normQuery: string): string[] {
  const hits = new Set<number>();
  for (const [term, groups] of TERM_TO_GROUPS) {
    if (normQuery.includes(term) || term.includes(normQuery)) {
      for (const g of groups) hits.add(g);
    }
  }
  const expanded = new Set<string>();
  for (const g of hits) {
    const group = ALL_SYNONYM_GROUPS[g];
    if (!group) continue;
    for (const t of group) expanded.add(normalize(t));
  }
  return [...expanded];
}

// ── Distance de Damerau-Levenshtein (transpositions incluses), bornée ──────────

/** Distance d'édition optimale (insert/delete/substitute/transpose), coupée à `max`. */
function damerau(a: string, b: string, max: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = Array.from<number>({ length: bl + 1 });
  let curr = Array.from<number>({ length: bl + 1 });
  let beforePrev = Array.from<number>({ length: bl + 1 });
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        (prev[j] ?? max + 1) + 1, // suppression
        (curr[j - 1] ?? max + 1) + 1, // insertion
        (prev[j - 1] ?? max + 1) + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (beforePrev[j - 2] ?? max + 1) + 1); // transposition
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // élagage : plus aucune amélioration possible
    beforePrev = prev;
    prev = curr;
    curr = Array.from<number>({ length: bl + 1 });
  }
  return prev[bl] ?? max + 1;
}

/** Distance d'édition tolérée selon la longueur du terme (0 court, 1, puis 2). */
function fuzzyBudget(term: string): number {
  if (term.length <= 3) return 0;
  if (term.length <= 6) return 1;
  return 2;
}

// ── Corpus BM25F (mémoïsé par référence de tableau d'items) ────────────────────

type FieldKey = "title" | "subtitle" | "details" | "badge";
const FIELDS: FieldKey[] = ["title", "subtitle", "details", "badge"];
const FIELD_BOOST: Record<FieldKey, number> = {
  title: 3,
  subtitle: 1.6,
  badge: 1.6,
  details: 1,
};
const K1 = 1.2;
const B = 0.75;

interface DocStats {
  item: GlobalSearchItem;
  tf: Record<FieldKey, Map<string, number>>;
  len: Record<FieldKey, number>;
  normTitle: string;
}

interface Corpus {
  docs: DocStats[];
  df: Record<FieldKey, Map<string, number>>; // #docs contenant le terme dans ce champ
  avgdl: Record<FieldKey, number>;
  n: number;
  vocab: string[]; // tous les termes connus (pour le fuzzy)
}

const CORPUS_CACHE = new WeakMap<GlobalSearchItem[], Corpus>();

function fieldText(item: GlobalSearchItem, f: FieldKey): string {
  if (f === "title") return item.title;
  if (f === "subtitle") return item.subtitle ?? "";
  if (f === "details") return item.details ?? "";
  return item.badge ?? "";
}

function buildCorpus(items: GlobalSearchItem[]): Corpus {
  const cached = CORPUS_CACHE.get(items);
  if (cached) return cached;

  const docs: DocStats[] = [];
  const df: Record<FieldKey, Map<string, number>> = {
    title: new Map(),
    subtitle: new Map(),
    details: new Map(),
    badge: new Map(),
  };
  const totalLen: Record<FieldKey, number> = {
    title: 0,
    subtitle: 0,
    details: 0,
    badge: 0,
  };
  const vocab = new Set<string>();

  for (const item of items) {
    const tf: Record<FieldKey, Map<string, number>> = {
      title: new Map(),
      subtitle: new Map(),
      details: new Map(),
      badge: new Map(),
    };
    const len: Record<FieldKey, number> = {
      title: 0,
      subtitle: 0,
      details: 0,
      badge: 0,
    };
    for (const f of FIELDS) {
      const toks = tokenize(fieldText(item, f));
      len[f] = toks.length;
      totalLen[f] += toks.length;
      const seen = new Set<string>();
      for (const tok of toks) {
        tf[f].set(tok, (tf[f].get(tok) ?? 0) + 1);
        vocab.add(tok);
        if (!seen.has(tok)) {
          seen.add(tok);
          df[f].set(tok, (df[f].get(tok) ?? 0) + 1);
        }
      }
    }
    docs.push({ item, tf, len, normTitle: normalize(item.title) });
  }

  const n = docs.length || 1;
  const avgdl: Record<FieldKey, number> = {
    title: totalLen.title / n,
    subtitle: totalLen.subtitle / n,
    details: totalLen.details / n,
    badge: totalLen.badge / n,
  };
  const corpus: Corpus = { docs, df, avgdl, n, vocab: [...vocab] };
  CORPUS_CACHE.set(items, corpus);
  return corpus;
}

function idf(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

interface QueryTerm {
  term: string;
  weight: number; // 1 exact, <1 synonyme/fuzzy
}

/** Construit les termes de requête : tokens + synonymes + corrections fuzzy. */
function buildQueryTerms(query: string, corpus: Corpus): QueryTerm[] {
  const normQuery = normalize(query);
  const base = tokenize(query);
  const terms = new Map<string, number>(); // term -> meilleur poids
  const add = (t: string, w: number) => {
    if (!t) return;
    const cur = terms.get(t);
    if (cur == null || w > cur) terms.set(t, w);
  };

  for (const t of base) add(t, 1);

  // Synonymes (poids réduit).
  for (const syn of expandSynonyms(normQuery)) {
    for (const t of tokenize(syn)) add(t, 0.55);
  }

  // Tolérance aux typos : pour chaque token absent du vocabulaire, chercher
  // le terme connu le plus proche (Damerau-Levenshtein bornée).
  const vocabSet = new Set(corpus.vocab);
  for (const t of base) {
    if (vocabSet.has(t)) continue;
    const budget = fuzzyBudget(t);
    if (budget === 0) continue;
    let best: string | null = null;
    let bestD = budget + 1;
    for (const v of corpus.vocab) {
      if (Math.abs(v.length - t.length) > budget) continue;
      const d = damerau(t, v, budget);
      if (d < bestD) {
        bestD = d;
        best = v;
        if (d === 1) break;
      }
    }
    if (best && bestD <= budget) add(best, 0.45);
  }

  return [...terms].map(([term, weight]) => ({ term, weight }));
}

/** Score BM25F d'un document pour des termes de requête pondérés. */
function bm25fScore(doc: DocStats, qterms: QueryTerm[], corpus: Corpus): number {
  let score = 0;
  for (const { term, weight } of qterms) {
    let termScore = 0;
    for (const f of FIELDS) {
      const tf = doc.tf[f].get(term);
      if (!tf) continue;
      const df = corpus.df[f].get(term) ?? 0;
      if (df === 0) continue;
      const denom = tf + K1 * (1 - B + (B * doc.len[f]) / (corpus.avgdl[f] || 1));
      const fieldScore = (idf(df, corpus.n) * (tf * (K1 + 1))) / (denom || 1);
      termScore += FIELD_BOOST[f] * fieldScore;
    }
    score += weight * termScore;
  }
  return score;
}

const TIER_BONUS: Record<string, number> = { s: 3, a: 2, b: 1, c: 0.25 };
const CATEGORY_BOOST: Record<string, number> = {
  product: 1.15,
  part: 1.1,
  blader: 1.0,
  tournament: 1.0,
  combo: 1.05,
  meta: 1.08,
  anime: 0.95,
  frame: 0.9,
  lexicon: 0.85,
  site: 0.8,
  discussion: 0.78,
  page: 0.75,
};

export interface RankedItem extends GlobalSearchItem {
  score: number;
}

export interface RankOptions {
  category?: SearchCategory | "all";
  limit?: number;
}

/** Classe les items par pertinence BM25F (+ bonus exact/préfixe, popularité, catégorie). */
export function rankSearch(
  items: GlobalSearchItem[],
  query: string,
  opts: RankOptions = {},
): RankedItem[] {
  const normQuery = normalize(query);
  if (!normQuery) return [];
  const corpus = buildCorpus(items);
  const qterms = buildQueryTerms(query, corpus);
  const cat = opts.category && opts.category !== "all" ? opts.category : null;

  const ranked: RankedItem[] = [];
  for (const doc of corpus.docs) {
    if (cat && doc.item.category !== cat) continue;
    let score = bm25fScore(doc, qterms, corpus);

    // Bonus de correspondance littérale (gère noms courts / SKU / requêtes 1 mot).
    if (doc.normTitle === normQuery) score += 50;
    else if (doc.normTitle.startsWith(normQuery)) score += 18;
    else if (doc.normTitle.includes(normQuery)) score += 8;

    if (score <= 0) continue;

    // Popularité : tier (badge/subtitle), disponibilité prix.
    const tierSrc = `${normalize(doc.item.badge ?? "")} ${normalize(doc.item.subtitle ?? "")}`;
    const tierMatch = tierSrc.match(/tier\s*([sabc])\b/);
    const tierKey = tierMatch?.[1];
    if (tierKey) score += TIER_BONUS[tierKey] ?? 0;
    if (typeof doc.item.price === "number" && doc.item.price > 0) score += 1;

    // Engagement (likes tweet, score Reddit, fréquence combo…) : bonus log-scalé,
    // plafonné à +2 pour départager des résultats de pertinence proche sans jamais
    // dominer le signal textuel BM25F.
    if (typeof doc.item.popularity === "number" && doc.item.popularity > 0) {
      score += Math.min(2, Math.log10(1 + doc.item.popularity));
    }

    score *= CATEGORY_BOOST[doc.item.category] ?? 1;
    ranked.push({ ...doc.item, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return typeof opts.limit === "number" ? ranked.slice(0, opts.limit) : ranked;
}

/** Voisin sémantique renvoyé par la couche dense (id corpus + similarité). */
export interface VectorRank {
  id: string;
  sim: number;
}

export interface FuseOptions extends RankOptions {
  /** Constante RRF (amortit l'effet des tout premiers rangs). Défaut 60 (standard). */
  rrfK?: number;
  /** Poids de la liste lexicale BM25F. Défaut 1.0. */
  lexWeight?: number;
  /** Poids de la liste dense (vecteurs). Défaut 0.9 (légèrement sous le lexical). */
  vecWeight?: number;
}

/**
 * **Recherche hybride par Reciprocal Rank Fusion** — fusionne le classement
 * lexical BM25F (`lexRanked`, trié décroissant) et le classement dense
 * (`vecRanked`, voisins sémantiques triés décroissant) sans avoir à réconcilier
 * des échelles de score incompatibles : chaque liste contribue `poids / (k + rang)`.
 *
 * Un item présent dans les DEUX listes remonte (le gain de l'hybride) ; un item
 * uniquement dense élargit le recall (paraphrase, cross-lingue) ; un item
 * uniquement lexical garde sa précision sur les littéraux (codes, SKU). Avec
 * `vecRanked` vide, la fusion préserve exactement l'ordre BM25F (dégradation
 * gracieuse quand le sidecar/Redis est absent).
 */
export function fuseHybrid(
  items: GlobalSearchItem[],
  lexRanked: RankedItem[],
  vecRanked: VectorRank[],
  opts: FuseOptions = {},
): RankedItem[] {
  const k = opts.rrfK ?? 60;
  const lw = opts.lexWeight ?? 1.0;
  const vw = opts.vecWeight ?? 0.9;
  const cat = opts.category && opts.category !== "all" ? opts.category : null;
  const idToItem = new Map(items.map((it) => [it.id, it]));

  // Filtre de catégorie appliqué AVANT le calcul des rangs RRF, sur les DEUX listes :
  // sinon les rangs sont globaux (toutes catégories) et le filtre post-fusion fausse la
  // fusion — un voisin dense in-catégorie au rang global 80 (RRF ≈ vw/140, négligeable)
  // alors qu'il est #2 de SA catégorie. En reclassant within-category, le signal dense
  // est restitué à sa juste place et le compteur d'onglet reflète des rangs cohérents.
  const lex = cat ? lexRanked.filter((it) => it.category === cat) : lexRanked;
  const vec = cat ? vecRanked.filter((v) => idToItem.get(v.id)?.category === cat) : vecRanked;

  const acc = new Map<string, { item: GlobalSearchItem; rrf: number; lex: number }>();
  lex.forEach((it, rank) => {
    const cur = acc.get(it.id) ?? { item: it, rrf: 0, lex: it.score };
    cur.rrf += lw / (k + rank + 1);
    acc.set(it.id, cur);
  });
  vec.forEach((v, rank) => {
    const item = idToItem.get(v.id);
    if (!item) return;
    const cur = acc.get(v.id) ?? { item, rrf: 0, lex: 0 };
    cur.rrf += vw / (k + rank + 1);
    acc.set(v.id, cur);
  });

  const fused = [...acc.values()];
  fused.sort((a, b) => b.rrf - a.rrf || b.lex - a.lex || a.item.title.localeCompare(b.item.title));
  const sliced = typeof opts.limit === "number" ? fused.slice(0, opts.limit) : fused;
  return sliced.map((e) => ({ ...e.item, score: e.rrf }));
}

/** Score brut d'un item isolé (utilitaire ; reconstruit un mini-corpus). */
export function scoreItem(item: GlobalSearchItem, query: string): number {
  return rankSearch([item], query, { limit: 1 })[0]?.score ?? 0;
}

/** Compte les résultats par catégorie pour les facettes/onglets. */
export function facetCounts(items: GlobalSearchItem[], query: string): Record<string, number> {
  const facets: Record<string, number> = {};
  for (const r of rankSearch(items, query)) {
    facets[r.category] = (facets[r.category] ?? 0) + 1;
  }
  return facets;
}

/** Top suggestions (titres) pour l'autocomplétion. */
export function suggest(items: GlobalSearchItem[], query: string, limit = 8): RankedItem[] {
  return rankSearch(items, query, { limit });
}
