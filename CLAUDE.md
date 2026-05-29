# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`rpbey` — monorepo de la communauté Beyblade **République Populaire du Beyblade** (tournois, classements, gacha TCG, économie, duels). Deux applis prod sur le VPS + des packages partagés, le tout en **Bun** (jamais node/npm/tsx) orchestré par **Turborepo**.

- `apps/web` (`@rose-griffon/dashboard`) — dashboard **Next.js 16** (App Router, Turbopack, `output: standalone`), MUI v9 + Emotion, better-auth. systemd `rpbey-web.service` :3002, nginx `rpbey.fr`. Détails → **`apps/web/AGENTS.md`**.
- `apps/bot` (`@rose-griffon/bot`) — **bot Discord** (discordx fork + tsyringe DI + discord.js v14, rendu image Skia). systemd `rpb-bot.service`, API `Bun.serve` :3001. **Aucune IA/LLM** : tout est algorithmique. Détails → **`apps/bot/AGENTS.md`**.
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

**Lint = oxlint** (`.oxlintrc.json`) **+ oxfmt** (`.oxfmtrc.json`) ; le web lance **aussi eslint** (`apps/web` : `bun run lint`). **Indentation = tabs** partout. Bun ≥ 1.3 requis (`Bun.cron`). Linker `hoisted` dans `bunfig.toml` (le défaut `isolated` casse les bundlers Next.js).

### Par appli

- **web** : `bunx tsc --noEmit` (le build a `ignoreBuildErrors: true` → tsc est le seul garde-fou type). Build prod + déploiement → §Déploiement. QA visuel : `CHROME=/usr/local/bin/chromium bun scripts/shoot.ts`.
- **bot** : `bunx tsc --noEmit`, puis `bun run build` (**SWC**, pas `bun build`) → `dist/`. `bun run start`. Tests : `bun test`, bridge Activity `bun run test:bridge`, ciblé `bun test test/<file>.test.ts` ou `bun test -t "<pattern>"`.

## Architecture — la vue d'ensemble

### DB partagée = le fait transverse #1

Les **deux** applis tapent le **même Postgres LOCAL** (socket `/var/run/postgresql`, base `rpb_neon`, user `ubuntu`) via le package **`@rpbey/db`** (Drizzle ORM + postgres-js, ~53 tables, `schema.ts` + `relations.ts`). C'est la **source de vérité unique** du schéma — toute évolution DB passe par ce package, pas par une migration locale à une appli.

- Le **web** consomme Drizzle directement (`@rpbey/db`).
- Le **bot** passe par une **façade compatible Prisma** (`apps/bot/src/lib/prisma.ts`, ~860 lignes) qui émule l'API Prisma sur Drizzle, pour ne pas réécrire ~295 call-sites. Dans le bot : utiliser `prisma`/`this.prisma`, **jamais** Drizzle inline.

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
- `@rose-griffon/challonge` (v3) — client Challonge canonique : API v1 + **scraper via `@aphrody-code/bxc`** (curl-impersonate Chrome, transports dans `src/transports/`). `@rose-griffon/challonge-core` — logique de brackets pure (modèle/manager/viewer).

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
- Pièges build : pas d'import runtime de `@rpbey/db` depuis un client component (fuite postgres → bundle) ; `transpilePackages: ["@vidstack/react"]` ; scraper challonge importé via `@/lib/challonge-vendor/scraper` (pas le barrel) ; `ignoreBuildErrors: true` (drift MUI X).

## Style commits

Conventional en français, 1 ligne : `feat|fix|chore|refactor|docs(scope):`. Scopes fréquents : `bot`, `web`, `bridge`, `commands`, `cron`, `audit`, `e2e`, `db`. **Jamais** d'emoji, de `Co-Authored-By` ni de `Generated with…`.
