#!/usr/bin/env bun
/**
 * check-sdk-drift.ts — GARDE-FOU DU NON-DRIFT contrat Zod → OpenAPI → SDK.
 *
 * L'architecture API-first repose ENTIÈREMENT sur le fait que le SDK typé
 * `@rpbey/api-client` (généré, commité) reste le miroir EXACT du contrat Zod
 * (`@rpbey/api-contract`) : c'est la source unique de vérité côté client. Si le
 * contrat évolue mais qu'on oublie de régénérer le SDK, le code consommateur
 * compile sur des types PÉRIMÉS → faux-vert au build, drift silencieux runtime.
 *
 * Ce script ferme ce trou : il REgénère le SDK (`gen:api` = emit-openapi.ts puis
 * `@hey-api/openapi-ts`) puis vérifie via `git diff --exit-code` que l'artefact
 * commité (`packages/api-client/src/generated`) n'a PAS bougé. Diff = SDK périmé
 * non committé → exit 1 (CI rouge). C'est le pendant `gen:api` du gate DAL.
 *
 * NB : `apps/web/openapi.json` est gitignored (intermédiaire de build, pas
 * tracké) ; le diff porte donc sur l'artefact TRACKÉ qui fait foi côté consommateur
 * (`packages/api-client/src/generated`). Régénérer le SDK régénère aussi l'OpenAPI
 * en amont, donc une dérive de contrat se propage et est captée ici.
 *
 * Usage : bun apps/web/scripts/check-sdk-drift.ts   (alias : `bun run gen:api:check`)
 */
import { resolve } from "node:path";

const WEB_DIR = resolve(import.meta.dir, ".."); // apps/web/
const REPO_ROOT = resolve(WEB_DIR, "../.."); // racine monorepo
// Cible TRACKÉE du diff : la sortie SDK commitée qui fait foi côté consommateur.
const GENERATED = "packages/api-client/src/generated";

function run(cmd: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

// 1. Régénère le SDK depuis le contrat (gen:api vit dans apps/web/package.json).
console.log("[sdk-drift] régénération du SDK (gen:api)…");
const gen = run(["bun", "run", "gen:api"], WEB_DIR);
if (gen.code !== 0) {
  console.error("[sdk-drift] ÉCHEC — la génération du SDK a échoué :");
  if (gen.stderr.trim()) console.error(gen.stderr.trim());
  process.exit(gen.code || 1);
}

// 2. Le SDK régénéré doit être identique au SDK commité (sinon = périmé).
const diff = run(["git", "diff", "--exit-code", "--", GENERATED], REPO_ROOT);
if (diff.code !== 0) {
  console.error(`[sdk-drift] ÉCHEC — le SDK généré diffère du SDK commité (${GENERATED}).`);
  console.error(
    "[sdk-drift] Le contrat a changé sans régénération : lance `bun run gen:api` puis commit.",
  );
  if (diff.stdout.trim()) console.error(diff.stdout);
  process.exit(1);
}

console.log("[sdk-drift] OK — le SDK commité est à jour avec le contrat.");
