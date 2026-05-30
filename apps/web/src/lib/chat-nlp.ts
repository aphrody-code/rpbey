/**
 * NLP léger (ZÉRO LLM) pour le chat RAG web — miroir de `apps/bot/src/lib/rpbey/nlp.ts`.
 * Pur (aucun import node) → utilisable côté client (suggestions) ET serveur (routage du
 * retrieval). Classe l'intention d'une question Beyblade FR/EN et nettoie la requête ;
 * la compréhension fine du vocabulaire (synonymes, fautes) est déléguée au ranker hybride
 * (`search-rank.ts` : BM25F + synonymes + Damerau-Levenshtein).
 */

export type Intent =
  | "greeting"
  | "thanks"
  | "combo"
  | "best"
  | "meta"
  | "buy"
  | "tournament"
  | "rules"
  | "stats"
  | "compare"
  | "character"
  | "define";

interface Rule {
  intent: Intent;
  re: RegExp;
}

// Ordre = priorité (du plus spécifique au plus général). Premier match gagne.
const RULES: Rule[] = [
  { intent: "thanks", re: /\b(merci|thanks|thx|gg ?wp|bien jou[ée])\b/i },
  {
    intent: "greeting",
    re: /^\s*(salut|bonjour|bonsoir|yo|hey|hello|hi|coucou|wesh|cc)\b|qui (es[- ]?tu|t'?es|est rpbey)/i,
  },
  {
    intent: "stats",
    re: /\b(stats?|statistiques?)\b.*\b(site|communaut|serveur|rpb)\b|combien de (membres|joueurs|tournois|cartes)/i,
  },
  {
    intent: "rules",
    re: /\b(r[èe]gles?|format|comment (jouer|on joue|ça marche|ca marche)|deck (limit|format)|syst[èe]me de points|burst finish|over finish|spin finish|extreme finish)\b/i,
  },
  {
    intent: "tournament",
    re: /\b(tournois?|tournaments?|comp[ée]titions?|cnc|[ée]v[ée]nements?|events?|prochain tournoi|qui a gagn[ée])\b/i,
  },
  {
    intent: "buy",
    re: /\b(prix|acheter|ach[èe]te|o[uù] (?:trouver|acheter|commander)|combien (?:co[uû]te|ça co[uû]te)|co[uû]te|moins cher|pas cher|boutique|en stock|restock|disponible)\b/i,
  },
  {
    intent: "combo",
    re: /\b(combos?|combinaisons?|setups?|builds?|montages?|quoi mettre (?:avec|sur)|associer)\b/i,
  },
  {
    intent: "meta",
    re: /\b(m[ée]ta|tier|tier ?list|viable|broken|op|nerf|domine|classement des pi[èe]ces)\b/i,
  },
  {
    intent: "best",
    re: /\b(meilleure?s?|best|top|plus (?:fort|forte|puissant)|optimale?|recommand|conseill?e|que (?:prendre|choisir)|quoi (?:prendre|choisir|acheter d'?abord))\b/i,
  },
  {
    intent: "compare",
    re: /\b(vs|versus|contre|ou bien|plut[ôo]t que|mieux que|diff[ée]rence|comparer?|lequel)\b/i,
  },
  {
    intent: "character",
    re: /\b(qui est|qui c'?est|personnage|blader (?:de l'?anime)?|h[ée]ros|m[ée]chant|ryuga|gingka|valt|aiger|protagoniste)\b/i,
  },
  {
    intent: "define",
    re: /\b(c'?est quoi|c quoi|qu'?est[- ]?ce|quelle? est|d[ée]finition|explique|explication|parle[- ]?moi|raconte|info(?:rmation)?s? sur|à quoi sert)\b/i,
  },
];

/** Classe l'intention d'une question. `define` = repli (retrieval général hybride). */
export function detectIntent(question: string): Intent {
  const q = question.trim();
  for (const r of RULES) if (r.re.test(q)) return r.intent;
  return "define";
}

/** Nettoie une question : retire la mention du bot, les @, le bruit de ponctuation. */
export function cleanQuestion(raw: string): string {
  return raw
    .replace(/<@!?\d+>/g, " ")
    .replace(/<#\d+>/g, " ")
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Échafaudage interrogatif FR/EN retiré pour FOCALISER la recherche sur l'entité.
const QUESTION_NOISE =
  /\b(c'?est\s+quoi|c\s+quoi|qu'?est[- ]?ce\s+(?:que\s+|qui\s+|qu'?)?|qui\s+(?:est|c'?est|sont)|quelle?s?\s+(?:est|sont)|comment(?:\s+(?:jouer|on\s+joue|[çc]a\s+marche))?|pourquoi|explique(?:[- ]?moi)?|explication|parle[- ]?moi\s+(?:de|du|des|d'?)|raconte(?:[- ]?moi)?|d[ée]finition\s+(?:de|du|d'?)|infos?\s+sur|informations?\s+sur|[àa]\s+quoi\s+sert|donne[- ]?moi|je\s+veux\s+savoir|dis[- ]?moi|s'?il\s+te\s+pla[îi]t|stp|please|what\s+is|who\s+is|tell\s+me\s+about)\b/gi;

/** Termes de recherche = question débarrassée de l'échafaudage interrogatif. */
export function searchTerms(question: string): string {
  const t = cleanQuestion(question)
    .replace(QUESTION_NOISE, " ")
    .replace(/[?!.¿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 2 ? t : cleanQuestion(question);
}

/** Catégorie de recherche privilégiée par intention (biais du retrieval). `null` = global. */
export const INTENT_CATEGORY: Record<Intent, string | null> = {
  greeting: null,
  thanks: null,
  combo: "combo",
  best: "meta",
  meta: "meta",
  buy: "product",
  tournament: "tournament",
  rules: "lexicon",
  stats: null,
  compare: null,
  character: "anime",
  define: null,
};

/** Source citée par une réponse (carte de résultat RAG). */
export interface ChatSource {
  title: string;
  url: string;
  category: string;
  subtitle?: string;
  badge?: string;
  thumbnail?: string;
}

/** Réponse du chat RAG (partagée client/serveur). */
export interface ChatAnswer {
  found: boolean;
  intent: Intent;
  /** Réponse en Markdown (rendue par le composant chat). */
  answerMd: string;
  sources: ChatSource[];
  followups: string[];
}

/** Suggestions de questions de départ (chips Gemini-like). */
export const STARTER_PROMPTS: string[] = [
  "C'est quoi le meilleur combo méta ?",
  "Qui est Ryuga ?",
  "Explique le Burst Finish",
  "Meilleur bit pour la stamina ?",
  "Où acheter un Dran Sword pas cher ?",
  "Prochain tournoi ?",
];
