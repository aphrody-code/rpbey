import "server-only";

import { type SearchCategory } from "@rpbey/api-contract";
import { searchVectorIds } from "@/server/services/embeddings";
import { getSearchCorpus } from "@/server/services/search-corpus";
import { fuseHybrid, rankSearch } from "@/lib/search-rank";
import { detectIntent, INTENT_CATEGORY, type Intent, searchTerms } from "@/lib/chat-nlp";
export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Cerveau du chat RAG web — équivalent in-process de `apps/bot/src/lib/rpbey/answer.ts`.
 * Retrieval HYBRIDE BM25F ⊕ dense (RRF) sur le corpus unifié (wiki toutes saisons, combos
 * WBO, méta, produits, pièces DB, tournois), puis SYNTHÈSE LLM en français par NOTRE modèle
 * local (llama.cpp, cf. `services/llm.ts`) GROUNDÉE sur les faits récupérés + l'HISTORIQUE
 * de conversation (mémoire multi-tour) — le corpus wiki est en anglais, le modèle traduit +
 * reformule sans rien inventer. Repli déterministe EXTRACTIF (brouillon Markdown) si le LLM
 * est inactif/indisponible. `prepareTurn` fait retrieval + messages (partagé streaming/non-
 * stream). Pas d'aller-retour HTTP vers la recherche : on tape directement les services.
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
async function answerCompare(
  message: string,
  intent: Intent,
  history: ChatTurn[],
): Promise<PreparedTurn | null> {
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
  const draft = `${side(ea.title, ea)}\n\n${side(eb.title, eb)}${verdict}`;
  return {
    found: true,
    intent,
    draft,
    messages: buildMessages(message, intent, [ea, eb], history),
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

// --- Couche LLM (synthèse française groundée sur le retrieval) -----------------------

const LLM_SYSTEM = `Tu es Rpbey, l'assistant Beyblade de la communauté « République Populaire du Beyblade ».
Tu réponds TOUJOURS en français, dans un texte clair, naturel et vivant — comme un passionné qui explique à un autre joueur.

Règles ABSOLUES :
- N'utilise QUE les faits du CONTEXTE fourni. N'invente JAMAIS une donnée absente (chiffre, nom, date, prix, tier).
- Le contexte est souvent en anglais (wiki Fandom) : traduis-le et reformule-le en français correct.
- Réponds DIRECTEMENT à la question, 2 à 5 phrases (ou une courte liste si on demande un classement / des combos).
- Texte pur : pas d'emoji, pas de titre markdown (#), pas de métadonnée brute recopiée (ex. « Personnage — Personnage »). Tu peux mettre en **gras** les noms d'entités clés.
- N'écris pas d'URL : les sources sont affichées séparément sous ta réponse.
- Si le contexte ne permet pas de répondre, dis-le honnêtement en une phrase et invite à préciser.`;

// Indice par intention pour cadrer la forme de la réponse (le fond reste le contexte).
const LLM_INTENT_HINT: Partial<Record<Intent, string>> = {
  combo:
    "On te demande des combos forts : présente-les en courte liste, avec ce qui les rend bons.",
  best: "On te demande un classement / le meilleur : hiérarchise brièvement les options du contexte.",
  meta: "On te demande la méta : explique ce qui domine et pourquoi, d'après le contexte.",
  buy: "On te demande où/combien acheter : donne le meilleur prix et les alternatives du contexte.",
  tournament: "On te demande les tournois : résume les événements/résultats du contexte.",
  character: "On te demande qui est un personnage : fais une bio fluide à partir du contexte.",
  rules: "On te demande une règle/un terme : explique-le simplement à partir du contexte.",
  define: "On te demande une explication : définis l'entité clairement à partir du contexte.",
  compare:
    "On compare deux entités : oppose-les en français (forces, méta), puis tranche si le contexte le permet.",
};

/** Construit le bloc de faits (corpus) passé au LLM — concis, sans bruit de balisage. */
function factsBlock(items: Item[], n: number): string {
  return items
    .slice(0, n)
    .map((it) => {
      const meta = [it.badge, it.subtitle].filter(Boolean).join(" · ");
      const desc = it.details ? clip(it.details, 360) : "";
      return `- ${it.title}${meta ? ` (${meta})` : ""}${desc ? ` : ${desc}` : ""}`;
    })
    .join("\n");
}

// Mémoire conversationnelle : on conserve les N derniers tours (hors système), bornés en
// taille, pour donner le contexte au modèle sans exploser le prompt (coûteux sur CPU).
const MAX_HISTORY_TURNS = 8;
const MAX_TURN_CHARS = 1200;

/**
 * Construit les messages multi-tour pour le LLM : système + HISTORIQUE (mémoire) + tour
 * courant enrichi du CONTEXTE RAG. Le contexte RAG n'est mis QUE sur le tour courant (frais
 * à chaque question) ; l'historique ne garde que le texte des échanges.
 */
function buildMessages(
  message: string,
  intent: Intent,
  items: Item[],
  history: ChatTurn[],
): ChatTurn[] {
  const hint = LLM_INTENT_HINT[intent] ?? "";
  const userTurn = `Question du joueur : « ${message} »
${hint ? `\n${hint}\n` : ""}
CONTEXTE (faits du corpus Beyblade, à traduire/reformuler en français — n'utilise rien d'autre) :
${factsBlock(items, 6)}`;
  const trimmed = history
    .filter((t) => t.role !== "system")
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_TURN_CHARS) }));
  return [{ role: "system", content: LLM_SYSTEM }, ...trimmed, { role: "user", content: userTurn }];
}

/**
 * Tour de chat PRÉPARÉ (retrieval + brouillon + messages), SANS l'appel LLM — partagé par
 * le flux streaming (`POST /api/chat`) et `answerQuestion` (non-stream / repli).
 * - `fixed` : réponse déterministe immédiate (greeting/thanks/stats/rien-trouvé), pas de LLM.
 * - `draft` + `messages` : intents RAG → on stream `messages`, repli sur `draft` si le LLM lâche.
 */
export interface PreparedTurn {
  found: boolean;
  intent: Intent;
  sources: ChatSource[];
  followups: string[];
  fixed?: string;
  draft?: string;
  messages?: ChatTurn[];
}

// Termes de recherche conscients du contexte : sur une relance courte/anaphorique
// (« et sa toupie ? », « lui »), on réinjecte le dernier tour utilisateur pour que le RAG
// retrouve la bonne entité (la mémoire vit au niveau du modèle, le retrieval doit suivre).
function contextualTerms(message: string, history: ChatTurn[]): string {
  const base = searchTerms(message);
  if (base.length >= 14) return base;
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content;
  return lastUser ? searchTerms(`${lastUser} ${message}`) : base;
}

/**
 * Prépare un tour de chat (retrieval + brouillon + messages), SANS appel LLM. Cœur partagé
 * du streaming et du non-stream. `history` = tours précédents (mémoire conversationnelle).
 */
export async function prepareTurn(
  message: string,
  history: ChatTurn[] = [],
): Promise<PreparedTurn> {
  const intent = detectIntent(message);

  if (intent === "greeting") {
    return {
      found: true,
      intent,
      sources: [],
      followups: ["Meilleur combo méta ?", "Qui est Ryuga ?", "Explique le Burst Finish"],
      fixed: GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!,
    };
  }
  if (intent === "thanks") {
    return {
      found: true,
      intent,
      sources: [],
      followups: followupsFor("meta"),
      fixed: "Avec plaisir. Reviens quand tu veux dominer la méta.",
    };
  }

  // Statistiques du savoir : réponse chiffrée RÉELLE (compte du corpus, zéro invention).
  if (intent === "stats") {
    const s = await answerStats(intent);
    return {
      found: s.found,
      intent,
      sources: s.sources,
      followups: s.followups,
      fixed: s.answerMd,
    };
  }

  // Comparaison « X vs Y » : opposition côte à côte si deux entités sont isolables.
  if (intent === "compare") {
    const cmp = await answerCompare(message, intent, history);
    if (cmp) return cmp; // sinon : repli sur le flux générique ci-dessous.
  }

  const cat = INTENT_CATEGORY[intent];
  const terms = contextualTerms(message, history);
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
      sources: [],
      followups: suggestions.length
        ? suggestions
        : ["Meilleur combo méta ?", "Les pièces les plus fortes ?", "Prochain tournoi ?"],
      fixed:
        "Je n'ai rien trouvé de précis là-dessus. Donne-moi le nom exact (toupie, pièce, perso) et je creuse — ou tente une de ces pistes.",
    };
  }

  const sources = items.slice(0, 4).map(toSource);
  const followups = followupsFor(intent);

  // Brouillon EXTRACTIF déterministe par intention. Sert de repli si le LLM est inactif
  // ou échoue ; sinon il est reformulé en français naturel par le LLM (RAG + mémoire).
  let draft: string;

  if (intent === "combo") {
    const lines = items.slice(0, 5).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    draft = `Les combos qui dominent les tournois :\n\n${lines.join("\n")}`;
  } else if (intent === "best" || intent === "meta") {
    const lines = items.slice(0, 6).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    draft = `Le classement méta du moment :\n\n${lines.join("\n")}`;
  } else if (intent === "buy") {
    const lead = items[0]!;
    const rest = items.slice(1, 4).map(bullet);
    draft = `Le meilleur prix que j'ai déniché :\n\n${bullet(lead)}`;
    if (rest.length) draft += `\n\nAutres pistes :\n${rest.join("\n")}`;
  } else if (intent === "tournament") {
    const lines = items.slice(0, 6).map(bullet);
    draft = `Du côté des arènes :\n\n${lines.join("\n")}`;
  } else {
    // define / character / rules : on mène par une entrée faisant AUTORITÉ, enrichie de sa
    // ligne de stat (tier / score méta / buzz) quand elle existe.
    const lead = items.find((it) => AUTH.has(it.category)) ?? items[0]!;
    const others = items.filter((it) => it.id !== lead.id);
    draft = bullet(lead);
    const stat = statLine(lead);
    if (stat) draft += `\n\n\`${stat}\``;
    if (lead.details) draft += `\n\n${clip(lead.details, 480)}`;
    const more = others.slice(0, 3).map(bullet);
    if (more.length) draft += `\n\n**À explorer aussi :**\n${more.join("\n")}`;
  }

  return {
    found: true,
    intent,
    sources,
    followups,
    draft,
    messages: buildMessages(message, intent, items, history),
  };
}

/**
 * Réponse complète NON-streaming (repli / clients sans SSE). Le streaming passe par
 * `prepareTurn` + `generateStream` directement dans la route `POST /api/chat`.
 */
export async function answerQuestion(
  message: string,
  history: ChatTurn[] = [],
): Promise<ChatAnswer> {
  const p = await prepareTurn(message, history);
  let answerMd: string;
  if (p.fixed != null) {
    answerMd = p.fixed;
  } else {
    answerMd = p.draft ?? "";
  }
  return { found: p.found, intent: p.intent, answerMd, sources: p.sources, followups: p.followups };
}
