import { $ } from "bun";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const webDir = resolve(root, "apps/web");

console.log("\n\x1b[1;34m=== [RPBEY] Deploying Dashboard to Vercel ===\x1b[0m");

const vercelToken = process.env.VERCEL_TOKEN || "";

if (vercelToken) {
  console.log("▶ Deploying using VERCEL_TOKEN...");
  await $`vercel deploy --prod --token ${vercelToken} --yes`.cwd(webDir);
} else {
  console.log("▶ Deploying via Vercel CLI (interactive)...");
  await $`vercel deploy --prod`.cwd(webDir);
}

console.log("\x1b[1;32m=== [RPBEY] Deployment complete! ===\x1b[0m\n");
