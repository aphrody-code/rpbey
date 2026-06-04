@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`rpbey` — monorepo de la communauté Beyblade **République Populaire du Beyblade** (tournois, classements, gacha TCG, économie, duels). L'architecture de production est 100 % serverless (web sur Vercel, bot et gacha-server sur Google Cloud Run, base Neon Postgres et médias sur Vercel Blob). Aucun service de production ne tourne sur le VPS.

- `apps/web` (`@rose-griffon/dashboard`) — dashboard **Next.js 16** (App Router, Turbopack) hébergé sur **Vercel** (`rpbey.vercel.app` / `rpbey.fr`). Connecté à **Neon Postgres** et utilisant **Vercel Blob** pour le stockage de médias. Détails → **`apps/web/AGENTS.md`**.
- `apps/bot` (`@rose-griffon/bot`) — **bot Discord** (discordx fork + tsyringe DI + discord.js v14, rendu image Skia) hébergé sur **Google Cloud Run** (`rpbey-bot` sur le projet GCP `aphrody`, région `europe-west3`). Container persistant en singleton (min=1, max=1) pour la gateway WS permanente. Sans Redis (mentions et état in-process rebackés sur Neon). Détails → **`apps/bot/AGENTS.md`**.
- `apps/gacha-server` (`@rose-griffon/gacha-server`) — **serveur de jeu gacha** (Colyseus 0.17 sur Bun, transport `BunWebSockets`) hébergé sur **Google Cloud Run** (`rpbey-gacha`). REST économie et salons en temps réel pour Discord Activity. Backé par Neon. Détails → **`docs/gacha/server.md`**.
- `apps/gacha-client` (`@rose-griffon/gacha-client`) — **client Discord Activity** PixiJS v8 (Vite). Déployé de manière statique sur **Vercel** ou serveurs statiques. Détails → **`docs/gacha/activity-client.md`**.
- `apps/cdn` (`cdn`) — serveur statique Bun (legacy, remplacé en production par Vercel Blob et CDN Vercel).

> Naming : deux scopes coexistent — `@rose-griffon/*` (apps + challonge) et `@rpbey/*` (packages db/types/di/discordx/pagination). Filtres turbo canoniques : `@rose-griffon/dashboard`, `@rose-griffon/bot`.
> `apps/bot/CLAUDE.md` est désormais un **pointeur fin** vers `apps/bot/AGENTS.md` — le guide bot canonique reste `apps/bot/AGENTS.md`.

## Commandes (racine)

| But                    | Commande                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- |
| Dev (tout / web / bot) | `bun run dev` · `bun run dev:web` · `bun run dev:bot`                         |
| Build                  | `bun run build` · `bun run build:web`                                         |
| Type-check             | `bun run type-check` (turbo) — le vrai gate par appli est `bunx tsc --noEmit` |
| Lint / fix             | `bun run lint` (oxlint) · `bun run lint:fix`                                  |
| Format / check         | `bun run format` (oxfmt) · `bun run format:check`                             |
| Test                   | `bun run test:all` (custom runner, **every** scope) · `bun run test:ci` (--strict, CI) · `bun run test` (turbo, fast/cached) |
| Test (flake / scope)   | `bun run test:flake` (--randomize --rerun-each=3) · `bun run test:vendored` (discordx fork) · `bun run test:cov` (lcov+junit) |
| E2E (chromium réel)    | `bun run e2e` (== `CHROME=/usr/local/bin/chromium bun scripts/e2e.ts`)        |
| Docs (sync/format)     | `bun run docs` (umbrella : map+index+fmt+check) · `docs:check` · `docs:map` · `docs:index` · `docs:fmt` (outil Bun-natif `scripts/docs.ts`) |
| Réactivation locale    | `bun scripts/reactivate-local.ts` (Nettoyage caches, bun install, build local) |

> Doc structurée : tout fichier sous `docs/` porte un **frontmatter Zod-typé obligatoire** (`title/description/scope/status/last_updated`) ; `docs/README.md` (index) et `docs/REPO_MAP.md` (cartographie) sont **générés**, ne pas les éditer. Le hook `.githooks/pre-commit` régénère + vérifie à chaque commit. Convention complète → **`docs/documentation-system.md`**.

**Lint = oxlint** (`.oxlintrc.json`) **+ oxfmt** (`.oxfmtrc.json`) **uniquement** (ESLint totalement retiré de web+bot le 2026-05-29 ; `apps/web` `bun run lint` = `oxlint . && bun scripts/check-dal-boundary.ts`). **Indentation TS/TSX = 2 espaces** (défaut oxfmt — le `.oxfmtrc` n'override pas). ⚠️ Un hook d'éditeur **re-tabule** les fichiers après chaque `Edit` (tabs **non**-canoniques, rejetés par `oxfmt --check`) : lancer `bunx oxfmt <fichiers>` puis `bunx oxfmt --check` avant tout commit (c'est le gate). Bun ≥ 1.3 requis (`Bun.cron`). Linker `hoisted` dans `bunfig.toml` (le défaut `isolated` casse les bundlers Next.js).

### Par appli

- **web** : `bunx tsc --noEmit` (le gate type principal). Le build type-check aussi désormais (`next.config.ts` `ignoreBuildErrors: false` depuis 2026-05-29). Build prod + déploiement → §Déploiement. QA visuel : `CHROME=/usr/local/bin/chromium bun scripts/shoot.ts`.
- **bot** : `bunx tsc --noEmit`, puis `bun run build` (**SWC**, pas `bun build`) → `dist/`. `bun run start`. Tests : `bun test`, bridge Activity `bun run test:bridge`, ciblé `bun test test/<file>.test.ts` ou `bun test -t "<pattern>"`. ⚠️ Les 6 suites bot utilisent `mock.module` **process-global** + dynamic-import top-level → lancer les 6 fichiers dans un **seul** process fuit les mocks (échec dépendant de l'ordre). Le runner `scripts/test-all.ts` les **isole par fichier** (`perFile`) ; un `bun test` global sur le bot peut diverger selon l'ordre de découverte.

> **Test runner sur-mesure — `scripts/test-all.ts`** (couvre **TOUS** les 25 scopes). Pourquoi : `turbo run test` ne lance que les scopes ayant un script `test` → `gacha-server` + `dashboard` (qui **ont** des tests) étaient **silencieusement skippés**. Le runner énumère chaque membre des globs `workspaces`, découvre les fichiers via git (prune `.gitignore` → pas de double-run de la copie `.next/standalone/…utils.test.ts`), lance `bun test` par scope dans son cwd (preload bunfig par scope : reflect-metadata bot, happy-dom dashboard), classe explicitement le fork vendored discordx + le SDK généré (`@rpbey/api-client`) + le leaf cassé (`@rpbey/discordx`, self-dep `discordx` absente), affiche une matrice et échoue sur tout gap (`--strict`). Tiers : unit (défaut) / live (`--live`, challonge self-skip) / vendored (`--vendored`) / skip. CI = `bun run test:ci`.

## Architecture — la vue d'ensemble

### DB partagée = le fait transverse #1

Les applications partagent la **même base de données Neon Postgres** via le package **`@rpbey/db`** (Drizzle ORM + postgres-js, ~54 tables, `schema.ts` + `relations.ts`). C'est la **source de vérité unique** du schéma — toute évolution DB passe par ce package, pas par une migration locale à une appli. Les environnements de production utilisent `DATABASE_URL` (pooled) pour le runtime et `DIRECT_DATABASE_URL` (direct) pour les migrations. Le socket local `/var/run/postgresql` n'est conservé qu'en fallback pour le dev local.

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

### Chat IA « Rpbey » (apps/web) — Mode extractif déterministe (LLM retiré)

Le pipeline de chat utilise un retrieval hybride Beyblade (`server/services/chat.ts`, `prepareTurn`) pour extraire les faits du corpus unifié (wiki, combos, etc.) et générer des réponses extractives déterministes. Tout ce qui est lié à `llama.cpp` / local LLMs a été retiré pour alléger l'infrastructure.

### Bot — invariants runtime (compile mais casse au runtime si violés)

- **`import type` casse la DI tsyringe** : efface `design:paramtypes` → injection `undefined`. Toute classe injectée = `import { Class }`.
- **`reflect-metadata` en 1ʳᵉ ligne** de `src/index.ts` ; DI réglée **avant** l'import des modules décorés.
- **Build SWC obligatoire** (décorateurs legacy + `emitDecoratorMetadata`). Le bot est empaqueté dans un container Docker et déployé sur **Google Cloud Run** en singleton.
- `src/_entry-imports.generated.ts` — **généré** (`scripts/gen-entry-imports.ts`), gitignored, **ne pas éditer** ; régénérer si on ajoute commande/event.
- `bun run build` re-symlinke `debug` pour `discord-html-transcripts` (`patch:dht`) — à relancer après chaque `bun install` (sinon crash runtime `Cannot find module 'debug'`).
- Lock PID singleton : refus de double instance = exit 11.
- `customId` Discord = contrat : ne pas renommer sans màj le handler `@ButtonComponent`/`@SelectMenuComponent` correspondant.

### Web — déploiement & build (lire `apps/web/AGENTS.md`)

- **Déploiement sur Vercel** : Le dashboard est directement déployé sur **Vercel** (`rpbey.vercel.app` / `rpbey.fr`).
- Pièges build : pas d'import runtime de `@rpbey/db` depuis un client component (fuite postgres → bundle) ; `transpilePackages: ["@vidstack/react"]` ; scraper challonge importé via `@/lib/challonge-vendor/scraper` (pas le barrel) ; `ignoreBuildErrors: false` (drift MUI X v9 résorbé → build type-check strict).
- **Migration serverless complète** : DB → **Neon** (`packages/db/src/client.ts` lit `DATABASE_URL` pooled, fallback socket) ; site → **Vercel** (projet `rpbey`, root `apps/web`, `vercel.json` + `build:vercel` = `next build --turbopack` sans `--env-file`) ; crons → **GitHub Actions** (`.github/workflows/cron-*.yml`) ; bot → **Cloud Run** (`rpbey-bot` europe-west3) ; gacha-server → **Cloud Run** (`rpbey-gacha` europe-west3) ; uploads → **Vercel Blob** (`upload-store.ts`, `BLOB_READ_WRITE_TOKEN`). ⚠️ **Patch `kysely@0.29.2`** (`patches/kysely@0.29.2.patch`) : le barrel `dist/index.js` omet `export * from './migration/migrator.js'` → `DEFAULT_MIGRATION_LOCK_TABLE`/`DEFAULT_MIGRATION_TABLE` absents au runtime (présents seulement dans les `.d.ts`), `@better-auth/kysely-adapter` les importe → Turbopack casse le build Vercel. NE PAS retirer le patch.
- **⚠️ Le gate de vérif DOIT inclure `next build`, pas seulement `tsc`** : un client component qui importe une façade `lib/*` ré-exportant un module server-only casse le bundle browser **sans que `tsc` le voie** (`tsc` valide les types, pas la frontière server/client du bundler). Cas réel : `TvFeed` → `lib/beytube` → `server/dal/stream`.
- **⚠️ `bun run build:web` local** : Si exécuté localement, peut provoquer des SegFault Bun. Sur Vercel, le build tourne sous Node runtime de manière stable. Pour le build local, le flip temporaire `typescript.ignoreBuildErrors: false → true` dans `apps/web/next.config.ts` peut être utilisé pour contourner le plantage de tsc interne.

## Style commits

Conventional en français, 1 ligne : `feat|fix|chore|refactor|docs(scope):`. Scopes fréquents : `bot`, `web`, `bridge`, `commands`, `cron`, `audit`, `e2e`, `db`. **Jamais** d'emoji, de `Co-Authored-By` ni de `Generated with…`.

## Tournois & classements (DB)

- **Tournois clés sur le slug** : `tournaments.challongeId` = `B_TS{n}` / `T_SS{n}`, row `id` = `bts{n}` / `tss{n}`. **Jamais** sur l'id numérique Challonge (`17261774`…) — cet ancien jeu était un doublon, **supprimé** le 2026-06-04 (backup `~/rpbey-legacy-bts-backup-*.json`). DB canonique = **Neon `rpbey-eu` Frankfurt** (l'ancien projet Oregon orphelin a été supprimé).
- **`tournament_participants` a `UNIQUE(tournamentId, challongeParticipantId)`** (ajoutée le 2026-06-04 — manquait ; seule `tournament_matches` l'avait). Son absence laissait `createMany(skipDuplicates)` réinsérer des copies `userId:null` = la corruption B_TS4. Tous les imports en dépendent.
- **Importer un tournoi** : skill **`tournament-import`** (`.claude/skills/tournament-import/`) → `scripts/tournament-workflow.ts` (`--meta` = annonce, `--scraped` = résultats, dup-safe, lie aux comptes sans en créer). Importeur BTS canonique : `apps/web/scripts/import-bts-tournaments.ts` (le legacy `import-bts-to-db.ts` est cassé — `../src/lib/prisma` supprimé). Source : `apps/web/data/exports/B_TS{n}.json`.
- **Recalcul classement** (pas de cron) : Stardust → `apps/web/scripts/sync-stardust-canon.ts` (match pondéré par phase : pool 250 / WB 1000 / LB 500 ; firstPlace 15000) ; BTS/global → `apps/web/scripts/recompute-rankings.ts` (`participation 500 + bonus placement + matchWin 1000 ×multiplicateur`). SATR/WB = imports externes séparés. Formules complètes + pipeline : **[`docs/ops-serverless-db-ranking.md`](docs/ops-serverless-db-ranking.md)**.
- **Challonge** : SPA derrière Cloudflare (`cf_clearance` lié à l'IP → curl/curl-impersonate = 403) ; l'endpoint `/module` est joignable via le vrai navigateur bxc (`window._initialStoreState.TournamentStore`).
- **Avatars Discord** : `scripts/refresh-discord-avatars.ts` recharge les avatars périmés (hash roté → 404) + re-sync `global_rankings.avatarUrl`.
