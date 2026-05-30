import "server-only";

import { type SearchCategory } from "@rpbey/api-contract";
import { searchVectorIds } from "@/server/services/embeddings";
import { getSearchCorpus } from "@/server/services/search-corpus";
import { fuseHybrid, rankSearch } from "@/lib/search-rank";
import { detectIntent, INTENT_CATEGORY, type Intent, searchTerms } from "@/lib/chat-nlp";

/**
 * Cerveau du chat RAG web (ZÉRO LLM) — équivalent in-process de `apps/bot/src/lib/rpbey/
 * answer.ts`. Retrieval HYBRIDE BM25F ⊕ dense (RRF) sur le corpus unifié (wiki toutes
 * saisons, combos WBO, méta, produits, pièces DB, tournois), puis synthèse 100 %
 * EXTRACTIVE par intention (faits intacts, jamais inventés). Appelé par `POST /api/chat`.
 * Pas d'aller-retour HTTP : on tape directement les services de recherche.
 *
 * Confidentialité : le salon Discord « Beyblade X » est EXCLU du corpus (cf.
 * global-search) et le bavardage communautaire (X/Reddit, `CHATTER`) est écarté des
 * RÉPONSES — il ne sert qu'au recall. Seul le VOCABULAIRE Discord (alias minés hors-ligne)
 * informe l'expansion de requête via le ranker.
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

// Catégories de bavardage communautaire : utiles au recall mais JAMAIS en tête d'une
// réponse (faits non vérifiés). Le salon Discord est déjà exclu en amont du corpus.
const CHATTER = new Set(["discussion"]);

const CATEGORY_LABEL: Record<string, string> = {
  product: "produits au catalogue",
  part: "pièces référencées",
  combo: "combos de tournoi",
  meta: "composants notés en méta",
  tournament: "tournois indexés",
  blader: "bladers de la communauté",
  anime: "fiches anime & univers",
  lexicon: "termes du lexique",
  page: "pages du site",
  site: "sites de la scène",
  frame: "visuels d'anime",
};

/** Extrait une ligne de « stat » exploitable du subtitle/badge (tier, score, prix…). */
function statLine(it: Item): string | null {
  const bits: string[] = [];
  if (it.badge && /tier|méta|meta|s\b|combo/i.test(it.badge)) bits.push(it.badge);
  const sub = it.subtitle ?? "";
  const score = sub.match(/score\s*\d+\s*\/\s*100/i);
  if (score) bits.push(score[0]);
  const seen = sub.match(/vu\s*\d+×/i);
  if (seen) bits.push(seen[0]);
  if (typeof it.details === "string") {
    const buzz = it.details.match(/buzz communaut[ée]\s*\d+\/100/i);
    if (buzz) bits.push(buzz[0]);
  }
  return bits.length ? bits.join(" · ") : null;
}

/** Réponse « statistiques » : compte réel par catégorie du corpus (zéro invention). */
async function answerStats(intent: Intent): Promise<ChatAnswer> {
  const index = await getSearchCorpus();
  const counts = new Map<string, number>();
  for (const it of index) {
    if (CHATTER.has(it.category)) continue;
    counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const lines = [...counts.entries()]
    .filter(([c]) => CATEGORY_LABEL[c])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(
      ([c, n]) =>
        `${CATEGORY_EMOJI[c] ?? "•"} **${n.toLocaleString("fr-FR")}** ${CATEGORY_LABEL[c]}`,
    );
  return {
    found: true,
    intent,
    answerMd: `J'indexe **${total.toLocaleString(
      "fr-FR",
    )}** entités Beyblade, toutes saisons confondues :\n\n${lines.join(
      "\n",
    )}\n\nPose-moi une question précise et je pioche dedans.`,
    sources: [],
    followups: ["Meilleur combo méta ?", "Le top des Blades ?", "Prochain tournoi ?"],
  };
}

const COMPARE_SPLIT =
  /\s+(?:vs\.?|versus|contre|ou bien|ou alors|plut[ôo]t que|mieux que|compar[ée]e? [àa]|\bou\b)\s+/i;

/** Réponse « comparaison » : oppose deux entités côte à côte (faits du corpus). */
async function answerCompare(message: string, intent: Intent): Promise<ChatAnswer | null> {
  const raw = searchTerms(message);
  const parts = raw
    .split(COMPARE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  if (parts.length < 2) return null;
  const [a, b] = [parts[0]!, parts[1]!];
  const [la, lb] = await Promise.all([retrieve(a, null, 4), retrieve(b, null, 4)]);
  const pick = (list: Item[]) => list.find((it) => AUTH.has(it.category)) ?? list[0];
  const ea = pick(la);
  const eb = pick(lb);
  if (!ea || !eb || ea.id === eb.id) return null;

  const side = (label: string, it: Item): string => {
    const stat = statLine(it);
    return `### ${label}\n${bullet(it)}${stat ? `\n\n\`${stat}\`` : ""}${
      it.details ? `\n\n${clip(it.details, 260)}` : ""
    }`;
  };
  const sa = statLine(ea);
  const sb = statLine(eb);
  let verdict = "";
  const num = (s: string | null) => Number(s?.match(/score\s*(\d+)/i)?.[1] ?? NaN);
  const na = num(sa);
  const nb = num(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
    const win = na > nb ? ea : eb;
    verdict = `\n\n**Verdict méta :** \`${na > nb ? sa : sb}\` donne l'avantage à **${win.title}**.`;
  }
  return {
    found: true,
    intent,
    answerMd: `${side(ea.title, ea)}\n\n${side(eb.title, eb)}${verdict}`,
    sources: [ea, eb].map(toSource),
    followups: ["Lequel en tournoi ?", "Un combo avec le gagnant ?", "Le contre des deux ?"],
  };
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

  // Statistiques du savoir : réponse chiffrée RÉELLE (compte du corpus, zéro invention).
  if (intent === "stats") return answerStats(intent);

  // Comparaison « X vs Y » : opposition côte à côte si deux entités sont isolables.
  if (intent === "compare") {
    const cmp = await answerCompare(message, intent);
    if (cmp) return cmp; // sinon : repli sur le flux générique ci-dessous.
  }

  const cat = INTENT_CATEGORY[intent];
  const terms = searchTerms(message);
  let items = await retrieve(terms, cat, 8);
  if (items.length === 0 && cat) items = await retrieve(terms, null, 8);

  // On écarte le bavardage communautaire (X/Reddit) des RÉPONSES : utile au recall mais
  // jamais présenté comme un fait. Le salon Discord est déjà hors corpus en amont.
  items = items.filter((it) => !CHATTER.has(it.category));

  if (items.length === 0) {
    // Repli intelligent : propose les entités les plus proches comme relances cliquables.
    const near = (await retrieve(terms.split(/\s+/).slice(0, 3).join(" "), null, 6)).filter(
      (it) => !CHATTER.has(it.category),
    );
    const suggestions = near.slice(0, 3).map((it) => `Parle-moi de ${it.title}`);
    return {
      found: false,
      intent,
      answerMd:
        "Je n'ai rien trouvé de précis là-dessus. Donne-moi le nom exact (toupie, pièce, perso) et je creuse — ou tente une de ces pistes.",
      sources: [],
      followups: suggestions.length
        ? suggestions
        : ["Meilleur combo méta ?", "Les pièces les plus fortes ?", "Prochain tournoi ?"],
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

  // define / character / rules : on mène par une entrée faisant AUTORITÉ, enrichie de sa
  // ligne de stat (tier / score méta / buzz) quand elle existe.
  const lead = items.find((it) => AUTH.has(it.category)) ?? items[0]!;
  const others = items.filter((it) => it.id !== lead.id);
  let body = bullet(lead);
  const stat = statLine(lead);
  if (stat) body += `\n\n\`${stat}\``;
  if (lead.details) body += `\n\n${clip(lead.details, 480)}`;
  const more = others.slice(0, 3).map(bullet);
  if (more.length) body += `\n\n**À explorer aussi :**\n${more.join("\n")}`;
  return { found: true, intent, answerMd: body, sources, followups };
}
