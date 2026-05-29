#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Optimise les images d'un dump scrape-channel :
 *   - PNG  -> PNG **lossless** recompressé via `oxipng` (Rust, sans perte).
 *   - JPEG -> **WebP** via `cwebp` (libwebp, q90 par défaut).
 *   - GIF  -> WebP animé via `gif2webp`.
 *   - autres (webp/avif…) -> copiés tels quels.
 *
 * Les originaux dans `images/` sont conservés ; les sorties vont dans
 * `images-opt/`. Un `optimized-manifest.jsonl` mappe src -> out + tailles.
 *
 * Rapide : pool de `Bun.spawn` borné au nombre de cœurs.
 *
 * Usage :
 *   bun scripts/optimize-images.ts --channel=<id>
 *   bun scripts/optimize-images.ts --dir=data/scrape/<id> --quality=90 --oxipng=4
 *   bun scripts/optimize-images.ts --channel=<id> --force
 */
import { mkdir, readdir } from "node:fs/promises";
import { resolve, join, extname, basename } from "node:path";
import { cpus } from "node:os";

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
const QUALITY = Math.min(100, Math.max(1, Number(args.get("quality") ?? "90") || 90));
const OXI_LEVEL = args.get("oxipng") ?? "4";
const FORCE = flags.has("force");
const CONCURRENCY = Math.max(2, cpus().length);

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
const srcDir = join(baseDir, "images");
const outDir = join(baseDir, "images-opt");
await mkdir(outDir, { recursive: true });

let files: string[];
try {
  files = (await readdir(srcDir)).filter((f) => !f.startsWith("."));
} catch {
  log(`Dossier introuvable : ${srcDir} (lance scrape-channel.ts d'abord).`);
  process.exit(1);
}

interface Job {
  src: string;
  out: string;
  format: "png" | "webp" | "copy";
  tool: string;
  argv: string[];
}

function planJob(file: string): Job {
  const ext = extname(file).toLowerCase();
  const base = basename(file, ext);
  const src = join(srcDir, file);
  if (ext === ".png") {
    const out = join(outDir, `${base}.png`);
    // oxipng : recompression lossless, métadonnées non-essentielles retirées.
    return {
      src,
      out,
      format: "png",
      tool: "oxipng",
      argv: ["-o", OXI_LEVEL, "--strip", "safe", "--force", "--quiet", "--out", out, src],
    };
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    const out = join(outDir, `${base}.webp`);
    return {
      src,
      out,
      format: "webp",
      tool: "cwebp",
      argv: ["-q", String(QUALITY), "-mt", "-quiet", src, "-o", out],
    };
  }
  if (ext === ".gif") {
    const out = join(outDir, `${base}.webp`);
    return {
      src,
      out,
      format: "webp",
      tool: "gif2webp",
      argv: ["-q", String(QUALITY), "-mt", src, "-o", out],
    };
  }
  return {
    src,
    out: join(outDir, file),
    format: "copy",
    tool: "copy",
    argv: [],
  };
}

const jobs = files.map(planJob);
const manifestSink = Bun.file(join(baseDir, "optimized-manifest.jsonl")).writer();

const stats = { done: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0 };

async function runJob(j: Job): Promise<void> {
  const srcSize = Bun.file(j.src).size;
  if (!FORCE && (await Bun.file(j.out).exists())) {
    stats.skipped++;
    return;
  }
  try {
    if (j.format === "copy") {
      await Bun.write(j.out, Bun.file(j.src));
    } else {
      const proc = Bun.spawn([j.tool, ...j.argv], {
        stdout: "ignore",
        stderr: "pipe",
      });
      const code = await proc.exited;
      if (code !== 0) {
        const err = await new Response(proc.stderr).text();
        throw new Error(`${j.tool} exit ${code}: ${err.trim().slice(0, 160)}`);
      }
    }
    const outSize = Bun.file(j.out).size;
    stats.done++;
    stats.bytesBefore += srcSize;
    stats.bytesAfter += outSize;
    manifestSink.write(
      `${JSON.stringify({
        src: `images/${basename(j.src)}`,
        out: `images-opt/${basename(j.out)}`,
        format: j.format,
        tool: j.tool,
        bytesBefore: srcSize,
        bytesAfter: outSize,
      })}\n`,
    );
  } catch (e) {
    stats.failed++;
    log(`  x ${basename(j.src)}: ${(e as Error).message}`);
  }
}

log(
  `[opt] ${jobs.length} images — oxipng -o ${OXI_LEVEL} (png lossless) / cwebp -q ${QUALITY} (jpeg->webp)`,
);
log(`[opt] concurrency=${CONCURRENCY} — sortie ${outDir}`);

let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    if (j) await runJob(j);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await manifestSink.end();

const mbBefore = (stats.bytesBefore / 1_048_576).toFixed(1);
const mbAfter = (stats.bytesAfter / 1_048_576).toFixed(1);
const saved =
  stats.bytesBefore > 0 ? (100 * (1 - stats.bytesAfter / stats.bytesBefore)).toFixed(1) : "0";
log("[opt] ─────────────────────────────────────");
log(`[opt] converties : ${stats.done}  déjà faites : ${stats.skipped}  échecs : ${stats.failed}`);
log(`[opt] taille : ${mbBefore} MB -> ${mbAfter} MB  (-${saved}%)`);
log(`[opt] manifest : ${join(baseDir, "optimized-manifest.jsonl")}`);
process.exit(0);
