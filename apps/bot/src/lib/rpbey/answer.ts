/**
 * Moteur de réponse de Rpbey (ZÉRO LLM) — retrieval + synthèse extractive.
 *
 * Retrieval : l'API web `/api/v1/search` (recherche HYBRIDE BM25F ⊕ dense sur le
 * corpus UNIFIÉ — wiki Fandom toutes saisons, combos WBO enrichis, méta, produits,
 * pièces DB, tournois, discussions Discord/X/Reddit). C'est l'« omniscience » : tout
 * le savoir consolidé est interrogeable. L'intention (cf. nlp) biaise la catégorie et
 * la mise en forme. Synthèse : 100 % extractive + templates (faits intacts, jamais
 * inventés). La voix Ryuga est appliquée par `persona.speak()` au-dessus.
 */
import { detectIntent, INTENT_CATEGORY, searchTerms, type Intent } from "./nlp.js";

// Default to the public Vercel origin so the Cloud Run bot reaches it with zero
// extra config; `RPBEY_WEB_BASE` overrides (preview deployment / local dev).
const WEB_BASE = process.env.RPBEY_WEB_BASE ?? "https://rpbey.fr";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  url: string;
  details?: string;
  badge?: string;
  score?: number;
}

export interface RpbeyAnswer {
  found: boolean;
  intent: Intent;
  bodyMd: string;
  sources: { title: string; url: string }[];
}

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

function absUrl(u: string): string {
  return u.startsWith("http") ? u : `https://rpbey.fr${u}`;
}

function clip(s: string, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

async function search(q: string, category: string | null, limit: number): Promise<SearchItem[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (category) params.set("category", category);
  try {
    const res = await fetch(`${WEB_BASE}/api/v1/search?${params}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: SearchItem[] | { data?: SearchItem[] } };
    // Tolère l'enveloppe getRoute {ok,data:{data}} ET un payload direct {data:[]}.
    const arr = Array.isArray(json.data) ? json.data : (json.data?.data ?? []);
    return arr;
  } catch {
    return [];
  }
}

/** Une ligne « titre lié + badge + sous-titre ». */
function bullet(it: SearchItem): string {
  const emoji = CATEGORY_EMOJI[it.category] ?? "•";
  const badge = it.badge ? ` \`${it.badge}\`` : "";
  const sub = it.subtitle ? ` — ${it.subtitle}` : "";
  return `${emoji} **[${it.title}](${absUrl(it.url)})**${badge}${sub}`;
}

/** Compose la réponse factuelle (Markdown) à une question Beyblade. */
export async function compose(question: string): Promise<RpbeyAnswer> {
  const intent = detectIntent(question);
  const empty = (body: string): RpbeyAnswer => ({
    found: false,
    intent,
    bodyMd: body,
    sources: [],
  });

  // Salutations / remerciements : pas de retrieval, géré par la voix seule.
  if (intent === "greeting" || intent === "thanks") {
    return { found: true, intent, bodyMd: "", sources: [] };
  }

  const cat = INTENT_CATEGORY[intent];
  // Focalise la recherche sur l'ENTITÉ (retire « c'est quoi », « qui est »…).
  const terms = searchTerms(question);
  let items = await search(terms, cat, 8);
  // Élargit si le filtre de catégorie ne donne rien (le savoir est ailleurs).
  if (items.length === 0 && cat) items = await search(terms, null, 8);
  if (items.length === 0) return empty("");

  const sources = items.slice(0, 4).map((it) => ({ title: it.title, url: absUrl(it.url) }));

  // ── Synthèse par intention (extractive) ──────────────────────────────────────
  if (intent === "combo") {
    const lines = items.slice(0, 5).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    return {
      found: true,
      intent,
      bodyMd: `**Les combos qui dominent les tournois :**\n${lines.join("\n")}`,
      sources,
    };
  }

  if (intent === "best" || intent === "meta") {
    const lines = items.slice(0, 6).map((it, i) => `**${i + 1}.** ${bullet(it)}`);
    return {
      found: true,
      intent,
      bodyMd: `**Le classement méta du moment :**\n${lines.join("\n")}`,
      sources,
    };
  }

  if (intent === "buy") {
    const lead = items[0]!;
    const rest = items.slice(1, 4).map(bullet);
    let body = `Le meilleur prix que j'ai déniché :\n${bullet(lead)}`;
    if (rest.length) body += `\n\nAutres pistes :\n${rest.join("\n")}`;
    return { found: true, intent, bodyMd: body, sources };
  }

  if (intent === "tournament") {
    const lines = items.slice(0, 6).map(bullet);
    return {
      found: true,
      intent,
      bodyMd: `**Du côté des arènes :**\n${lines.join("\n")}`,
      sources,
    };
  }

  // define / character / compare / rules / stats : on mène par une entrée FAISANT
  // AUTORITÉ (wiki/pièce/produit/anime/lexique) plutôt qu'un message de chat — sinon
  // « c'est quoi X » peut remonter une discussion Discord en tête.
  const AUTH = new Set(["part", "product", "anime", "lexicon", "meta", "combo", "tournament"]);
  const lead = items.find((it) => AUTH.has(it.category)) ?? items[0]!;
  const others = items.filter((it) => it.id !== lead.id);
  let body = bullet(lead);
  if (lead.details) body += `\n\n${clip(lead.details, 460)}`;
  const more = others.slice(0, 3).map(bullet);
  if (more.length) body += `\n\n**À explorer aussi :**\n${more.join("\n")}`;
  return { found: true, intent, bodyMd: body, sources };
}
