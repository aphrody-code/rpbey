#!/usr/bin/env bun
/**
 * Garde-fou architecture API-first : seul `src/server/dal/**` doit importer la DB
 * (`@rpbey/db` / `@/lib/db`).
 *
 * - Mesure la **dette de couplage** legacy (fichiers hors DAL important la DB) — informatif.
 * - **Échoue** (exit 1) si une zone DÉJÀ MIGRÉE (allowlist `ENFORCED`) réintroduit un
 *   import DB direct → empêche la régression de la couche propre.
 *
 * Au fur et à mesure de la migration domaine par domaine, ajouter les préfixes
 * migrés à `ENFORCED`. Quand toute la dette est résorbée, passer `ENFORCED` à `["src/"]`.
 *
 * Usage : bun apps/web/scripts/check-dal-boundary.ts
 */
import { Glob } from "bun";

const ROOT = new URL("../", import.meta.url).pathname; // apps/web/
const SRC = `${ROOT}src`;
const DB_IMPORT = /from\s+["'](@rpbey\/db|@\/lib\/db)["']/;

const DAL_PREFIX = "server/dal/";
// Zones dont la frontière est STRICTEMENT appliquée (toute migration y ajoute son préfixe).
const ENFORCED = ["server/services/", "app/api/v1/"];

const glob = new Glob("**/*.{ts,tsx}");
const offenders: string[] = [];

for await (const rel of glob.scan({ cwd: SRC })) {
  if (rel.startsWith(DAL_PREFIX)) continue;
  const content = await Bun.file(`${SRC}/${rel}`).text();
  if (DB_IMPORT.test(content)) offenders.push(rel);
}

offenders.sort();
const enforcedViolations = offenders.filter((f) => ENFORCED.some((p) => f.startsWith(p)));

console.log(
  `[dal-boundary] dette de couplage legacy : ${offenders.length} fichier(s) hors DAL importent la DB.`,
);
if (enforcedViolations.length > 0) {
  console.error(
    `\n[dal-boundary] ÉCHEC — ${enforcedViolations.length} violation(s) dans une zone migrée (doit passer par src/server/dal/) :`,
  );
  for (const f of enforcedViolations) console.error(`  - src/${f}`);
  process.exit(1);
}
console.log("[dal-boundary] OK — aucune régression dans les zones migrées.");
