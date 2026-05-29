#!/usr/bin/env bun
/**
 * Garde-fou architecture API-first : seul `src/server/dal/**` doit atteindre la DB
 * (`@rpbey/db` / `@/lib/db`).
 *
 * Analyse **transitive** (fermeture du graphe d'imports), pas seulement les imports
 * directs : un fichier qui importe `lib/stats` (lui-même couplé à la DB) est compté
 * comme couplé. La DAL est le **puits** — dès qu'un chemin d'import entre dans
 * `server/dal/`, il est considéré propre (la DAL a le droit de taper la DB).
 *
 * - Mesure la **dette de couplage** legacy (fichiers hors DAL atteignant la DB) — informatif.
 * - **Échoue** (exit 1) si une zone DÉJÀ MIGRÉE (allowlist `ENFORCED`) reste couplée
 *   (directement OU transitivement) → empêche la régression de la couche propre.
 *
 * Au fur et à mesure de la migration domaine par domaine, ajouter les préfixes
 * migrés à `ENFORCED`. Quand toute la dette est résorbée, passer `ENFORCED` à `["src/"]`.
 *
 * Usage : bun apps/web/scripts/check-dal-boundary.ts
 */
import { Glob } from "bun";

const ROOT = new URL("../", import.meta.url).pathname; // apps/web/
const SRC = `${ROOT}src`;

const DAL_PREFIX = "server/dal/";
// Import direct de la DB (barrel `@/lib/db` ou paquet `@rpbey/db`).
const DB_IMPORT = /from\s+["'](@rpbey\/db|@\/lib\/db|@lib\/db)["']/;
// Capture toutes les sources d'import/`export … from` locales pour bâtir le graphe.
const IMPORT_FROM = /(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/g;

// Zones dont la frontière est STRICTEMENT appliquée (toute migration y ajoute son préfixe).
const ENFORCED = [
  "server/services/",
  "server/data-source.ts",
  "app/api/v1/",
  "app/api/parts/",
  "server/actions/parts.ts",
];

const glob = new Glob("**/*.{ts,tsx}");

/** rel (sans extension, relatif à src/) → { imports: rel[], directDb: bool } */
interface Node {
  rel: string; // chemin relatif à src/ avec extension
  imports: string[]; // specifiers bruts
  directDb: boolean;
}

const files: string[] = [];
for await (const rel of glob.scan({ cwd: SRC })) files.push(rel);

const nodes = new Map<string, Node>();
for (const rel of files) {
  const content = await Bun.file(`${SRC}/${rel}`).text();
  const imports: string[] = [];
  for (const m of content.matchAll(IMPORT_FROM)) {
    if (m[1]) imports.push(m[1]);
  }
  nodes.set(rel, { rel, imports, directDb: DB_IMPORT.test(content) });
}

// Index pour résoudre un specifier → un `rel` connu (essaie les extensions/index).
const known = new Set(files);
function resolveCandidates(base: string): string[] {
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
}
/** Résout un specifier d'import vers un `rel` (src/-relatif) ou null si externe/introuvable. */
function resolveImport(fromRel: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith("@lib/")) base = `lib/${spec.slice(5)}`;
  else if (spec.startsWith("@components/")) base = `components/${spec.slice(12)}`;
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const dir = fromRel.includes("/") ? fromRel.slice(0, fromRel.lastIndexOf("/")) : "";
    const parts = `${dir}/${spec}`.split("/");
    const stack: string[] = [];
    for (const p of parts) {
      if (p === "" || p === ".") continue;
      if (p === "..") stack.pop();
      else stack.push(p);
    }
    base = stack.join("/");
  } else {
    return null; // paquet externe
  }
  for (const cand of resolveCandidates(base)) {
    if (known.has(cand)) return cand;
  }
  return null;
}

// Fermeture transitive : un fichier non-DAL est « couplé » s'il importe la DB en
// direct, ou s'il importe (transitivement) un fichier non-DAL couplé. On NE propage
// PAS à travers la DAL (puits propre).
const coupled = new Set<string>();
const memo = new Map<string, boolean>();
function isCoupled(rel: string, stack: Set<string>): boolean {
  if (rel.startsWith(DAL_PREFIX)) return false; // la DAL est propre
  const cached = memo.get(rel);
  if (cached !== undefined) return cached;
  if (stack.has(rel)) return false; // cycle : neutre sur cette arête
  const node = nodes.get(rel);
  if (!node) return false;
  if (node.directDb) {
    memo.set(rel, true);
    return true;
  }
  stack.add(rel);
  let result = false;
  for (const spec of node.imports) {
    const target = resolveImport(rel, spec);
    if (target && !target.startsWith(DAL_PREFIX) && isCoupled(target, stack)) {
      result = true;
      break;
    }
  }
  stack.delete(rel);
  // Ne mémoïse que les résultats hors-cycle stables.
  if (stack.size === 0) memo.set(rel, result);
  return result;
}

for (const rel of files) {
  if (rel.startsWith(DAL_PREFIX)) continue;
  if (isCoupled(rel, new Set())) coupled.add(rel);
}

const offenders = [...coupled].sort();
const enforcedViolations = offenders.filter((f) => ENFORCED.some((p) => f.startsWith(p)));

console.log(
  `[dal-boundary] dette de couplage (transitive) : ${offenders.length} fichier(s) hors DAL atteignent la DB.`,
);
if (enforcedViolations.length > 0) {
  console.error(
    `\n[dal-boundary] ÉCHEC — ${enforcedViolations.length} violation(s) dans une zone migrée (doit passer par src/server/dal/) :`,
  );
  for (const f of enforcedViolations) console.error(`  - src/${f}`);
  process.exit(1);
}
console.log("[dal-boundary] OK — aucune régression dans les zones migrées.");
