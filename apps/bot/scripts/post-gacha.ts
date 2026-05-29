#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Poste le catalogue gacha sur Discord via le bot RPBey (REST v10, multipart natif).
 *   - --catalog : 1 post (forum) par personnage = la CARTE ENCADRÉE (template de
 *     soupy, via render-cards.ts) en tête + les étapes WIP brutes derrière.
 *     Salon texte -> 1 message/groupe. Le template nu et le hors-histoire ne sont
 *     pas postés (exclus en amont).
 *   - --summary : résumé règles/lore/vibe (fichier .md, découpé sur @@@).
 *   - --purge   : supprime d'abord les posts existants du bot dans le forum cible.
 *
 * Token lu depuis DISCORD_TOKEN (.env auto-chargé).
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
}

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
  character: string;
  entries: GachaEntry[];
}
function caption(g: Group, framed: boolean): string {
  const e = g.entries[0]!;
  const head =
    e.kind === "card"
      ? `**${g.character}** · ${e.rarity ?? "?"}${e.series ? ` · ${e.series}` : ""} — par ${e.artist}`
      : `🖼️ **${g.character}** *(illustration spéciale)* — par ${e.artist}`;
  const stages = g.entries
    .map((x) => `• \`${x.id}\` ${x.status ?? "—"}${x.note ? ` · ${x.note}` : ""}`)
    .join("\n");
  const lead = framed
    ? `🎴 *Carte montée sur le template de soupy* + ${g.entries.length} étape(s)\n`
    : "";
  return `${head}\n${lead}${stages}`;
}
function threadName(g: Group): string {
  const e = g.entries[0]!;
  if (e.kind === "card") return `${g.character} · ${e.rarity ?? "?"} — ${e.artist}`;
  return `${g.character} — ${e.artist}`;
}

async function postCatalog(): Promise<void> {
  if (!CATALOG) return;
  const gachaPath = join(baseDir, "gacha.json");
  if (!(await Bun.file(gachaPath).exists())) {
    log(`[post] gacha.json introuvable (lance build-gacha-json.ts).`);
    return;
  }
  const all = JSON.parse(await Bun.file(gachaPath).text()) as GachaEntry[];
  // Seules les cartes + illustrations sont publiées (template nu / hors-histoire exclus).
  const entries = all.filter(
    (e) => (e.kind === "card" || e.kind === "illustration") && e.character,
  );

  const manifestPath = join(baseDir, "cards-manifest.json");
  const manifest: Record<string, string> = (await Bun.file(manifestPath).exists())
    ? (JSON.parse(await Bun.file(manifestPath).text()) as Record<string, string>)
    : {};

  // Groupe par personnage (les étapes WIP d'un même perso ensemble).
  const groups: Group[] = [];
  let curKey = "";
  for (const e of entries) {
    const key = `${e.character}`;
    const last = groups[groups.length - 1];
    if (key !== curKey || (last?.entries.length ?? 0) >= MAX_FILES - 1) {
      groups.push({ character: e.character!, entries: [] });
      curKey = key;
    }
    groups[groups.length - 1]?.entries.push(e);
  }

  const { type, guild_id } = await getChannel(CATALOG);
  const isForum = type === CH_FORUM || type === CH_MEDIA;
  if (PURGE) await purgeForum(CATALOG, guild_id);

  log(`[post] catalogue → ${CATALOG} (${isForum ? "forum" : "texte"}, ${groups.length} cartes)`);
  if (DRY) {
    for (const g of groups) {
      const framed = !!manifest[g.character];
      log(`  [dry] ${threadName(g)} ${framed ? "[+carte]" : ""} (${g.entries.length} wip)`);
    }
    return;
  }
  if (!isForum) {
    await postMessage(
      CATALOG,
      `# 🎴 Catalogue Gacha — ${groups.length} cartes (montées sur le template de soupy)\nTrié par rareté puis personnage.`,
    );
  }

  let i = 0;
  for (const g of groups) {
    i++;
    const framedRel = manifest[g.character];
    const framed = framedRel ? join(baseDir, framedRel) : null;
    const wip = g.entries.map((e) => join(baseDir, e.image));
    const files = (framed ? [framed, ...wip] : wip).slice(0, MAX_FILES);
    const text = caption(g, !!framed);
    if (isForum) await createForumPost(CATALOG, threadName(g), text, files);
    else await postMessage(CATALOG, text, files);
    log(`  ✓ ${i}/${groups.length} ${threadName(g)} (${files.length} img)`);
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
