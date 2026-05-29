#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Construit un catalogue `gacha.json` à partir d'un dump produit par
 * `scrape-channel.ts` (messages.jsonl + images/) et optimisé par
 * `optimize-images.ts` (images-opt/). Une entrée par image :
 *   { id, character, artist, image, original, format, url, messageId,
 *     attachmentId, postedAt, sourceFilename, content, needsReview }
 *
 * - artist (dessinateur)   : l'auteur du message (signal fiable dans un salon WIP).
 * - character (personnage) : extrait heuristiquement du nom de fichier
 *     (`Tsubasa_card.png` -> "Tsubasa", `kyoya_batch_1_effect.png` -> "Kyoya",
 *      `AsutoYuma_comm.jpg` -> "Asuto Yuma"). `null` si non dérivable
 *      (`image.png`, `Sans_titre_…`, `IMG_1234.jpg`) -> `needsReview: true`.
 *      AUCUN nom inventé : on n'écrit que ce que le fichier dit clairement.
 *
 * Usage :
 *   bun scripts/build-gacha-json.ts --channel=<id>
 *   bun scripts/build-gacha-json.ts --dir=data/scrape/<id> --out=gacha.json
 *   bun scripts/build-gacha-json.ts --channel=<id> --all   # toutes les images, pas que les attachments image/*
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

// Tokens de bruit à retirer du nom de fichier avant d'isoler le personnage.
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

/** Sépare le camelCase ("AsutoYuma" -> "Asuto Yuma") puis sur _ - espaces. */
function tokenize(base: string): string[] {
  const spaced = base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.split(" ").filter(Boolean);
}

/** Un token est-il un nom plausible (pas du bruit, pas un nombre/junk) ? */
function looksLikeName(tok: string): boolean {
  const t = tok.toLowerCase();
  if (NOISE.has(t)) return false;
  if (/\d/.test(tok)) return false; // contient un chiffre -> id/date/junk
  if (tok.length < 3) return false; // f, m, v, fr, en…
  if (!/[aeiouyàâäéèêëîïôöûü]/i.test(tok)) return false; // sans voyelle -> junk
  return true;
}

/** Déduit le nom de personnage depuis le filename, ou null. */
function extractCharacter(filename: string): string | null {
  const base = filename.replace(IMAGE_EXT, "").replace(/\.[a-z0-9]+$/i, "");
  const toks = tokenize(base).filter(looksLikeName);
  if (toks.length === 0) return null;
  return titleCase(toks.slice(0, 2).join(" "));
}

/** Nom de fichier optimisé correspondant (cf. optimize-images.ts). */
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

interface GachaEntry {
  id: string;
  character: string | null;
  artist: string;
  artistId: string;
  image: string; // version optimisée (images-opt/ — png lossless ou webp)
  original: string; // brut scrapé (images/)
  format: "png" | "webp" | "other";
  url: string;
  messageId: string;
  attachmentId: string;
  postedAt: string;
  sourceFilename: string;
  content: string;
  needsReview: boolean;
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
    const character = extractCharacter(a.name ?? "");
    const scrapeFile = `${m.id}-${a.id}-${(a.name ?? "att").replace(/[^\w.-]+/g, "_").slice(0, 120)}`;
    const opt = optimizedFor(scrapeFile);
    entries.push({
      id: "",
      character,
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
      needsReview: character === null,
    });
  }
}

// Tri : personnages connus d'abord (alpha), puis dessinateur, puis date.
entries.sort((a, b) => {
  if (!a.character !== !b.character) return a.character ? -1 : 1;
  const c = (a.character ?? "").localeCompare(b.character ?? "");
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

// Résumé + table de contrôle.
const byChar = entries.filter((e) => e.character).length;
const review = entries.filter((e) => e.needsReview);
const artists = [...new Set(entries.map((e) => e.artist))];
log(`[gacha] ${entries.length} images classées -> ${outPath}`);
log(`[gacha] personnage identifié : ${byChar}/${entries.length} — à revoir : ${review.length}`);
log(`[gacha] dessinateurs (${artists.length}) : ${artists.join(", ")}`);
log("[gacha] ─── aperçu ───");
for (const e of entries) {
  log(
    `  ${e.id}  ${(e.character ?? "??? (review)").padEnd(18)}  par ${e.artist.padEnd(16)}  ${e.sourceFilename}`,
  );
}
process.exit(0);
