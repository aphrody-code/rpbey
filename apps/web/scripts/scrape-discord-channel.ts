#!/usr/bin/env bun
/**
 * scrape-discord-channel.ts — dump EXHAUSTIF & rapide d'un salon Discord vers un
 * export prêt pour le RAG (corpus de recherche unifié, catégorie "discussion").
 *
 * Cible par défaut : le salon **Beyblade X** (`1323818330179768371`). Aspire TOUT
 * l'historique du salon — messages + fils (threads actifs + archivés publics) —
 * via l'API REST Discord v10, en **APIs Bun natives** (`fetch` natif, `Bun.write`,
 * `Bun.file`). Nettoie/classe chaque message (topic Beyblade, langue, pertinence)
 * et écrit un JSON conforme au contrat `DiscordDiscussionSchema`, consommé par
 * `global-search.loadDiscordDiscussions` (puis embeddé par `build-search-vectors`).
 *
 * « Le plus robuste possible » :
 *   - **Pagination intégrale** (cursor `before`, 100/req) jusqu'à épuisement.
 *   - **Fils** : threads actifs (via guild) + archivés publics, dumpés récursivement.
 *   - **Rate-limit natif Discord** : respect de `x-ratelimit-remaining` /
 *     `…-reset-after`, et du `retry_after` sur 429 (global + bucket). Retry/backoff
 *     sur 5xx/réseau (≤ 6).
 *   - **Checkpoint résumable** (`data/.discord-crawl-state.json`, gitignored) :
 *     reprise du backfill ; mode incrémental `DISCORD_SINCE=1` (ne récupère que les
 *     messages postés depuis le dernier run).
 *   - **Écriture non-destructive** (jamais d'écrasement par du vide).
 *
 * Auth : `process.env.DISCORD_TOKEN` (jamais loggé). Lancer avec l'env du bot :
 *   bun --env-file=apps/bot/.env apps/web/scripts/scrape-discord-channel.ts
 *   DISCORD_CHANNEL_ID=… DISCORD_SINCE=1 bun --env-file=apps/bot/.env apps/web/scripts/scrape-discord-channel.ts
 */
import { DiscordDiscussionSchema, type DiscordDiscussion } from "@rpbey/api-contract";

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID ?? "1323818330179768371"; // salon Beyblade X
const OUT = "data/discord-discussions.json";
const STATE = "data/.discord-crawl-state.json";
const PAGE = 100; // max messages/req
const MIN_LEN = 8; // longueur de texte minimale (sauf message très réagi)
const INCREMENTAL = process.env.DISCORD_SINCE === "1";

if (!TOKEN) {
  console.error("[discord] DISCORD_TOKEN absent de l'environnement (lancer avec --env-file).");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Couche HTTP Discord (rate-limit aware, retry/backoff) ──────────────────────

// Garde anti-ban Cloudflare : 10 000 requêtes invalides (401/403/429) / 10 min →
// ban IP temporaire. On compte et on s'arrête bien avant (lecture seule, 1 IP VPS).
let invalidRequests = 0;

/**
 * GET sur l'API Discord avec gestion native du rate-limit (doc discord.js / Discord
 * API) : honore `retry_after` (secondes) sur 429 quel que soit le scope (user/global/
 * shared), patiente proactivement quand le bucket est épuisé (`x-ratelimit-remaining: 0`
 * → `…-reset-after`), retry/backoff sur 5xx/réseau (≤ 6). `User-Agent` au format EXIGÉ
 * `DiscordBot ($url, $version)` (sinon challenge Cloudflare). Renvoie `null` sur 403/404
 * (salon/fil inaccessible → saut propre) ; 401 = token invalide (fatal).
 */
async function discordGet<T>(path: string, attempt = 0): Promise<T | null> {
  if (invalidRequests > 2000)
    throw new Error("[discord] trop de requêtes invalides — arrêt (garde anti-ban Cloudflare).");
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "User-Agent": "DiscordBot (https://rpbey.fr, 1.0.0)",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 429) {
      invalidRequests++;
      const scope = res.headers.get("x-ratelimit-scope") ?? "user";
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const retry = Math.max(body.retry_after ?? 1, Number(res.headers.get("retry-after") ?? 0));
      console.warn(`[discord] 429 (${scope}) — pause ${retry.toFixed(2)}s`);
      await sleep(retry * 1000 + 250);
      return discordGet<T>(path, attempt);
    }
    if (res.status === 401) throw new Error("[discord] 401 — DISCORD_TOKEN invalide.");
    if (res.status === 403 || res.status === 404) {
      invalidRequests++;
      return null;
    }
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    // Bucket épuisé → patiente la fenêtre (reset-after, relatif, sans dérive d'horloge)
    // avant le prochain appel : zéro 429, débit maximal tant que remaining > 0.
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1");
    const resetAfter = Number(res.headers.get("x-ratelimit-reset-after") ?? "0");
    if (remaining <= 0 && resetAfter > 0) await sleep(resetAfter * 1000 + 100);

    return (await res.json()) as T;
  } catch (e) {
    if (attempt >= 6) throw e;
    await sleep(Math.min(20_000, 600 * 2 ** attempt));
    return discordGet<T>(path, attempt + 1);
  }
}

// ── Types Discord (sous-ensemble utile) ────────────────────────────────────────

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  bot?: boolean;
}
interface DiscordAttachment {
  url: string;
  filename: string;
  content_type?: string;
}
interface DiscordReaction {
  count: number;
}
interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
}
interface DiscordRawMessage {
  id: string;
  type: number;
  author: DiscordUser;
  content: string;
  timestamp: string;
  attachments?: DiscordAttachment[];
  embeds?: DiscordEmbed[];
  reactions?: DiscordReaction[];
  referenced_message?: { id: string } | null;
}
interface DiscordChannel {
  id: string;
  name?: string;
  type: number;
  guild_id?: string;
  parent_id?: string;
}
interface ThreadListing {
  threads: DiscordChannel[];
  has_more?: boolean;
}

// Types de messages porteurs de contenu conversationnel (DEFAULT / REPLY / THREAD_STARTER).
const CONTENT_TYPES = new Set([0, 19, 21]);

// ── Nettoyage & classification (RAG) ───────────────────────────────────────────

/** Normalise le contenu Discord en texte lisible pour le RAG. */
function cleanContent(s: string): string {
  return (s ?? "")
    .replace(/<a?:(\w+):\d+>/g, ":$1:") // émoji custom <:nom:id> → :nom:
    .replace(/<@!?(\d+)>/g, "@membre") // mention membre
    .replace(/<@&\d+>/g, "@rôle") // mention rôle
    .replace(/<#\d+>/g, "#salon") // mention salon
    .replace(/\|\|(.+?)\|\|/g, "$1") // spoilers ||x|| → x
    .replace(/```[a-z]*\n?/gi, "") // fences de bloc de code
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const JP_RX = /[぀-ヿ㐀-鿿]/;
const FR_DIACRITICS = /[àâçéèêëîïôûùüÿœæ]/i;
const FR_WORDS =
  /\b(le|la|les|un|une|des|du|de|et|est|pour|avec|dans|sur|qui|que|pas|plus|mais|ça|sont|été|très|jeu|toupie|nouvelle|gagné|victoire|tournoi|salut|merci)\b/i;

function detectLang(text: string): string {
  const t = text.trim();
  if (!t) return "und";
  if ((t.match(/[぀-ヿ]/g) ?? []).length >= 2 || (JP_RX.test(t) && t.length < 40)) return "ja";
  if (FR_DIACRITICS.test(t) || FR_WORDS.test(t)) return "fr";
  if (JP_RX.test(t)) return "ja";
  return "en";
}

const T_TOURNOI =
  /tournament|tournoi|大会|トーナメント|championship|nationals?|\bcup\b|bracket|swiss|podium|finals?\b|\bg[1-3]\b|\bs1\b|優勝|交流会|deck/i;
const T_SORTIE =
  /\b[bcu]x-?\d|release|reveal|leak|corocoro|コロコロ|予約|発売|新作|amazon|takara\s?tomy|タカラトミー|random\s?booster|ランダムブースター|スターター|booster|restock|stock|preorder|pre-?commande|sortie/i;
const T_ANIME =
  /\banime\b|アニメ|episode|épisode|エピソード|manga|漫画|opening|saison|season\s?\d|声優/i;
const T_PLAINTE =
  /shatter|crack|broke[n]?|wear|teeth\s?wear|paint|defect|fragile|壊れ|破損|割れ|摩耗|cassé|brisé|usure|abîmé|défaut|fissure/i;
const T_META =
  /\bmeta\b|メタ|wizard\s?rod|stamina|スタミナ|attack(er)?|アタック|defen[sc]e|combo|deck|tier\s?list|matchup|counter|\bban\b|best\s?(bey|combo|deck)|optimal|setup/i;

function classifyTopic(text: string): string {
  if (T_PLAINTE.test(text)) return "plainte_pieces";
  if (T_SORTIE.test(text)) return "sortie_produit";
  if (T_TOURNOI.test(text)) return "tournoi";
  if (T_META.test(text)) return "meta_combo";
  if (T_ANIME.test(text)) return "anime";
  return "communaute";
}

// Signaux Beyblade non-ambigus (le salon EST Beyblade X → pertinence de base haute,
// mais on note les messages réellement substantiels vs bruit/réactions courtes).
const STRONG =
  /beyblade|ベイブレ|bey\s?x|\b[bcu]x-?\d|toupie|blader|wizard\s?rod|dran|hells|cobalt|shark\s?edge|ratchet|xtreme|combo|deck|tournoi|meta|stamina|attack|defen[sc]e/i;

function relevanceScore(text: string, reactions: number): number {
  let score = 0.4; // base : message du salon Beyblade X
  if (STRONG.test(text)) score += 0.4;
  if (text.length >= 80) score += 0.1;
  if (reactions > 0) score += Math.min(0.1, reactions * 0.02);
  return Math.min(1, Math.round(score * 100) / 100);
}

// ── Construction d'un enregistrement RAG ────────────────────────────────────────

function buildRecord(
  m: DiscordRawMessage,
  channelName: string,
  guildId: string,
): DiscordDiscussion | null {
  if (!CONTENT_TYPES.has(m.type)) return null;

  // Texte = contenu + textes d'embeds (les liens partagés portent souvent le sens).
  const embedText = (m.embeds ?? [])
    .map((e) => [e.title, e.description].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join(" ");
  const text = cleanContent([m.content, embedText].filter(Boolean).join("\n")).trim();

  const attachments = (m.attachments ?? []).map((a) => ({
    url: a.url,
    type: a.content_type ?? "",
    name: a.filename,
  }));
  const reactions = (m.reactions ?? []).reduce((n, r) => n + (r.count ?? 0), 0);

  // Garde : texte exploitable. On tolère un texte court s'il est très réagi
  // (info marquante) ou s'il porte une pièce jointe (capture de combo/tournoi).
  if (text.length < MIN_LEN && reactions < 3 && attachments.length === 0) return null;
  if (!text && attachments.length === 0) return null;
  if (m.author.bot && text.length < MIN_LEN) return null;

  const candidate = {
    id: m.id,
    author: m.author.username,
    authorName: m.author.global_name || m.author.username,
    authorId: m.author.id,
    text: text || `[${attachments.length} pièce(s) jointe(s)]`,
    ts: m.timestamp,
    url: `https://discord.com/channels/${guildId}/${CHANNEL_ID}/${m.id}`,
    channel: channelName,
    replyTo: m.referenced_message?.id ?? null,
    attachments,
    reactions,
    topic: classifyTopic(text),
    lang: detectLang(text),
    relevance: relevanceScore(text, reactions),
  };

  const parsed = DiscordDiscussionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

// ── Pagination d'un salon/fil ───────────────────────────────────────────────────

/** Récupère TOUT l'historique d'un salon/fil (cursor `before`), ou seulement les
 * messages postés après `afterId` (mode incrémental). Renvoie les messages bruts. */
async function fetchAllMessages(
  channelId: string,
  opts: { afterId?: string | null; onPage?: (n: number) => void } = {},
): Promise<DiscordRawMessage[]> {
  const all: DiscordRawMessage[] = [];

  // Curseurs par snowflake (ordre de page NON supposé : on calcule min/max id).
  const maxId = (page: DiscordRawMessage[]) =>
    page.reduce((m, x) => (BigInt(x.id) > BigInt(m) ? x.id : m), page[0]!.id);
  const minId = (page: DiscordRawMessage[]) =>
    page.reduce((m, x) => (BigInt(x.id) < BigInt(m) ? x.id : m), page[0]!.id);

  if (opts.afterId) {
    // Incrémental : `after` = ne renvoie que les messages plus récents que le curseur ;
    // on avance vers le plus récent (max snowflake) jusqu'à épuisement.
    let after = opts.afterId;
    for (;;) {
      const page = await discordGet<DiscordRawMessage[]>(
        `/channels/${channelId}/messages?limit=${PAGE}&after=${after}`,
      );
      if (!page || page.length === 0) break;
      all.push(...page);
      after = maxId(page);
      opts.onPage?.(all.length);
      if (page.length < PAGE) break;
    }
    return all;
  }

  // Backfill complet : `before` recule vers le passé (min snowflake de la page).
  let before: string | null = null;
  for (;;) {
    const q: string = `/channels/${channelId}/messages?limit=${PAGE}${
      before ? `&before=${before}` : ""
    }`;
    const page = await discordGet<DiscordRawMessage[]>(q);
    if (!page || page.length === 0) break;
    all.push(...page);
    before = minId(page);
    opts.onPage?.(all.length);
    if (page.length < PAGE) break;
  }
  return all;
}

/** Liste tous les fils (actifs + archivés publics) rattachés au salon. */
async function listThreads(channel: DiscordChannel): Promise<DiscordChannel[]> {
  const threads: DiscordChannel[] = [];

  // Fils actifs : listés au niveau guilde, filtrés par parent.
  if (channel.guild_id) {
    const active = await discordGet<{ threads: DiscordChannel[] }>(
      `/guilds/${channel.guild_id}/threads/active`,
    );
    for (const t of active?.threads ?? []) if (t.parent_id === channel.id) threads.push(t);
  }

  // Fils archivés publics : paginés par `before` (timestamp ISO du dernier).
  let before: string | null = null;
  for (;;) {
    const q = `/channels/${channel.id}/threads/archived/public?limit=100${
      before ? `&before=${encodeURIComponent(before)}` : ""
    }`;
    const listing = await discordGet<ThreadListing>(q);
    const batch = listing?.threads ?? [];
    if (batch.length === 0) break;
    threads.push(...batch);
    // Le dernier fil de la page porte le plus ancien `archive_timestamp`.
    const last = batch[batch.length - 1] as DiscordChannel & {
      thread_metadata?: { archive_timestamp?: string };
    };
    before = last.thread_metadata?.archive_timestamp ?? null;
    if (!before || !listing?.has_more) break;
  }

  // Dédup par id (un fil peut être à la fois actif et listé ailleurs).
  const seen = new Set<string>();
  return threads.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();

  const channel = await discordGet<DiscordChannel>(`/channels/${CHANNEL_ID}`);
  if (!channel) throw new Error(`[discord] salon ${CHANNEL_ID} inaccessible (token/permissions).`);
  const guildId = channel.guild_id ?? "";
  const channelName = channel.name ?? CHANNEL_ID;
  console.log(`[discord] salon « ${channelName} » (type ${channel.type}, guilde ${guildId})`);

  // Reprise : on retient le dernier id vu (incrémental) + les enregistrements existants.
  let known = new Map<string, DiscordDiscussion>();
  let newestSeen: string | null = null;
  try {
    const prev = await Bun.file(OUT).json();
    for (const d of prev?.discussions ?? []) known.set(d.id, d);
    // Le plus grand snowflake = message le plus récent connu.
    for (const id of known.keys())
      if (!newestSeen || BigInt(id) > BigInt(newestSeen)) newestSeen = id;
    if (known.size) console.log(`[discord] ${known.size} messages déjà exportés (reprise).`);
  } catch {
    /* premier run */
  }

  const records: DiscordDiscussion[] = [];
  const pushRaw = (msgs: DiscordRawMessage[], chName: string) => {
    for (const m of msgs) {
      const rec = buildRecord(m, chName, guildId);
      if (rec) records.push(rec);
    }
  };

  // 1. Salon principal.
  const mainMsgs = await fetchAllMessages(CHANNEL_ID, {
    afterId: INCREMENTAL ? newestSeen : null,
    onPage: (n) => {
      if (n % 500 < PAGE) console.log(`[discord] salon : ${n} messages parcourus…`);
    },
  });
  pushRaw(mainMsgs, channelName);
  console.log(`[discord] salon principal : ${mainMsgs.length} messages bruts.`);

  // 2. Fils (threads) — on saute en incrémental rapide si aucun nouveau message racine.
  const threads = await listThreads(channel);
  if (threads.length) console.log(`[discord] ${threads.length} fils à parcourir…`);
  for (const th of threads) {
    const msgs = await fetchAllMessages(th.id, { afterId: INCREMENTAL ? newestSeen : null });
    pushRaw(msgs, th.name ?? channelName);
  }

  // Fusion avec l'existant (incrémental) + dédup par id.
  for (const r of records) known.set(r.id, r);
  const all = [...known.values()];

  if (all.length === 0) {
    console.error("[discord] 0 message exploitable — fichier préservé (non destructif).");
    return;
  }

  // Tri chronologique (ancien → récent) : ordre naturel de lecture pour le RAG.
  all.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const byTopic = new Map<string, number>();
  const byLang = new Map<string, number>();
  for (const d of all) {
    byTopic.set(d.topic, (byTopic.get(d.topic) ?? 0) + 1);
    byLang.set(d.lang, (byLang.get(d.lang) ?? 0) + 1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: `discord:#${channelName} (guilde ${guildId})`,
    channelId: CHANNEL_ID,
    channelName,
    count: all.length,
    discussions: all,
  };
  await Bun.write(OUT, JSON.stringify(payload, null, 2));
  await Bun.write(
    STATE,
    JSON.stringify({ channelId: CHANNEL_ID, count: all.length, ts: payload.generatedAt }),
  );

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[discord] OK — ${all.length} messages exportés → ${OUT} en ${secs}s.`);
  console.log("  topics :", [...byTopic.entries()].map(([t, n]) => `${t}(${n})`).join(", "));
  console.log("  langues :", [...byLang.entries()].map(([l, n]) => `${l}(${n})`).join(", "));
}

await main();
