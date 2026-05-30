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
        manualChunks: {
          pixi: ["pixi.js"],
          colyseus: ["colyseus.js"],
          discord: ["@discord/embedded-app-sdk"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
