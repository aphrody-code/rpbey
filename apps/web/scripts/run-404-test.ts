#!/usr/bin/env bun
/**
 * run-404-test.ts — lance `tests/no-404.bxc.test.ts` dans un CWD NEUTRE.
 *
 * Pourquoi : `apps/web/bunfig.toml` précharge `happydom.ts` (window global +
 * Same-Origin Policy) pour les tests de composants. Ce preload casse le crawl
 * cross-origin du site DÉPLOYÉ (le moteur CDP de bxc-test + fetch se heurtent à
 * la SOP de happy-dom). On exécute donc `bun test` depuis un dossier temporaire
 * SANS bunfig, en pointant le fichier de test par chemin absolu — environnement
 * Bun pur, fetch natif, statut HTTP fiable.
 *
 * Cible via `RPBEY_TEST_BASE_URL` (def. https://rpbey.vercel.app).
 *   bun run test:404
 *   RPBEY_TEST_BASE_URL=https://rpbey.fr bun run test:404
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const testFile = join(here, "tests", "no-404.bxc.test.ts");
const neutralCwd = mkdtempSync(join(tmpdir(), "rpbey-404-"));

const proc = Bun.spawn(["bun", "test", testFile], {
  cwd: neutralCwd,
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    // Résout `@aphrody/bxc-test` & co depuis le node_modules du monorepo.
    NODE_PATH: join(here, "..", "..", "node_modules"),
    RPBEY_TEST_BASE_URL: process.env.RPBEY_TEST_BASE_URL ?? "https://rpbey.vercel.app",
  },
});

process.exit(await proc.exited);
