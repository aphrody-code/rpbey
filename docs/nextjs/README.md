# Next.js — doc vendorée (knowledge base monorepo rpbey)

Doc complète Next.js récupérée le **2026-05-27** depuis `nextjs.org/docs/llms-full.txt`.

## Version

- **Cible runtime : Next.js `16.2.6`** = dernière version **stable** (`dist-tag latest`) au 2026-05-27.
  Le monorepo est **déjà à jour** — il n'existe pas de stable plus récente.
- Au-dessus de 16.2.6 il n'y a que `16.3.0-canary.x` (pré-release, **pas pour la prod**).
  Réévaluer quand 16.3.0 passe `latest`.
- React stable = `19.2.6` (catalog `^19.2.5` y flotte). Runtime Bun (`bun --bun`), pas Node.

## Fichiers
- `llms-full.txt` — doc complète (3,4 Mo / 88 661 lignes). **Ne pas lire en entier** : `grep -n`/`sed -n`.
- `llms-index.txt` — index officiel (liens `nextjs.org/docs/*`).

## Pièges build rpbey (découverts au cutover, 2026-05-27)

1. **Fuite server→client postgres.js** : un `import { schema } from "@/lib/db"` *runtime* dans
   `apps/web/src/lib/types.ts` tirait `postgres.js` (`fs/net/tls/perf_hooks`) dans le bundle navigateur
   dès qu'un client component importait un type. Fix : dériver les types via `type Schema = typeof import("@rpbey/db").schema` (type-only, effacé à la compilation → aucune arête runtime).
2. **`@vidstack/react` ship du JSX non-transpilé** dans ses chunks `.js` → panic Turbopack
   `Expected ';', got '{'` (`<SlotClone>`). Fix : `transpilePackages: ["@vidstack/react"]` dans `next.config.ts`.
3. **`experimental.turbopackFileSystemCacheForBuild`** : laissé `false` (a produit des chunks JSX
   corrompus sur build clean ; réactiver si patché upstream).
4. **`output: "standalone"`** quand `!process.env.VERCEL` : le serveur est `.next/standalone/apps/web/server.js`
   (lancé via `bun server.js`, lit `PORT`/`HOSTNAME`), **pas** `next start`. Après build, copier :
   `cp -r .next/static .next/standalone/apps/web/.next/static` et `cp -r public .next/standalone/apps/web/public`.
5. **`serverExternalPackages`** : `postgres`, `puppeteer-extra*`, transitives (`is-plain-object`, …), `@tobyg74/tiktok-api-dl`.
6. **`typescript.ignoreBuildErrors: true`** (drift types MUI X v9 + React 19) — le type-check réel passe par `bunx tsc --noEmit` (0 erreur), pas par le build.
7. **Binaire `next` hoisté** : `linker=hoisted` → `next` est à `~/rpbey/node_modules/.bin/next` (pas dans `apps/web/node_modules/.bin`).

## Build

```bash
cd ~/rpbey/apps/web
PGHOST=/var/run/postgresql PGDATABASE=rpb_neon PGUSER=ubuntu NODE_ENV=production \
  /home/ubuntu/rpbey/node_modules/.bin/next build
# succès = .next/BUILD_ID présent + .next/standalone/apps/web/server.js
```

Turbopack est le bundler par défaut (Next 16). `next build` ne lance plus le linter (Next 16+).
