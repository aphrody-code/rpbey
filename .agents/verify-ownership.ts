#!/usr/bin/env bun
/**
 * verify-ownership.ts — garde-fou de la coordination multi-agents.
 *
 * Asserte deux invariants de agents.json :
 *   1. DISJONCTION : aucun fichier réel n'est possédé par 2 lanes (owns[] moins
 *      excludes[], expansés sur le repo). C'est la garantie "zéro collision".
 *   2. COUVERTURE : chaque fichier de dette (importe @rpbey/db ou @/lib/db hors
 *      server/dal + lib/db.ts) est possédé par exactement une lane OU listé dans
 *      shared_resources. Un fichier de dette non possédé = trou de migration.
 *
 * Exit 0 = vert. Exit 1 = collision ou trou. À lancer avant de spawn les lanes
 * et après toute édition de agents.json.  Usage : `bun .agents/verify-ownership.ts`
 */
import { Glob } from "bun";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const agents = (await Bun.file(resolve(ROOT, "agents.json")).json()) as {
  lanes: { id: string; owns: string[]; excludes?: string[] }[];
  shared_resources: { owner: string; files: string[] };
};

function expand(globs: string[]): Set<string> {
  const out = new Set<string>();
  for (const g of globs ?? []) {
    // scanSync gère les littéraux (fichier unique) comme les motifs `**`.
    for (const f of new Glob(g).scanSync({
      cwd: ROOT,
      onlyFiles: true,
      dot: false,
    })) {
      out.add(f.split("\\").join("/"));
    }
  }
  return out;
}

// --- Filesets par lane (owns - excludes) ---------------------------------
const laneFiles = new Map<string, Set<string>>();
for (const lane of agents.lanes) {
  const owned = expand(lane.owns);
  for (const ex of expand(lane.excludes ?? [])) owned.delete(ex);
  laneFiles.set(lane.id, owned);
}
// shared_resources = pseudo-lane mono-propriétaire (integration les liste déjà
// dans owns pour partie ; on fusionne pour la couverture).
const sharedSet = expand(agents.shared_resources.files);

// --- Invariant 1 : disjonction pairwise -----------------------------------
const collisions: string[] = [];
const ids = [...laneFiles.keys()];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = laneFiles.get(ids[i])!;
    const b = laneFiles.get(ids[j])!;
    for (const f of a) if (b.has(f)) collisions.push(`${f}  <-  ${ids[i]} ∩ ${ids[j]}`);
  }
}

// --- Invariant 2 : couverture de la dette ---------------------------------
const DB_RE = /from\s+["'](@rpbey\/db|@\/lib\/db)["']|require\(["'](@rpbey\/db|@\/lib\/db)["']\)/;
const owned = new Set<string>([...sharedSet]);
for (const s of laneFiles.values()) for (const f of s) owned.add(f);

const dette: string[] = [];
for (const f of new Glob("apps/web/src/**/*.{ts,tsx}").scanSync({
  cwd: ROOT,
  onlyFiles: true,
})) {
  const rel = f.split("\\").join("/");
  if (rel.includes("/server/dal/") || rel.endsWith("apps/web/src/lib/db.ts")) continue;
  const src = await Bun.file(resolve(ROOT, rel)).text();
  if (DB_RE.test(src)) dette.push(rel);
}
const uncovered = dette.filter((f) => !owned.has(f));

// --- Rapport ---------------------------------------------------------------
const line = "─".repeat(64);
console.log(line);
console.log(
  `Lanes: ${agents.lanes.length}  |  fichiers possédés: ${owned.size}  |  dette: ${dette.length}`,
);
for (const id of ids) console.log(`  ${id.padEnd(16)} ${laneFiles.get(id)!.size} fichier(s)`);
console.log(line);

let ok = true;
if (collisions.length) {
  ok = false;
  console.error(`✗ COLLISION — ${collisions.length} fichier(s) possédé(s) par 2 lanes :`);
  for (const c of collisions) console.error(`    ${c}`);
} else {
  console.log("✓ DISJONCTION — aucun fichier possédé par 2 lanes.");
}
if (uncovered.length) {
  ok = false;
  console.error(`✗ COUVERTURE — ${uncovered.length} fichier(s) de dette non possédé(s) :`);
  for (const u of uncovered) console.error(`    ${u}`);
} else {
  console.log(`✓ COUVERTURE — les ${dette.length} fichiers de dette sont tous possédés.`);
}
console.log(line);
process.exit(ok ? 0 : 1);
