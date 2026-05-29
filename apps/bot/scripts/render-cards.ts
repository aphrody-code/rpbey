#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * « Utilise le template de soupy » : composite la meilleure illustration de
 * chaque carte DANS le cadre (template à corps transparent), nom (header) +
 * rareté · série (footer) en `caption:` auto-ajusté (noms longs OK), via
 * ImageMagick. Cadrage UNIFORME : crop `gravity north` (garde la tête/visage),
 * même taille de sortie pour toutes les cartes.
 *
 * Template = entrée `kind:"template"` de gacha.json (cadre 4961x7016, corps
 * transparent x[200..4760] y[860..5760]). Sortie : images-card/<slug>.png
 * + cards-manifest.json (character -> fichier) consommé par post-gacha.ts.
 *
 * Une carte = meilleur stade par personnage (final > wip > lineart > sketch).
 *
 * Usage : bun scripts/render-cards.ts --channel=<id> [--width=1240] [--force]
 */
import { mkdir } from "node:fs/promises";
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
const FORCE = flags.has("force");
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

// Géométrie du template (réel 4961x7016 ; corps transparent + bandeaux mesurés).
const TPL_REAL_W = 4961;
const TPL_REAL_H = 7016;
const BODY = { x: 200, y: 860, w: 4560, h: 4900 };
const HDR = { boxW: 4121, boxH: 430, offTop: 330 };
const FTR = { boxW: 4121, boxH: 540, offBot: 430 };
const FONT = "DejaVu-Sans-Bold";
const OUT_W = Math.max(600, Number(args.get("width") ?? "1240") || 1240);
const SCALE = OUT_W / TPL_REAL_W;
const r = (n: number) => Math.round(n * SCALE);
const OUT_H = r(TPL_REAL_H);

interface GachaEntry {
  id: string;
  character: string | null;
  series: string | null;
  rarity: string | null;
  kind: string;
  status: string | null;
  artist: string;
  original: string;
}

const gachaPath = join(baseDir, "gacha.json");
if (!(await Bun.file(gachaPath).exists())) {
  log("gacha.json introuvable (lance build-gacha-json.ts).");
  process.exit(1);
}
const entries = JSON.parse(await Bun.file(gachaPath).text()) as GachaEntry[];

const tplEntry = entries.find((e) => e.kind === "template");
if (!tplEntry) {
  log("Aucune entrée kind:template dans gacha.json (template de soupy requis).");
  process.exit(1);
}
const tplPath = join(baseDir, tplEntry.original);

const outDir = join(baseDir, "images-card");
await mkdir(outDir, { recursive: true });

const tplResized = join(outDir, "_frame.png");
{
  const p = Bun.spawn(["magick", tplPath, "-resize", `${OUT_W}x`, tplResized], {
    stdout: "ignore",
    stderr: "pipe",
  });
  if ((await p.exited) !== 0) {
    log(`magick resize template KO: ${await new Response(p.stderr).text()}`);
    process.exit(1);
  }
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "carte"
  );
}
const STATUS_RANK: Record<string, number> = {
  final: 0,
  wip: 1,
  lineart: 2,
  sketch: 3,
};
const statusRank = (s: string | null) => (s && s in STATUS_RANK ? STATUS_RANK[s]! : 4);

const best = new Map<string, GachaEntry>();
for (const e of entries) {
  if (e.kind !== "card" && e.kind !== "illustration") continue;
  if (!e.character) continue;
  const cur = best.get(e.character);
  if (!cur || statusRank(e.status) < statusRank(cur.status)) best.set(e.character, e);
}

async function renderCard(e: GachaEntry, character: string): Promise<string> {
  const name = character.toUpperCase();
  const sub =
    e.kind === "illustration"
      ? `ILLUSTRATION${e.series ? ` · ${e.series}` : ""}`
      : `${e.rarity ?? "?"}${e.series ? ` · ${e.series}` : ""}`;
  const out = join(outDir, `${slug(character)}.png`);
  if (!FORCE && (await Bun.file(out).exists())) return out;
  const illu = join(baseDir, e.original);
  const argv = [
    "magick",
    "-size",
    `${OUT_W}x${OUT_H}`,
    "xc:white",
    // illustration en cover du corps transparent — crop gravity NORTH (uniforme, garde le visage)
    "(",
    illu,
    "-resize",
    `${r(BODY.w)}x${r(BODY.h)}^`,
    "-gravity",
    "north",
    "-extent",
    `${r(BODY.w)}x${r(BODY.h)}`,
    ")",
    "-geometry",
    `+${r(BODY.x)}+${r(BODY.y)}`,
    "-composite",
    tplResized,
    "-composite",
    "(",
    "-background",
    "none",
    "-fill",
    "white",
    "-font",
    FONT,
    "-gravity",
    "center",
    "-size",
    `${r(HDR.boxW)}x${r(HDR.boxH)}`,
    `caption:${name}`,
    ")",
    "-gravity",
    "North",
    "-geometry",
    `+0+${r(HDR.offTop)}`,
    "-composite",
    "(",
    "-background",
    "none",
    "-fill",
    "white",
    "-font",
    FONT,
    "-gravity",
    "center",
    "-size",
    `${r(FTR.boxW)}x${r(FTR.boxH)}`,
    `caption:${sub}`,
    ")",
    "-gravity",
    "South",
    "-geometry",
    `+0+${r(FTR.offBot)}`,
    "-composite",
    out,
  ];
  const p = Bun.spawn(argv, { stdout: "ignore", stderr: "pipe" });
  if ((await p.exited) !== 0) throw new Error(await new Response(p.stderr).text());
  return out;
}

const manifest: Record<string, string> = {};
let done = 0;
for (const e of best.values()) {
  const character = e.character;
  if (!character) continue;
  try {
    const out = await renderCard(e, character);
    manifest[character] = `images-card/${out.split("/").pop()}`;
    done++;
    log(`  ✓ ${character} [${e.kind === "card" ? e.rarity : e.kind}] <- ${e.status ?? "?"}`);
  } catch (err) {
    log(`  x ${character}: ${(err as Error).message.slice(0, 160)}`);
  }
}
await Bun.write(join(baseDir, "cards-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
log(
  `[render] ${done} cartes encadrées (template soupy, gravity north) -> ${outDir} (${OUT_W}x${OUT_H})`,
);
process.exit(0);
