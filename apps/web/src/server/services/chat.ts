import "server-only";

import { type SearchCategory } from "@rpbey/api-contract";
import { searchVectorIds } from "@/server/services/embeddings";
import { getSearchCorpus } from "@/server/services/search-corpus";
import { fuseHybrid, rankSearch } from "@/lib/search-rank";
import { detectIntent, INTENT_CATEGORY, type Intent, searchTerms } from "@/lib/chat-nlp";

/**
 * Cerveau du chat RAG web (ZÉRO LLM) — équivalent in-process de `apps/bot/src/lib/rpbey/
 * answer.ts`. Retrieval HYBRIDE BM25F ⊕ dense (RRF) sur le corpus unifié (wiki toutes
 * saisons, combos WBO, méta, produits, pièces DB, tournois, discussions Discord/X/Reddit),
 * puis synthèse 100 % EXTRACTIVE par intention (faits intacts, jamais inventés). Appelé par
 * `POST /api/chat`. Pas d'aller-retour HTTP : on tape directement les services de recherche.
 */

export interface ChatSource {
  title: string;
  url: string;
  category: string;
  subtitle?: string;
  badge?: string;
  thumbnail?: string;
}

export interface ChatAnswer {
  found: boolean;
  intent: Intent;
  /** Réponse en Markdown (rendue par le composant chat). */
  answerMd: string;
  sources: ChatSource[];
  /** Suggestions de relance contextuelles. */
  followups: string[];
}

// Catégories faisant AUTORITÉ pour mener une définition (vs un message de chat).
const AUTH = new Set(["part", "product", "anime", "lexicon", "meta", "combo", "tournament"]);

const CATEGORY_EMOJI: Record<string, string> = {
  product: "📦",
  part: "⚙️",
  tournament: "🏆",
  blader: "👤",
  lexicon: "📖",
  combo: "🌀",
  anime: "📺",
  meta: "📊",
  discussion: "💬",
  page: "📄",
  frame: "🖼️",
  site: "🌐",
};

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  url: string;
  details?: string;
  badge?: string;
  thumbnail?: string;
}

function clip(s: string, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

function bullet(it: Item): string {
  const emoji = CATEGORY_EMOJI[it.category] ?? "•";
  const badge = it.badge ? ` \`${it.badge}\`` : "";
  const sub = it.subtitle ? ` — ${it.subtitle}` : "";
  return `${emoji} **[${it.title}](${it.url})**${badge}${sub}`;
}

function toSource(it: Item): ChatSource {
  return {
    title: it.title,
    url: it.url,
    category: it.category,
    subtitle: it.subtitle,
    badge: it.badge,
    thumbnail: it.thumbnail,
  };
}

async function retrieve(terms: string, category: string | null, limit: number): Promise<Item[]> {
  const index = await getSearchCorpus();
  const lex = rankSearch(index, terms, {});
  const vec = await searchVectorIds(terms, 120);
  const fused = fuseHybrid(index, lex, vec, {
    category: category ? (category as SearchCategory) : undefined,
    limit,
  });
  return fused as unknown as Item[];
}

// Relances suggérées par intention (chips contextuelles façon Gemini).
function followupsFor(intent: Intent): string[] {
  switch (intent) {
    case "combo":
      return ["Pourquoi ce combo domine ?", "Une alternative budget ?", "Le contre de ce combo ?"];
    case "best":
    case "meta":
      return ["Le meilleur bit stamina ?", "Tier list attaque ?", "Quoi acheter en premier ?"];
    case "buy":
      return ["Une option moins chère ?", "Disponible en France ?", "Le combo avec cette pièce ?"];
    case "tournament":
      return ["Le format des tournois ?", "Les derniers résultats ?", "Comment s'inscrire ?"];
    case "character":
      return ["Sa toupie signature ?", "Dans quelle saison ?", "Ses rivaux ?"];
    case "rules":
      return ["C'est quoi un Burst Finish ?", "Le format de deck ?", "Le système de points ?"];
    default:
      return ["Un combo avec ça ?", "C'est viable en méta ?", "Où l'acheter ?"];
  }
}

const GREETINGS = [
  "Salut, blader. Je suis Rpbey — je connais TOUT le Beyblade : combos, méta, toupies, perso, tournois, prix. Pose ta question.",
  "Yo. Rpbey à l'écoute. Demande-moi un combo, une pièce, un perso, la méta du moment…",
];

/** Compose la réponse factuelle (Markdown) à une question Beyblade. */
export async function answerQuestion(message: string): Promise<ChatAnswer> {
  const intent = detectIntent(message);

  if (intent === "greeting") {
    return {
      found: true,
      intent,
      answerMd: GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!,
      sources: [],
      followups: ["Meilleur combo méta ?", "Qui est Ryuga ?", "Explique le Burst Finish"],
    };
  }
  if (intent === "thanks") {
    return {
      found: true,
      intent,
      answerMd: "Avec plaisir. Reviens quand tu veux dominer la méta.",
      sources: [],
      followups: followupsFor("meta"),
    };
  }

  const cat = INTENT_CATEGORY[intent];
  const terms = searchTerms(message);
  let items = await retrieve(terms, cat, 8);
  if (items.length === 0 && cat) items = await retrieve(terms, null, 8);

  if (items.length === 0) {
    return {
      found: false,
      intent,
      answerMd:
        "Je n'ai rien trouvé là-dessus dans mon savoir. Précise le nom exact (toupie, pièce, perso) et je creuse.",
      sources: [],
      followups: ["Meilleur combo méta ?", "Les pièces les plus fortes ?", "Prochain tournoi ?"],
    };
  }

  const sources = items.slice(0, 4).map(toSource);
  const followups = followupsFor(intent);

  if (intent === "combo") {
    const lines = items.slice(0, 5).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    return {
      found: true,
      intent,
      answerMd: `Les combos qui dominent les tournois :\n\n${lines.join("\n")}`,
      sources,
      followups,
    };
  }

  if (intent === "best" || intent === "meta") {
    const lines = items.slice(0, 6).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    return {
      found: true,
      intent,
      answerMd: `Le classement méta du moment :\n\n${lines.join("\n")}`,
      sources,
      followups,
    };
  }

  if (intent === "buy") {
    const lead = items[0]!;
    const rest = items.slice(1, 4).map(bullet);
    let body = `Le meilleur prix que j'ai déniché :\n\n${bullet(lead)}`;
    if (rest.length) body += `\n\nAutres pistes :\n${rest.join("\n")}`;
    return { found: true, intent, answerMd: body, sources, followups };
  }

  if (intent === "tournament") {
    const lines = items.slice(0, 6).map(bullet);
    return {
      found: true,
      intent,
      answerMd: `Du côté des arènes :\n\n${lines.join("\n")}`,
      sources,
      followups,
    };
  }

  // define / character / compare / rules / stats : on mène par une entrée faisant AUTORITÉ.
  const lead = items.find((it) => AUTH.has(it.category)) ?? items[0]!;
  const others = items.filter((it) => it.id !== lead.id);
  let body = bullet(lead);
  if (lead.details) body += `\n\n${clip(lead.details, 480)}`;
  const more = others.slice(0, 3).map(bullet);
  if (more.length) body += `\n\n**À explorer aussi :**\n${more.join("\n")}`;
  return { found: true, intent, answerMd: body, sources, followups };
}
