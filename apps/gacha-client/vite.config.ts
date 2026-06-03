import { defineConfig } from "vite";

/**
 * Build Bun-only : `bun run build` lance `vite build` (vite tourne sous Bun).
 *
 * Discord Activity sert l'app derrière son proxy `/.proxy/` ; tous les assets
 * doivent donc être référencés en chemins RELATIFS (`base: "./"`), jamais en
 * `/assets/...` absolu. Les appels API externes (web/serveur gacha) passent par
 * des URL absolues définies via `import.meta.env` (build-time) — voir src/env.ts.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Vite 8 (moteur rolldown) exige `manualChunks` sous forme de fonction :
        // la forme objet `{ chunk: [modules] }` n'est plus supportée
        // (« manualChunks is not a function »). On route chaque module vers son
        // chunk par correspondance sur son id.
        manualChunks(id: string): string | undefined {
          if (id.includes("node_modules/pixi.js") || id.includes("node_modules/@pixi/"))
            return "pixi";
          if (id.includes("node_modules/colyseus.js")) return "colyseus";
          if (id.includes("node_modules/@discord/embedded-app-sdk")) return "discord";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
