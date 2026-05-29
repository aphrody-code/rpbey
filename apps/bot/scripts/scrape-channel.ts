#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Récupère TOUT l'historique d'un salon Discord — messages (JSONL structuré)
 * + toutes les images (attachments image/*, stickers, et en option embeds).
 *
 * Le plus rapide possible, 100 % APIs natives Bun :
 *   - `fetch` natif (keep-alive auto) directement sur l'API REST Discord v10 :
 *     PAS de discord.js, pas de gateway, pas d'alloc d'objets Message ni de
 *     cache — démarrage instantané, mémoire plate même sur 100k+ messages.
 *   - `Bun.write(dest, response)` streame le body HTTP sur disque sans buffer
 *     intermédiaire et renvoie le nombre d'octets écrits.
 *   - `Bun.file().writer()` (FileSink) pour l'écriture incrémentale du JSONL.
 *   - `Bun.file().exists()` pour la reprise.
 *
 * Robuste : pagination complète (`before`), respect des en-têtes de rate-limit
 * (`x-ratelimit-remaining` / `-reset-after`) + 429 (`retry_after`, scope global),
 * retry/back-off réseau, DL concurrents bornés, dédup, manifest, résumé.
 *
 * Le token est lu depuis `process.env.DISCORD_TOKEN` (bun charge `.env` quand on
 * lance depuis apps/bot) — jamais en argument, jamais loggé.
 *
 * Usage :
 *   bun scripts/scrape-channel.ts --channel=<id>
 *   bun scripts/scrape-channel.ts --channel=<id> --concurrency=12
 *   bun scripts/scrape-channel.ts --channel=<id> --all       # tous les attachments
 *   bun scripts/scrape-channel.ts --channel=<id> --embeds    # + images d'embeds
 *   bun scripts/scrape-channel.ts --channel=<id> --no-images # messages seulement
 *   bun scripts/scrape-channel.ts --channel=<id> --since=today | --days=N | --hours=N
 *   bun scripts/scrape-channel.ts --channel=<id> --max=5000  # plafond (test)
 *   bun scripts/scrape-channel.ts --channel=<id> --force     # re-télécharge tout
 */
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const API = "https://discord.com/api/v10";
const DEFAULT_CHANNEL = "1485316413601218701";
const PAGE = 100;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|tiff?|heic|heif|svg)$/i;

// ── args ─────────────────────────────────────────────────────────────────────
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
const CHANNEL_ID = args.get("channel") ?? DEFAULT_CHANNEL;
const OUT_ROOT = args.get("out") ?? "data/scrape";
const CONCURRENCY = Math.max(1, Number(args.get("concurrency") ?? "10") || 10);
const MAX_MSG = Number(args.get("max") ?? "0") || 0;
const ALL_ATTACHMENTS = flags.has("all");
const WITH_EMBEDS = flags.has("embeds");
const NO_IMAGES = flags.has("no-images");
const FORCE = flags.has("force");

const log = (m: string) => process.stderr.write(`${m}\n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  log("DISCORD_TOKEN manquant (lance depuis apps/bot pour que bun charge .env).");
  process.exit(1);
}
const AUTH = { Authorization: `Bot ${TOKEN}` };

function resolveCutoff(): number {
  const since = args.get("since");
  if (since === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const days = args.get("days");
  if (days) return Date.now() - Number(days) * 86_400_000;
  const hours = args.get("hours");
  if (hours) return Date.now() - Number(hours) * 3_600_000;
  return 0;
}
const CUTOFF_MS = resolveCutoff();

// ── formes brutes de l'API Discord v10 (sous-ensemble utilisé) ───────────────
interface RawAttachment {
  id: string;
  filename: string;
  content_type?: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
}
interface RawEmbedImg {
  url?: string;
}
interface RawEmbed {
  image?: RawEmbedImg;
  thumbnail?: RawEmbedImg;
}
interface RawSticker {
  id: string;
  name: string;
  format_type: number; // 1 PNG, 2 APNG, 3 LOTTIE, 4 GIF
}
interface RawMessage {
  id: string;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  pinned?: boolean;
  author: {
    id: string;
    username: string;
    global_name?: string | null;
    bot?: boolean;
  };
  attachments: RawAttachment[];
  embeds: RawEmbed[];
  sticker_items?: RawSticker[];
  message_reference?: { message_id?: string };
}

// ── GET REST avec gestion fine du rate-limit ─────────────────────────────────
async function discordGet<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, { headers: AUTH });
    } catch (e) {
      if (attempt === 7) throw e;
      await sleep(2 ** attempt * 250);
      continue;
    }
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as {
        retry_after?: number;
      };
      const ra = body.retry_after ?? Number(res.headers.get("retry-after") ?? "1");
      log(
        `  [429] back-off ${ra}s${res.headers.get("x-ratelimit-scope") === "global" ? " (global)" : ""}`,
      );
      await sleep(ra * 1000 + 150);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`HTTP ${res.status} — le bot n'a pas accès au salon ${CHANNEL_ID}.`);
    }
    if (!res.ok) {
      if (res.status >= 500) {
        await sleep(2 ** attempt * 300);
        continue;
      }
      throw new Error(`HTTP ${res.status} sur ${path}`);
    }
    const data = (await res.json()) as T;
    // Si on a épuisé le bucket, on attend proactivement la fenêtre suivante.
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset-after") ?? "0");
      if (reset > 0) await sleep(reset * 1000 + 50);
    }
    return data;
  }
  throw new Error(`retries épuisés sur ${path}`);
}

// ── GET binaire → fichier (stream natif via Bun.write) ───────────────────────
async function downloadTo(url: string, dest: string): Promise<number> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after") ?? "1");
        await sleep((Number.isFinite(ra) ? ra : 1) * 1000 + 250);
        continue;
      }
      if (!res.ok) {
        if (res.status >= 500) {
          await sleep(2 ** attempt * 300);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      // Bun.write streame le Response body sur disque et renvoie les octets écrits.
      return await Bun.write(dest, res);
    } catch (e) {
      if (attempt === 5) throw e;
      await sleep(2 ** attempt * 300);
    }
  }
  throw new Error("retries épuisés");
}

// ── extraction des cibles image d'un message ─────────────────────────────────
interface DlTarget {
  url: string;
  file: string;
  kind: "attachment" | "sticker" | "embed";
}
function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "file";
}
function isImage(a: RawAttachment): boolean {
  if (a.content_type?.startsWith("image/")) return true;
  return IMAGE_EXT.test((a.filename || a.url).split("?")[0] ?? "");
}
function targetsFor(m: RawMessage): DlTarget[] {
  const out: DlTarget[] = [];
  for (const a of m.attachments) {
    if (!ALL_ATTACHMENTS && !isImage(a)) continue;
    out.push({
      url: a.url,
      file: `${m.id}-${a.id}-${sanitize(a.filename)}`,
      kind: "attachment",
    });
  }
  for (const s of m.sticker_items ?? []) {
    if (s.format_type === 3) continue; // LOTTIE = animation JSON, pas une image
    const ext = s.format_type === 4 ? "gif" : "png";
    out.push({
      url: `https://media.discordapp.net/stickers/${s.id}.${ext}`,
      file: `${m.id}-sticker-${s.id}.${ext}`,
      kind: "sticker",
    });
  }
  if (WITH_EMBEDS) {
    m.embeds.forEach((e, i) => {
      const url = e.image?.url ?? e.thumbnail?.url;
      if (!url || !/^https?:/.test(url)) return;
      const base = sanitize(url.split("?")[0]?.split("/").pop() ?? `embed${i}`);
      out.push({ url, file: `${m.id}-embed${i}-${base}`, kind: "embed" });
    });
  }
  return out;
}

// ── setup sortie ─────────────────────────────────────────────────────────────
const outDir = resolve(import.meta.dirname, "..", OUT_ROOT, CHANNEL_ID);
const imgDir = join(outDir, "images");
await mkdir(imgDir, { recursive: true });
const msgPath = join(outDir, "messages.jsonl");
const manifestPath = join(outDir, "images-manifest.jsonl");
const msgSink = Bun.file(msgPath).writer();
const manifestSink = Bun.file(manifestPath).writer();

const cutoffLabel = CUTOFF_MS ? `since ${new Date(CUTOFF_MS).toISOString()}` : "historique complet";
log(`[scrape] salon ${CHANNEL_ID} — ${cutoffLabel} — REST v10 natif`);
log(
  `[scrape] images=${!NO_IMAGES} allAttachments=${ALL_ATTACHMENTS} embeds=${WITH_EMBEDS} concurrency=${CONCURRENCY}${MAX_MSG ? ` max=${MAX_MSG}` : ""}`,
);
log(`[scrape] sortie → ${outDir}`);

const stats = {
  messages: 0,
  withAttach: 0,
  imgQueued: 0,
  imgDownloaded: 0,
  imgSkipped: 0,
  imgFailed: 0,
  bytes: 0,
};

const queue: DlTarget[] = [];
const seenFiles = new Set<string>();

// ── pool de téléchargement borné ─────────────────────────────────────────────
async function runPool() {
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const t = queue[idx++];
      if (!t) continue;
      const dest = join(imgDir, t.file);
      if (!FORCE && (await Bun.file(dest).exists())) {
        stats.imgSkipped++;
        continue;
      }
      try {
        const bytes = await downloadTo(t.url, dest);
        stats.imgDownloaded++;
        stats.bytes += bytes;
        manifestSink.write(
          `${JSON.stringify({ file: t.file, url: t.url, kind: t.kind, bytes })}\n`,
        );
      } catch (e) {
        stats.imgFailed++;
        log(`  x DL ${t.file}: ${(e as Error).message}`);
      }
      if (stats.imgDownloaded % 200 === 0 && stats.imgDownloaded > 0) {
        log(`  ... ${stats.imgDownloaded}/${queue.length} images téléchargées`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ── phase 1 : pagination complète + dump messages ───────────────────────────
let before: string | undefined;
let reachedCutoff = false;
outer: while (true) {
  const qs = `?limit=${PAGE}${before ? `&before=${before}` : ""}`;
  const batch = await discordGet<RawMessage[]>(`/channels/${CHANNEL_ID}/messages${qs}`);
  if (batch.length === 0) break;
  for (const m of batch) {
    const ts = Date.parse(m.timestamp);
    if (CUTOFF_MS && ts < CUTOFF_MS) {
      reachedCutoff = true;
      break outer;
    }
    stats.messages++;
    if (m.attachments.length > 0) stats.withAttach++;
    msgSink.write(
      `${JSON.stringify({
        id: m.id,
        channelId: CHANNEL_ID,
        author: {
          id: m.author.id,
          name: m.author.global_name ?? m.author.username,
          bot: !!m.author.bot,
        },
        content: m.content,
        createdAt: m.timestamp,
        editedAt: m.edited_timestamp,
        attachments: m.attachments.map((a) => ({
          id: a.id,
          name: a.filename,
          url: a.url,
          contentType: a.content_type ?? null,
          size: a.size,
          width: a.width ?? null,
          height: a.height ?? null,
        })),
        embeds: m.embeds.length,
        stickers: (m.sticker_items ?? []).map((s) => ({
          id: s.id,
          name: s.name,
        })),
        reply: m.message_reference?.message_id ?? null,
        pinned: !!m.pinned,
      })}\n`,
    );
    if (!NO_IMAGES) {
      for (const t of targetsFor(m)) {
        if (seenFiles.has(t.file)) continue;
        seenFiles.add(t.file);
        queue.push(t);
        stats.imgQueued++;
      }
    }
    if (MAX_MSG && stats.messages >= MAX_MSG) {
      reachedCutoff = true;
      break outer;
    }
  }
  before = batch[batch.length - 1]?.id;
  if (stats.messages % 1000 === 0 || batch.length < PAGE) {
    log(`  ... ${stats.messages} messages, ${stats.imgQueued} images en file`);
  }
  if (batch.length < PAGE) break;
}
if (reachedCutoff) log("[scrape] limite atteinte (cutoff/max), scan stoppé.");
await msgSink.end();

// ── phase 2 : téléchargement des images ──────────────────────────────────────
if (!NO_IMAGES && queue.length > 0) {
  log(`[scrape] téléchargement de ${queue.length} images (concurrency=${CONCURRENCY})...`);
  await runPool();
}
await manifestSink.end();

const mb = (stats.bytes / 1_048_576).toFixed(1);
log("[scrape] ─────────────────────────────────────");
log(`[scrape] messages       : ${stats.messages}`);
log(`[scrape] avec attachment : ${stats.withAttach}`);
log(`[scrape] images en file  : ${stats.imgQueued}`);
log(`[scrape]   téléchargées  : ${stats.imgDownloaded}`);
log(`[scrape]   déjà présentes: ${stats.imgSkipped}`);
log(`[scrape]   échecs        : ${stats.imgFailed}`);
log(`[scrape] volume          : ${mb} MB`);
log(`[scrape] → messages : ${msgPath}`);
log(`[scrape] → images   : ${imgDir}`);
log(`[scrape] → manifest : ${manifestPath}`);
process.exit(0);
