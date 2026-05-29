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
 * FLIP GLOBAL effectué (wave-6-final) : la dette transitive est résorbée à 0, donc
 * `ENFORCED = ["src/"]` — la frontière est désormais appliquée à TOUT `src/`. Plus
 * aucun fichier hors `{server/dal/**, lib/db.ts, lib/auth.ts}` (les puits, cf. `isSink`)
 * ne peut atteindre la DB sans faire échouer le gate.
 *
 * Usage : bun apps/web/scripts/check-dal-boundary.ts
 */
import { Glob } from "bun";

const ROOT = new URL("../", import.meta.url).pathname; // apps/web/
const SRC = `${ROOT}src`;

const DAL_PREFIX = "server/dal/";
// Puits PROPRES reconnus en plus de `server/dal/**` : deux seams framework
// IRRÉDUCTIBLES qui ont légitimement le droit d'atteindre la DB.
//   - `lib/db.ts`   : LE barrel de re-export (`export { db, schema } from "@rpbey/db"`
//                     + `export * from "drizzle-orm"`). C'est la source DB elle-même.
//   - `lib/auth.ts` : instance better-auth via `drizzleAdapter(db)`. L'adapter EXIGE
//                     la db (mandaté par le framework), server-only, importé par ~50
//                     routes pour résoudre la session. Ce couplage est inévitable.
// Tout AUTRE fichier important `@/lib/db`/`@rpbey/db` en direct reste flaggé via
// `DB_IMPORT` (protection anti-contournement intacte) : seuls ces 2 fichiers,
// qui ont `directDb=true`, sont exemptés du verdict via `isSink`.
const SINK_FILES = new Set(["lib/db.ts", "lib/auth.ts"]);
/** Un `rel` est un puits propre s'il est dans la DAL ou l'un des 2 seams framework. */
const isSink = (rel: string): boolean => rel.startsWith(DAL_PREFIX) || SINK_FILES.has(rel);
// Import direct de la DB (barrel `@/lib/db` ou paquet `@rpbey/db`).
// ⚠️ Inclut les SUBPATHS : `@rpbey/db` ré-exporte le même `db` live via ses
// sous-chemins (`@rpbey/db/client`, `@rpbey/db/schema`, …) et `@/lib/db` peut
// aussi être atteint via un sous-module — un offender pouvait donc contourner le
// gate en important `@rpbey/db/client` au lieu du specifier exact. Le groupe
// optionnel `(?:\/[\w./-]+)?` capture ces formes (et le `require()` équivalent).
const DB_IMPORT = /(?:from\s+|require\(\s*)["'](@rpbey\/db|@\/lib\/db|@lib\/db)(?:\/[\w./-]+)?["']/;
// Capture toutes les sources d'import/`export … from` locales pour bâtir le graphe.
const IMPORT_FROM = /(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/g;
// Imports DYNAMIQUES (`import("…")`) — non capturés par IMPORT_FROM (qui exige
// `from`). Sans cette 2e passe, un fichier pouvait atteindre la DB transitivement
// via un `await import("@/lib/stats")` et rester invisible au graphe.
const IMPORT_DYNAMIC = /import\(\s*["']([^"']+)["']\s*\)/g;

// Zones dont la frontière est STRICTEMENT appliquée.
//
// FLIP GLOBAL (wave-6-final, 2026-05-29) : la dette de couplage transitive a été
// RÉSORBÉE à 0 (toutes les vagues domaine + la lane `auth` migrées vers la DAL,
// `lib/db.ts`/`lib/auth.ts` déclarés puits framework via `isSink`). On passe donc
// d'une allowlist incrémentale préfixe-par-préfixe à l'enforcement GLOBAL : plus
// AUCUN fichier hors `{server/dal/**, lib/db.ts, lib/auth.ts}` n'a le droit
// d'atteindre la DB. Toute nouvelle régression (un fichier qui réimporte
// `@rpbey/db`/`@/lib/db` en direct ou se couple transitivement à un fichier couplé)
// fera échouer le gate (exit 1). C'est la Phase 6 hard-fail global du plan.
const ENFORCED = ["src/"];

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
  // 2e passe : imports DYNAMIQUES `import("…")`, même résolution que les
  // statiques (poussés dans le même tableau `node.imports`).
  for (const m of content.matchAll(IMPORT_DYNAMIC)) {
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
  // alias `@hooks/*` → `src/hooks/*` (déclaré dans apps/web/tsconfig.json paths) :
  // sans ça, un import `@hooks/useFoo` ne se résolvait pas et l'arête de couplage
  // transitif via un hook était invisible au graphe.
  else if (spec.startsWith("@hooks/")) base = `hooks/${spec.slice(7)}`;
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
  if (isSink(rel)) return false; // la DAL + seams framework sont propres
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
    if (target && !isSink(target) && isCoupled(target, stack)) {
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
  if (isSink(rel)) continue;
  if (isCoupled(rel, new Set())) coupled.add(rel);
}

const offenders = [...coupled].sort();
// `f` est relatif à `src/` (le glob scanne avec cwd=SRC) ; on compare donc sur le
// chemin affiché `src/<f>` pour que le préfixe global `"src/"` matche bien tout
// offender (et que les préfixes legacy `app/...`/`server/...` matchent aussi via f).
const enforcedViolations = offenders.filter((f) =>
  ENFORCED.some((p) => f.startsWith(p) || `src/${f}`.startsWith(p)),
);

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
