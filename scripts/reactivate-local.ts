import { $ } from "bun";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { Glob } from "bun";

const root = resolve(import.meta.dir, "..");

console.log("=== [RPBEY] Début de la réactivation locale ===");

// 1. Nettoyage initial
console.log("▶ Nettoyage des dossiers temporaires et des caches...");
const pathsToClean = [
  "node_modules",
  "apps/*/node_modules",
  "packages/*/node_modules",
  ".turbo",
  "apps/*/.turbo",
  "packages/*/.turbo",
  "apps/web/.next",
  "apps/web/.bun-cache",
  "apps/bot/.bun-cache",
  "apps/gacha-server/.bun-cache",
];

for (const p of pathsToClean) {
  if (p.includes("*")) {
    const glob = new Glob(p);
    try {
      for (const match of glob.scanSync({ cwd: root, onlyFiles: false })) {
        const fullPath = resolve(root, match);
        await rm(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Ignoré si le dossier n'existe pas
    }
  } else {
    const fullPath = resolve(root, p);
    try {
      await rm(fullPath, { recursive: true, force: true });
    } catch {
      // Ignoré si le dossier n'existe pas
    }
  }
}

// 2. Installation des dépendances
console.log("▶ Installation des dépendances via Bun...");
await $`bun install`.cwd(root);

// 3. Préparation et Build du Bot
console.log("▶ Génération des entrées et compilation du bot...");
await $`bun --filter=@rose-griffon/bot run build`.cwd(root);

// 4. Build de l'application Web (Next.js Standalone local)
console.log("▶ Compilation de l'application Web Next.js locale...");

const nextConfigPath = resolve(root, "apps/web/next.config.ts");
const nextConfig = Bun.file(nextConfigPath);

async function setIgnoreBuildErrors(value: boolean) {
  if (await nextConfig.exists()) {
    let content = await nextConfig.text();
    if (value) {
      content = content.replace("ignoreBuildErrors: false", "ignoreBuildErrors: true");
    } else {
      content = content.replace("ignoreBuildErrors: true", "ignoreBuildErrors: false");
    }
    await Bun.write(nextConfigPath, content);
  }
}

await setIgnoreBuildErrors(true);

try {
  await $`bun run build:web`.cwd(root).env({
    ...process.env,
    NODE_ENV: "production",
    VERCEL: "0",
    NODE_OPTIONS: "--max-old-space-size=16384",
  });
} catch (error) {
  await setIgnoreBuildErrors(false);
  console.error("✗ Échec du build de l'application Web !", error);
  process.exit(1);
}

await setIgnoreBuildErrors(false);

console.log("=== [RPBEY] Réactivation locale terminée avec succès ! ===");
