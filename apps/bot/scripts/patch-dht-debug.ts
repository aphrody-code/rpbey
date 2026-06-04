import { symlink, mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Glob } from "bun";

const root = resolve(import.meta.dir, "../../../");
const rootNm = join(root, "node_modules/.bun");

async function dirExists(p: string) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Find directories using Glob
const dhtGlob = new Glob("discord-html-transcripts@*");
const debugGlob = new Glob("debug@4*");

let dhtDirName: string | null = null;
try {
  for (const match of dhtGlob.scanSync({ cwd: rootNm, onlyFiles: false })) {
    dhtDirName = match;
    break; // head -1
  }
} catch {
  // If node_modules/.bun doesn't exist yet, we catch it
}

let debugDirName: string | null = null;
try {
  const debugMatches = Array.from(debugGlob.scanSync({ cwd: rootNm, onlyFiles: false })).sort();
  if (debugMatches.length > 0) {
    debugDirName = debugMatches[debugMatches.length - 1]; // tail -1
  }
} catch {
  // If node_modules/.bun doesn't exist yet, we catch it
}

if (!dhtDirName || !debugDirName) {
  console.log("[patch-dht] packages not found — skip");
  process.exit(0);
}

const dhtDir = join(rootNm, dhtDirName);
const debugDir = join(rootNm, debugDirName);

const target = join(dhtDir, "node_modules/debug");
const src = join(debugDir, "node_modules/debug");

if (!(await dirExists(src))) {
  console.log(`[patch-dht] source debug not found at ${src}`);
  process.exit(0);
}

// Ensure the parent directory of target exists
const targetParent = join(dhtDir, "node_modules");
if (!(await dirExists(targetParent))) {
  await mkdir(targetParent, { recursive: true });
}

// Remove target if it already exists (symlink or dir)
try {
  await rm(target, { recursive: true, force: true });
} catch {}

await symlink(src, target, "junction");
console.log(`[patch-dht] linked ${target} → ${src}`);
