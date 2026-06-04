import { $ } from "bun";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const webDir = resolve(root, "apps/web");
const botEnv = resolve(root, "apps/bot/.env");

console.log("[sync-profiles] 1/2 — enrichissement Discord des comptes liés…");
await $`bun --env-file=${botEnv} scripts/sync-discord-members.ts`.cwd(webDir);

console.log(
  "[sync-profiles] 2/2 — recalcul du classement global (tous tournois, inscrits + non-inscrits)…",
);
await $`bun --env-file=${botEnv} scripts/recompute-rankings.ts`.cwd(webDir);

console.log("[sync-profiles] OK.");
