# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`rpbey` — monorepo de la communauté Beyblade **République Populaire du Beyblade** (tournois, classements, gacha TCG, économie, duels). Trois applis prod sur le VPS (web, bot, gacha-server) + des packages partagés, le tout en **Bun** (jamais node/npm/tsx) orchestré par **Turborepo**.

- `apps/web` (`@rose-griffon/dashboard`) — dashboard **Next.js 16** (App Router, Turbopack, `output: standalone`), MUI v9 + Emotion, better-auth. systemd `rpbey-web.service` :3002, nginx `rpbey.fr`. Détails → **`apps/web/AGENTS.md`**.
- `apps/bot` (`@rose-griffon/bot`) — **bot Discord** (discordx fork + tsyringe DI + discord.js v14, rendu image Skia). systemd `rpb-bot.service`, API `Bun.serve` :3001. **Aucune IA/LLM** : tout est algorithmique. Détails → **`apps/bot/AGENTS.md`**.
- `apps/gacha-server` (`@rose-griffon/gacha-server`) — **serveur de jeu gacha** (Colyseus 0.17 sur Bun, transport `BunWebSockets`) : REST économie consommée par le bot + temps réel Discord Activity. systemd `rpbey-gacha.service` :5050 (loopback), nginx `api.rpbey.fr/gacha/` (WSS). Backé par `@rpbey/db`. Détails → **`docs/gacha/server.md`**.
- `apps/cdn` (`cdn`) — serveur statique Bun (`server.ts`).

> Naming : deux scopes coexistent — `@rose-griffon/*` (apps + challonge) et `@rpbey/*` (packages db/types/di/discordx/pagination). Filtres turbo canoniques : `@rose-griffon/dashboard`, `@rose-griffon/bot`.
> `apps/bot/CLAUDE.md` est désormais un **pointeur fin** vers `apps/bot/AGENTS.md` (l'ancien contenu Prisma/Neon, d'avant la migration Drizzle du 2026-05-27, a été retiré) — le guide bot canonique reste `apps/bot/AGENTS.md`.

## Commandes (racine)

| But                    | Commande                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- |
| Dev (tout / web / bot) | `bun run dev` · `bun run dev:web` · `bun run dev:bot`                         |
| Build                  | `bun run build` · `bun run build:web`                                         |
| Type-check             | `bun run type-check` (turbo) — le vrai gate par appli est `bunx tsc --noEmit` |
| Lint / fix             | `bun run lint` (oxlint) · `bun run lint:fix`                                  |
| Format / check         | `bun run format` (oxfmt) · `bun run format:check`                             |
| Test                   | `bun run test` (turbo)                                                        |
| E2E (chromium réel)    | `bun run e2e` (== `CHROME=/usr/local/bin/chromium bun scripts/e2e.ts`)        |
| Docs (sync/format)     | `bun run docs` (umbrella : map+index+fmt+check) · `docs:check` · `docs:map` · `docs:index` · `docs:fmt` (outil Bun-natif `scripts/docs.ts`) |

> Doc structurée : tout fichier sous `docs/` porte un **frontmatter Zod-typé obligatoire** (`title/description/scope/status/last_updated`) ; `docs/README.md` (index) et `docs/REPO_MAP.md` (cartographie) sont **générés**, ne pas les éditer. Le hook `.githooks/pre-commit` régénère + vérifie à chaque commit. Convention complète → **`docs/documentation-system.md`**.

**Lint = oxlint** (`.oxlintrc.json`) **+ oxfmt** (`.oxfmtrc.json`) **uniquement** (ESLint totalement retiré de web+bot le 2026-05-29 ; `apps/web` `bun run lint` = `oxlint . && bun scripts/check-dal-boundary.ts`). **Indentation TS/TSX = 2 espaces** (défaut oxfmt — le `.oxfmtrc` n'override pas). ⚠️ Un hook d'éditeur **re-tabule** les fichiers après chaque `Edit` (tabs **non**-canoniques, rejetés par `oxfmt --check`) : lancer `bunx oxfmt <fichiers>` puis `bunx oxfmt --check` avant tout commit (c'est le gate). Bun ≥ 1.3 requis (`Bun.cron`). Linker `hoisted` dans `bunfig.toml` (le défaut `isolated` casse les bundlers Next.js).

### Par appli

- **web** : `bunx tsc --noEmit` (le gate type principal). Le build type-check aussi désormais (`next.config.ts` `ignoreBuildErrors: false` depuis 2026-05-29). Build prod + déploiement → §Déploiement. QA visuel : `CHROME=/usr/local/bin/chromium bun scripts/shoot.ts`.
- **bot** : `bunx tsc --noEmit`, puis `bun run build` (**SWC**, pas `bun build`) → `dist/`. `bun run start`. Tests : `bun test`, bridge Activity `bun run test:bridge`, ciblé `bun test test/<file>.test.ts` ou `bun test -t "<pattern>"`.

## Architecture — la vue d'ensemble

### DB partagée = le fait transverse #1

Les **deux** applis tapent le **même Postgres LOCAL** (socket `/var/run/postgresql`, base `rpb_neon`, user `ubuntu`) via le package **`@rpbey/db`** (Drizzle ORM + postgres-js, ~54 tables, `schema.ts` + `relations.ts`). C'est la **source de vérité unique** du schéma — toute évolution DB passe par ce package, pas par une migration locale à une appli.

- Le **web** consomme Drizzle directement (`@rpbey/db`).
- Le **bot** passe par une **façade compatible Prisma** (`apps/bot/src/lib/prisma.ts`, ~900 lignes) qui émule l'API Prisma sur Drizzle, pour ne pas réécrire ~295 call-sites. Dans le bot : utiliser `prisma`/`this.prisma`, **jamais** Drizzle inline.

### 🔑 Invariant timestamp (split de mode assumé)

La migration Prisma→Drizzle a laissé un split volontaire sur les colonnes `timestamp` — **la source #1 de bugs runtime** :

| Tables                                                                        | Mode            | Type JS attendu/retourné |
| ----------------------------------------------------------------------------- | --------------- | ------------------------ |
| **auth** : `users`, `accounts`, `sessions`, `verifications`, `twoFactors`     | `mode:"date"`   | objet **`Date`**         |
| **toutes les autres** (tournaments, profiles, decks, rankings, gacha, anime…) | `mode:"string"` | **string ISO**           |

Raison : better-auth écrit des `Date`. Conséquences : écrire une colonne **auth** = passer un `Date` ; écrire une **non-auth** = passer `new Date().toISOString()` ; **lire pour afficher** = toujours wrapper `new Date(x)` avant `.toLocaleDateString()`/`.getTime()`. Mauvais type → `TypeError: x.toISOString is not a function` ou `Received an instance of Date`. En cas de doute : `bun -e "import{schema}from'@rpbey/db';console.log(schema.<table>.<col>.columnType)"`.

### Packages partagés (`packages/`)

- `@rpbey/db` (Drizzle, ci-dessus) · `@rpbey/types` (types-only dérivés du schéma).
- `packages/discordx/` — **fork discordx** vendu : fournit `@rpbey/discordx`, `@rpbey/di` (tsyringe registry), `@rpbey/pagination`. Ignoré par oxlint/oxfmt.
- `@rose-griffon/challonge` (v4) — client canonique : API v1 + **write v2.1 OAuth** + crawler/transports/engine/cache **pluggables** + schémas Zod (33 subpath exports), tout via `@aphrody-code/bxc` (curl-impersonate, zéro Puppeteer). Consommé **uniquement par apps/bot** (apps/web a une copie vendorée `challonge-vendor/` + `@rose-griffon/challonge-core` brackets purs) → bxc-FFI n'affecte pas le build web. tsconfig durci (`lib ESNext+DOM`, `types bun`) → `tsc --noEmit` = 0.

### Crawling & RAG X.com (Twitter)

Pour comprendre le fonctionnement de la session de crawling, l'indexation Redis et la recherche RAG Gemini sur le métagame, se référer à **`docs/crawling-rag-x.md`**.

### Bot — invariants runtime (compile mais casse au runtime si violés)

- **`import type` casse la DI tsyringe** : efface `design:paramtypes` → injection `undefined`. Toute classe injectée = `import { Class }`.
- **`reflect-metadata` en 1ʳᵉ ligne** de `src/index.ts` ; DI réglée **avant** l'import des modules décorés.
- **Build SWC obligatoire** (décorateurs legacy + `emitDecoratorMetadata`). Conséquence : **pas de `Bun.$`** ni de rewrites TS-direct dans `apps/bot/src/**`. systemd lance `dist/index.js`.
- `src/_entry-imports.generated.ts` — **généré** (`scripts/gen-entry-imports.ts`), gitignored, **ne pas éditer** ; régénérer si on ajoute commande/event.
- `bun run build` re-symlinke `debug` pour `discord-html-transcripts` (`patch:dht`) — à relancer après chaque `bun install` (sinon crash runtime `Cannot find module 'debug'`).
- Lock PID singleton : refus de double instance = exit 11.
- `customId` Discord = contrat : ne pas renommer sans màj le handler `@ButtonComponent`/`@SelectMenuComponent` correspondant.

### Web — déploiement & build (lire `apps/web/AGENTS.md`)

- **`scripts/deploy-web.sh` OBLIGATOIRE après chaque `next build`** : le standalone n'inclut **pas** `public/` ni `data/*` (exclus du tracing). Sans lui → chunks JS 404 (site mort), images/rankings vides. Le script copie `.next/static`, symlinke `public/` → CDN, copie les exports `data/`.
- Pièges build : pas d'import runtime de `@rpbey/db` depuis un client component (fuite postgres → bundle) ; `transpilePackages: ["@vidstack/react"]` ; scraper challonge importé via `@/lib/challonge-vendor/scraper` (pas le barrel) ; `ignoreBuildErrors: false` (drift MUI X v9 résorbé → build type-check strict).
- **Migration API-first** (plan `tingly-wondering-river`) : complète et déployée **en co-localisé** (dette `@rpbey/db` hors DAL = 0, gate transitif global). L'objectif « déployable seul Vercel » est **ABANDONNÉ — on reste sur le VPS** (décision 2026-05-29). NE PAS rechasser RSC→SDK / client→SDK / smoke standalone : c'est du travail mort sur VPS-only (le seam `isRemote`/SDK reste dormant et inerte, inoffensif).
- **⚠️ Le gate de vérif DOIT inclure `next build`, pas seulement `tsc`** : un client component qui importe une façade `lib/*` ré-exportant un module server-only casse le bundle browser **sans que `tsc` le voie** (`tsc` valide les types, pas la frontière server/client du bundler). Cas réel : `TvFeed` → `lib/beytube` → `server/dal/stream`.

## Style commits

Conventional en français, 1 ligne : `feat|fix|chore|refactor|docs(scope):`. Scopes fréquents : `bot`, `web`, `bridge`, `commands`, `cron`, `audit`, `e2e`, `db`. **Jamais** d'emoji, de `Co-Authored-By` ni de `Generated with…`.
