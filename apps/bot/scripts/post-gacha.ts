#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Poste le catalogue gacha sur Discord via le bot RPBey lui-même (REST v10,
 * upload multipart natif) :
 *   - dans --catalog : les images optimisées triées (groupées par personnage
 *     puis dessinateur, ≤10 fichiers/message). Salon texte -> 1 en-tête + 1
 *     message/groupe ; salon Forum/Media -> 1 post (thread) par groupe.
 *   - dans --summary : le résumé règles/lore/vibe (fichier .md, découpé sur @@@).
 *
 * Le bot doit être présent dans le serveur et avoir Send Messages + Attach Files
 * (+ Create Posts pour un forum) sur les salons cibles. Token lu depuis
 * DISCORD_TOKEN (.env auto-chargé).
 *
 * Usage :
 *   bun scripts/post-gacha.ts --channel=<srcId> --catalog=<id> --summary=<id>
 *   bun scripts/post-gacha.ts --dir=data/scrape/<id> --catalog=<id> --summary=<id> --dry
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
  artist: string;
  image: string;
  format: string;
  sourceFilename: string;
}

/** Enveloppe fetch : retry réseau + 429 + back-off 5xx + respect du bucket. */
async function api(path: string, init: RequestInit, files: string[] = []): Promise<Response> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let res: Response;
    try {
      let body = init.body;
      if (files.length > 0 && body && typeof body === "string") {
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
    throw new Error(`403 — pas la perm (Send/Attach/Create Posts) sur ${channel}.`);
  if (res.status === 404) throw new Error(`404 — salon ${channel} introuvable (bot absent ?).`);
  throw new Error(`HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`);
}

/** Message dans un salon texte. */
async function postMessage(channel: string, content: string, files: string[] = []): Promise<void> {
  const payload = JSON.stringify({ allowed_mentions: { parse: [] }, content });
  const res = await api(`/channels/${channel}/messages`, { method: "POST", body: payload }, files);
  await ensureOk(res, channel);
}

/** Post (thread) dans un salon Forum/Media. */
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

async function channelType(channel: string): Promise<number> {
  const res = await api(`/channels/${channel}`, { method: "GET" });
  await ensureOk(res, channel);
  return ((await res.json()) as { type: number }).type;
}

// ── résumé ───────────────────────────────────────────────────────────────────
async function postSummary(): Promise<void> {
  if (!SUMMARY) {
    log("[post] pas de --summary, skip résumé.");
    return;
  }
  const file = args.get("summary-file") ?? join(baseDir, "gacha-summary.md");
  if (!(await Bun.file(file).exists())) {
    log(`[post] résumé introuvable : ${file}`);
    return;
  }
  const parts = (await Bun.file(file).text())
    .split(/\n@@@\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const type = await channelType(SUMMARY);
  const isForum = type === CH_FORUM || type === CH_MEDIA;
  log(
    `[post] résumé → ${SUMMARY} (type ${type}${isForum ? " forum" : ""}, ${parts.length} parties)`,
  );
  if (DRY) {
    parts.forEach((p, i) => log(`  [dry] résumé ${i + 1} (${p.length} car.)`));
    return;
  }
  if (isForum) {
    // 1 post unique avec le 1er bloc, puis les suivants en réponses dans le thread.
    await createForumPost(SUMMARY, "Récap projet Gacha — règles, lore & vibe", parts[0] ?? "", []);
    log(`  ✓ post résumé créé`);
    return;
  }
  for (const [i, content] of parts.entries()) {
    await postMessage(SUMMARY, content.slice(0, 1990));
    log(`  ✓ résumé ${i + 1}/${parts.length}`);
  }
}

// ── catalogue images ─────────────────────────────────────────────────────────
async function postCatalog(): Promise<void> {
  if (!CATALOG) {
    log("[post] pas de --catalog, skip images.");
    return;
  }
  const gachaPath = join(baseDir, "gacha.json");
  if (!(await Bun.file(gachaPath).exists())) {
    log(`[post] gacha.json introuvable (lance build-gacha-json.ts).`);
    return;
  }
  const entries = JSON.parse(await Bun.file(gachaPath).text()) as GachaEntry[];

  // Regroupe par (personnage, dessinateur) en conservant l'ordre trié.
  const groups: {
    char: string;
    artist: string;
    files: string[];
    ids: string[];
  }[] = [];
  let curKey = "";
  for (const e of entries) {
    const charLabel = e.character ?? "À classer";
    const key = `${charLabel}|${e.artist}`;
    const path = join(baseDir, e.image);
    const last = groups[groups.length - 1];
    if (key !== curKey || (last?.files.length ?? 0) >= MAX_FILES) {
      groups.push({ char: charLabel, artist: e.artist, files: [], ids: [] });
      curKey = key;
    }
    const g = groups[groups.length - 1];
    if (g) {
      g.files.push(path);
      g.ids.push(e.id);
    }
  }

  const type = await channelType(CATALOG);
  const isForum = type === CH_FORUM || type === CH_MEDIA;
  log(
    `[post] catalogue → ${CATALOG} (type ${type}${isForum ? " forum/media" : " texte"}, ${groups.length} groupes)`,
  );
  if (DRY) {
    for (const g of groups)
      log(`  [dry] ${g.char} — ${g.artist} (${g.files.length}: ${g.ids.join(",")})`);
    return;
  }

  if (!isForum) {
    await postMessage(
      CATALOG,
      `# 🎴 Catalogue Gacha — ${entries.length} illustrations\n` +
        `Trié par personnage puis dessinateur. PNG lossless (oxipng) / JPEG→WebP q90.`,
    );
  }

  let i = 0;
  for (const g of groups) {
    i++;
    const caption =
      `**${g.char}** — par ${g.artist}` +
      `${g.files.length > 1 ? ` · ${g.files.length} illus` : ""} · \`${g.ids.join(" ")}\``;
    if (isForum) {
      await createForumPost(CATALOG, `${g.char} · ${g.artist}`, caption, g.files);
    } else {
      await postMessage(CATALOG, caption, g.files);
    }
    log(`  ✓ ${i}/${groups.length} ${g.char} — ${g.artist} (${g.files.length})`);
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
