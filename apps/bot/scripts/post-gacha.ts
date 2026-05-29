#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Poste le catalogue gacha sur Discord via le bot RPBey (REST v10, multipart natif).
 *   - --catalog : images optimisées triées, groupées par (personnage, dessinateur).
 *     Salon texte -> 1 message/groupe ; salon Forum/Media -> 1 post (thread)/groupe.
 *     Légendes riches : rareté · série · statut + notes par image.
 *   - --summary : résumé règles/lore/vibe (fichier .md, découpé sur @@@).
 *   - --purge   : supprime d'abord les posts existants du bot dans le forum cible.
 *
 * Token lu depuis DISCORD_TOKEN (.env auto-chargé). Le bot doit avoir
 * Send Messages + Attach Files (+ Create Posts / Manage Threads) sur la cible.
 *
 * Usage :
 *   bun scripts/post-gacha.ts --channel=<srcId> --catalog=<id> [--summary=<id>] [--purge] [--dry]
 */
import { resolve, join, basename } from "node:path";

const args = new Map<string, string>();
const flags = new Set<string>();
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--") && a.includes("=")) {
    const [k, v] = a.slice(2).split("=", 2);
    args.set(k, v ?? "");
  } else if (a.startsWith("--")) {
    flags.add(a.slice(2));
  }
}
const API = "https://discord.com/api/v10";
const CHANNEL_ID = args.get("channel");
const DIR_ARG = args.get("dir");
const CATALOG = args.get("catalog");
const SUMMARY = args.get("summary");
const DRY = flags.has("dry");
const PURGE = flags.has("purge");
const MAX_FILES = 10;
const CH_FORUM = 15;
const CH_MEDIA = 16;

const log = (m: string) => process.stderr.write(`${m}\n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  log("DISCORD_TOKEN manquant (lance depuis apps/bot).");
  process.exit(1);
}
const AUTH = { Authorization: `Bot ${TOKEN}` };

function resolveBaseDir(): string {
  const d = DIR_ARG
    ? resolve(DIR_ARG)
    : CHANNEL_ID
      ? resolve(import.meta.dirname, "..", "data/scrape", CHANNEL_ID)
      : null;
  if (!d) {
    log("Fournis --channel=<id> ou --dir=<chemin>.");
    process.exit(1);
  }
  return d;
}
const baseDir = resolveBaseDir();

interface GachaEntry {
  id: string;
  character: string | null;
  series: string | null;
  rarity: string | null;
  kind: "card" | "illustration" | "template" | "portfolio" | "meme";
  status: string | null;
  artist: string;
  image: string;
  note: string | null;
  sourceFilename: string;
}

/** fetch + retry réseau / 429 / 5xx + respect du bucket. */
async function api(path: string, init: RequestInit, files: string[] = []): Promise<Response> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let res: Response;
    try {
      let body = init.body;
      if (files.length > 0 && typeof body === "string") {
        const form = new FormData();
        form.append("payload_json", body);
        files.forEach((p, i) => form.append(`files[${i}]`, Bun.file(p), basename(p)));
        body = form;
      }
      res = await fetch(`${API}${path}`, { ...init, headers: AUTH, body });
    } catch (e) {
      if (attempt === 7) throw e;
      await sleep(2 ** attempt * 300);
      continue;
    }
    if (res.status === 429) {
      const j = (await res.json().catch(() => ({}))) as {
        retry_after?: number;
      };
      await sleep((j.retry_after ?? Number(res.headers.get("retry-after") ?? "1")) * 1000 + 200);
      continue;
    }
    if (res.status >= 500) {
      await sleep(2 ** attempt * 300);
      continue;
    }
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset-after") ?? "0");
      if (reset > 0) await sleep(reset * 1000 + 50);
    }
    return res;
  }
  throw new Error(`retries épuisés sur ${path}`);
}

async function ensureOk(res: Response, channel: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 403)
    throw new Error(`403 — pas la perm (Send/Attach/Create Posts/Manage Threads) sur ${channel}.`);
  if (res.status === 404) throw new Error(`404 — salon ${channel} introuvable (bot absent ?).`);
  throw new Error(`HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`);
}

async function getChannel(channel: string): Promise<{ type: number; guild_id: string }> {
  const res = await api(`/channels/${channel}`, { method: "GET" });
  await ensureOk(res, channel);
  return (await res.json()) as { type: number; guild_id: string };
}

async function postMessage(channel: string, content: string, files: string[] = []): Promise<void> {
  const payload = JSON.stringify({ allowed_mentions: { parse: [] }, content });
  const res = await api(`/channels/${channel}/messages`, { method: "POST", body: payload }, files);
  await ensureOk(res, channel);
}

async function createForumPost(
  channel: string,
  name: string,
  content: string,
  files: string[],
): Promise<void> {
  const payload = JSON.stringify({
    name: name.slice(0, 100),
    message: { allowed_mentions: { parse: [] }, content },
  });
  const res = await api(`/channels/${channel}/threads`, { method: "POST", body: payload }, files);
  await ensureOk(res, channel);
}

/** Supprime les posts existants du bot dans un forum (avant re-publication). */
async function purgeForum(channel: string, guildId: string): Promise<void> {
  const res = await api(`/guilds/${guildId}/threads/active`, { method: "GET" });
  await ensureOk(res, channel);
  const { threads } = (await res.json()) as {
    threads: { id: string; parent_id: string }[];
  };
  const mine = threads.filter((t) => t.parent_id === channel);
  log(`[post] purge : ${mine.length} posts à supprimer dans ${channel}`);
  for (const t of mine) {
    if (DRY) {
      log(`  [dry] delete thread ${t.id}`);
      continue;
    }
    await ensureOk(await api(`/channels/${t.id}`, { method: "DELETE" }), channel);
    log(`  ✓ supprimé ${t.id}`);
  }
}

// ── résumé ───────────────────────────────────────────────────────────────────
async function postSummary(): Promise<void> {
  if (!SUMMARY) return;
  const file = args.get("summary-file") ?? join(baseDir, "gacha-summary.md");
  if (!(await Bun.file(file).exists())) {
    log(`[post] résumé introuvable : ${file}`);
    return;
  }
  const parts = (await Bun.file(file).text())
    .split(/\n@@@\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const { type } = await getChannel(SUMMARY);
  const isForum = type === CH_FORUM || type === CH_MEDIA;
  log(`[post] résumé → ${SUMMARY} (${parts.length} parties)`);
  if (DRY) return;
  if (isForum) {
    await createForumPost(SUMMARY, "Récap projet Gacha — règles, lore & vibe", parts[0] ?? "", []);
    return;
  }
  for (const [i, content] of parts.entries()) {
    await postMessage(SUMMARY, content.slice(0, 1990));
    log(`  ✓ résumé ${i + 1}/${parts.length}`);
  }
}

// ── catalogue ─────────────────────────────────────────────────────────────────
interface Group {
  entries: GachaEntry[];
}
function caption(g: Group): string {
  const e = g.entries[0]!;
  const head =
    e.kind === "card"
      ? `**${e.character}** · ${e.rarity ?? "?"}${e.series ? ` · ${e.series}` : ""} — par ${e.artist}`
      : e.kind === "illustration"
        ? `🖼️ **${e.character}** *(illustration spéciale)* — par ${e.artist}`
        : `*[hors bannière · ${e.kind}]* ${e.character ?? ""} — par ${e.artist}`.trim();
  const detail =
    g.entries.length > 1
      ? `\n` +
        g.entries
          .map((x) => `• \`${x.id}\` ${x.status ?? "—"}${x.note ? ` · ${x.note}` : ""}`)
          .join("\n")
      : g.entries[0]!.note
        ? ` · ${g.entries[0]!.note}`
        : "";
  return `${head}${detail}`;
}
function threadName(g: Group): string {
  const e = g.entries[0]!;
  if (e.kind === "card") return `${e.character} · ${e.rarity ?? "?"} — ${e.artist}`;
  if (e.kind === "illustration") return `${e.character} — ${e.artist}`;
  return `[Hors bannière] ${e.character ?? e.kind} — ${e.artist}`;
}

async function postCatalog(): Promise<void> {
  if (!CATALOG) return;
  const gachaPath = join(baseDir, "gacha.json");
  if (!(await Bun.file(gachaPath).exists())) {
    log(`[post] gacha.json introuvable (lance build-gacha-json.ts).`);
    return;
  }
  const entries = JSON.parse(await Bun.file(gachaPath).text()) as GachaEntry[];
  const { type, guild_id } = await getChannel(CATALOG);
  const isForum = type === CH_FORUM || type === CH_MEDIA;

  if (PURGE) await purgeForum(CATALOG, guild_id);

  // Groupe par (personnage, dessinateur, kind), ≤10 fichiers/post.
  const groups: Group[] = [];
  let curKey = "";
  for (const e of entries) {
    const key = `${e.kind}|${e.character ?? ""}|${e.artist}`;
    const last = groups[groups.length - 1];
    if (key !== curKey || (last?.entries.length ?? 0) >= MAX_FILES) {
      groups.push({ entries: [] });
      curKey = key;
    }
    groups[groups.length - 1]?.entries.push(e);
  }

  log(
    `[post] catalogue → ${CATALOG} (${isForum ? "forum/media" : "texte"}, ${groups.length} groupes)`,
  );
  if (DRY) {
    for (const g of groups) log(`  [dry] ${threadName(g)} (${g.entries.length})`);
    return;
  }

  if (!isForum) {
    const cards = entries.filter((e) => e.kind === "card").length;
    await postMessage(
      CATALOG,
      `# 🎴 Catalogue Gacha — ${entries.length} illustrations (${cards} cartes)\n` +
        `Trié par rareté puis personnage. PNG lossless / JPEG→WebP q90.`,
    );
  }

  let i = 0;
  for (const g of groups) {
    i++;
    const files = g.entries.map((e) => join(baseDir, e.image));
    if (isForum) await createForumPost(CATALOG, threadName(g), caption(g), files);
    else await postMessage(CATALOG, caption(g), files);
    log(`  ✓ ${i}/${groups.length} ${threadName(g)} (${files.length})`);
  }
}

try {
  await postSummary();
} catch (e) {
  log(`[post] résumé échec : ${(e as Error).message}`);
}
try {
  await postCatalog();
} catch (e) {
  log(`[post] catalogue échec : ${(e as Error).message}`);
}
log("[post] terminé.");
process.exit(0);
