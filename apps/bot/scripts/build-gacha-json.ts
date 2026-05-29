#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Construit le catalogue `gacha.json` depuis un dump scrape-channel
 * (messages.jsonl + images/) optimisé par optimize-images.ts (images-opt/).
 *
 * Classification :
 *   - artist (dessinateur) = auteur du message.
 *   - character/rarity/series/kind/status = fusionnés depuis `gacha-overrides.json`
 *     (analyse visuelle + contexte d'envoi, clé = attachmentId) quand présent ;
 *     sinon character est déduit heuristiquement du nom de fichier (sans rien
 *     inventer ; null + needsReview si indéterminable).
 *
 * Usage :
 *   bun scripts/build-gacha-json.ts --channel=<id>
 *   bun scripts/build-gacha-json.ts --dir=data/scrape/<id> --overrides=gacha-overrides.json
 *   bun scripts/build-gacha-json.ts --channel=<id> --all
 */
import { resolve, join } from "node:path";

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
const CHANNEL_ID = args.get("channel");
const DIR_ARG = args.get("dir");
const OUT_NAME = args.get("out") ?? "gacha.json";
const ALL = flags.has("all");

const log = (m: string) => process.stderr.write(`${m}\n`);

const baseDir = DIR_ARG
  ? resolve(DIR_ARG)
  : CHANNEL_ID
    ? resolve(import.meta.dirname, "..", "data/scrape", CHANNEL_ID)
    : null;
if (!baseDir) {
  log("Fournis --channel=<id> ou --dir=<chemin>.");
  process.exit(1);
}

const msgPath = join(baseDir, "messages.jsonl");
if (!(await Bun.file(msgPath).exists())) {
  log(`Introuvable : ${msgPath} (lance scrape-channel.ts d'abord).`);
  process.exit(1);
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|tiff?|heic|heif)$/i;

const NOISE = new Set([
  "card",
  "carte",
  "cards",
  "comm",
  "comms",
  "commission",
  "commande",
  "batch",
  "without",
  "with",
  "effect",
  "effects",
  "noeffect",
  "sketch",
  "wip",
  "final",
  "finale",
  "fini",
  "finished",
  "done",
  "sans",
  "titre",
  "untitled",
  "design",
  "image",
  "images",
  "img",
  "screenshot",
  "capture",
  "spoiler",
  "illustration",
  "illu",
  "contest",
  "concours",
  "copy",
  "copie",
  "edit",
  "edited",
  "ref",
  "reference",
  "color",
  "colors",
  "colour",
  "coloring",
  "colo",
  "lineart",
  "line",
  "lines",
  "shading",
  "shade",
  "render",
  "rendu",
  "fanart",
  "art",
  "artwork",
  "draw",
  "drawing",
  "dessin",
  "version",
  "ver",
  "vf",
  "new",
  "old",
  "draft",
  "brouillon",
  "test",
  "wip1",
  "wip2",
  "final1",
  "page",
  "frame",
  "anim",
  "animation",
  "static",
  "statique",
  "post",
  "repost",
  "update",
]);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
function tokenize(base: string): string[] {
  return base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}
function looksLikeName(tok: string): boolean {
  const t = tok.toLowerCase();
  if (NOISE.has(t)) return false;
  if (/\d/.test(tok)) return false;
  if (tok.length < 3) return false;
  if (!/[aeiouyàâäéèêëîïôöûü]/i.test(tok)) return false;
  return true;
}
function extractCharacter(filename: string): string | null {
  const base = filename.replace(IMAGE_EXT, "").replace(/\.[a-z0-9]+$/i, "");
  const toks = tokenize(base).filter(looksLikeName);
  if (toks.length === 0) return null;
  return titleCase(toks.slice(0, 2).join(" "));
}

function optimizedFor(scrapeFile: string): {
  path: string;
  format: "png" | "webp" | "other";
} {
  const lower = scrapeFile.toLowerCase();
  if (lower.endsWith(".png")) return { path: `images-opt/${scrapeFile}`, format: "png" };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return {
      path: `images-opt/${scrapeFile.replace(/\.jpe?g$/i, ".webp")}`,
      format: "webp",
    };
  }
  if (lower.endsWith(".gif")) {
    return {
      path: `images-opt/${scrapeFile.replace(/\.gif$/i, ".webp")}`,
      format: "webp",
    };
  }
  return { path: `images-opt/${scrapeFile}`, format: "other" };
}

interface ScrapedMsg {
  id: string;
  author: { id: string; name: string; bot: boolean };
  content: string;
  createdAt: string;
  attachments: {
    id: string;
    name: string;
    url: string;
    contentType: string | null;
  }[];
}
type Kind = "card" | "illustration" | "template" | "portfolio" | "meme";
interface Override {
  character?: string | null;
  series?: string;
  rarity?: string;
  kind?: Kind;
  status?: string;
  note?: string;
}
interface GachaEntry {
  id: string;
  character: string | null;
  series: string | null;
  rarity: string | null;
  kind: Kind;
  status: string | null;
  artist: string;
  artistId: string;
  image: string;
  original: string;
  format: "png" | "webp" | "other";
  url: string;
  messageId: string;
  attachmentId: string;
  postedAt: string;
  sourceFilename: string;
  content: string;
  note: string | null;
  needsReview: boolean;
}

// Overrides curés (analyse visuelle + contexte), clé = attachmentId.
const ovPath = args.get("overrides") ?? join(baseDir, "gacha-overrides.json");
let overrides: Record<string, Override> = {};
if (await Bun.file(ovPath).exists()) {
  const raw = JSON.parse(await Bun.file(ovPath).text()) as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("_")) overrides[k] = v as Override;
  }
  log(`[gacha] overrides chargés : ${Object.keys(overrides).length} (${ovPath})`);
}

const lines = (await Bun.file(msgPath).text())
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as ScrapedMsg);

const entries: GachaEntry[] = [];
for (const m of lines) {
  for (const a of m.attachments ?? []) {
    const isImg = (a.contentType ?? "").startsWith("image/") || IMAGE_EXT.test(a.name ?? "");
    if (!ALL && !isImg) continue;
    const scrapeFile = `${m.id}-${a.id}-${(a.name ?? "att").replace(/[^\w.-]+/g, "_").slice(0, 120)}`;
    const opt = optimizedFor(scrapeFile);
    const ov = overrides[a.id];
    const character =
      ov && "character" in ov ? (ov.character ?? null) : extractCharacter(a.name ?? "");
    entries.push({
      id: "",
      character,
      series: ov?.series ?? null,
      rarity: ov?.rarity ?? null,
      kind: ov?.kind ?? "card",
      status: ov?.status ?? null,
      artist: m.author.name,
      artistId: m.author.id,
      image: opt.path,
      original: `images/${scrapeFile}`,
      format: opt.format,
      url: a.url,
      messageId: m.id,
      attachmentId: a.id,
      postedAt: m.createdAt,
      sourceFilename: a.name ?? "",
      content: (m.content ?? "").replace(/\s+/g, " ").trim().slice(0, 280),
      note: ov?.note ?? null,
      needsReview: ov ? false : character === null,
    });
  }
}

const KIND_RANK: Record<Kind, number> = {
  card: 0,
  illustration: 1,
  portfolio: 2,
  template: 3,
  meme: 4,
};
const RARITY_RANK: Record<string, number> = { LR: 0, SR: 1, R: 2, special: 3 };
const rarityRank = (r: string | null) => (r && r in RARITY_RANK ? RARITY_RANK[r]! : 9);

// Tri : cartes d'abord (par rareté LR>SR>R), puis personnage, dessinateur, date ;
// le hors-bannière (illustration/portfolio/template/meme) ensuite.
entries.sort((a, b) => {
  if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (a.kind === "card" && rarityRank(a.rarity) !== rarityRank(b.rarity)) {
    return rarityRank(a.rarity) - rarityRank(b.rarity);
  }
  const c = (a.character ?? "zzz").localeCompare(b.character ?? "zzz");
  if (c !== 0) return c;
  const ar = a.artist.localeCompare(b.artist);
  if (ar !== 0) return ar;
  return a.postedAt.localeCompare(b.postedAt);
});
entries.forEach((e, i) => {
  e.id = `g${String(i + 1).padStart(3, "0")}`;
});

const outPath = join(baseDir, OUT_NAME);
await Bun.write(outPath, `${JSON.stringify(entries, null, 2)}\n`);

const cards = entries.filter((e) => e.kind === "card");
const review = entries.filter((e) => e.needsReview);
const artists = [...new Set(entries.map((e) => e.artist))];
log(`[gacha] ${entries.length} images -> ${outPath}`);
log(
  `[gacha] cartes : ${cards.length} · hors-bannière : ${entries.length - cards.length} · à revoir : ${review.length}`,
);
log(`[gacha] dessinateurs (${artists.length}) : ${artists.join(", ")}`);
log("[gacha] ─── aperçu ───");
for (const e of entries) {
  const tag = e.kind === "card" ? (e.rarity ?? "?") : e.kind;
  log(
    `  ${e.id}  [${tag.padEnd(11)}] ${(e.character ?? "??? (review)").padEnd(26)} ${(e.status ?? "").padEnd(7)} par ${e.artist}`,
  );
}
process.exit(0);
