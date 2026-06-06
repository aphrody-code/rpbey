---
title: "Next.js — notes build rpbey (apps/web)"
description: "Pièges de build Next.js App Router pour le dashboard rpbey (Vercel). La doc Next.js complète est bundlée et version-matchée — voir ci-dessous."
scope:
  - apps/web
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - next/config
  - transpilePackages
  - serverExternalPackages
---

# Next.js — notes build rpbey (apps/web)

> **Doc Next.js complète** : version-matchée et bundlée dans
> `node_modules/next/dist/docs/` (cf. `apps/web/AGENTS.md`). On ne vendore plus de
> dump `llms-full.txt` (3,4 Mo) — il dérivait de la version installée et faisait
> doublon avec la doc bundlée. `grep`/`Read` la doc bundlée à la place.

## Version

- Runtime : Next.js `16.3.0-canary.x` (catalog), React `19.x`, Bun (`bun --bun`), pas Node.
- Réévaluer le pin canary quand `16.3.0` passe `latest`.

## Pièges build rpbey (découverts au cutover, 2026-05-27)

1. **Fuite server→client postgres.js** : un `import { schema } from "@/lib/db"` _runtime_ dans
   `apps/web/src/lib/types.ts` tirait `postgres.js` (`fs/net/tls/perf_hooks`) dans le bundle navigateur
   dès qu'un client component importait un type. Fix : dériver les types via `type Schema = typeof import("@rpbey/db").schema` (type-only, effacé à la compilation → aucune arête runtime).
2. **`@vidstack/react` ship du JSX non-transpilé** dans ses chunks `.js` → panic Turbopack
   `Expected ';', got '{'` (`<SlotClone>`). Fix : `transpilePackages: ["@vidstack/react"]` dans `next.config.ts`.
3. **`experimental.turbopackFileSystemCacheForBuild`** : laissé `false` (a produit des chunks JSX
   corrompus sur build clean ; réactiver si patché upstream).
4. **`output: "standalone"`** : Utilisé uniquement pour les tests locaux hors Vercel. Le serveur est `.next/standalone/apps/web/server.js`.
5. **`serverExternalPackages`** : `postgres`, `puppeteer-extra*`, transitives (`is-plain-object`, …), `@tobyg74/tiktok-api-dl`.
6. **`typescript.ignoreBuildErrors: true`** (drift types MUI X v9 + React 19) — le type-check réel passe par `bunx tsc --noEmit` (0 erreur), pas par le build.
7. **Binaire `next` hoisté** : `linker=hoisted` → `next` est à `~/rpbey/node_modules/.bin/next` (pas dans `apps/web/node_modules/.bin`).

## Build

Le build de production tourne sur Vercel avec le runtime Node.js via le script de build :
```bash
bun run build:vercel
```

Pour compiler localement à des fins de test (hors production) :
```bash
cd ~/rpbey/apps/web
bun run build
```

Turbopack est le bundler par défaut (Next 16). `next build` ne lance plus le linter (Next 16+).
