# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

`@rose-griffon/bot` — Discord bot RPB (Bun + discordx + Prisma) tournant sur le VPS comme service systemd `rpb-bot.service` (port 3001, vhost `api.rpbey.fr`). Submodule `rpbey/rpb-bot` du monorepo `~/vps`. Voir `~/vps/CLAUDE.md` pour le contexte global VPS et `~/vps/state.md` pour l'état ops.

## Commandes

| But | Commande |
|---|---|
| Dev local hot-reload | `bun run dev` (== `bun --watch src/index.ts`) |
| Build prod | `bun run build` (lance prebuild → `swc -d dist src --strip-leading-paths`) |
| Type check | `bun run type-check` |
| Lint (rapide) | `bun run lint` (oxlint + plugin custom `rpb`) |
| Lint (complet) | `bun run lint:eslint` |
| Tests unitaires | `bun test` (preload `src/tests/setup.ts` via `bunfig.toml`) |
| Tests bridge Activity | `bun run test:bridge` (4 fichiers `test/*.test.ts`) |
| Test ciblé | `bun test test/<file>.test.ts` ou `bun test -t "<pattern>"` |
| Prisma client gen | `bun run db:generate` (sortie `src/generated/prisma/`) |
| Sync schéma depuis dashboard | `bun run schema:sync` (copie `prisma/schema.prisma` du dashboard) |
| Build standalone bin | `bun run build:bin` (utilise `_entry-imports.generated.ts`) |
| Deploy prod | CI/CD via Vercel/VPS orchestrator |

## Build pipeline (important)

**Le build utilise SWC, pas `bun build`.** Décorateurs legacy + `emitDecoratorMetadata` (DI tsyringe) ne sont pas supportés correctement par le transpileur Bun → SWC est obligatoire. Conséquence pour `n2b` : `bot/src/**` est marqué **non-rewritable** par la matrice n2b — pas de `Bun.$`, pas de réécritures TS-direct dans ce sous-arbre.

**Prebuild chain** (déclenchée auto par `bun run build`) :
1. `schema:sync` — copie `prisma/schema.prisma` depuis `apps/rpb-dashboard` (source de vérité unique).
2. `gen:entries` — `scripts/gen-entry-imports.ts` scanne `src/{events,commands,components}/**/*.ts` et écrit `src/_entry-imports.generated.ts` avec tous les imports side-effect statiques. Remplace le glob runtime de `@discordx/importer` afin que les decorated modules soient visibles par le bundler (`bun build --compile`). Fichier gitignored, importé par `src/index.ts`.
3. `patch:dht` — `scripts/patch-dht-debug.sh` symlink `debug` dans `discord-html-transcripts@3.3.0/node_modules/` (transitive non déclarée → casse Bun isolated linker). Idempotent, à re-run après chaque `bun install`.

## Architecture haut-niveau

### Bootstrap (`src/index.ts`)
1. `claimSingletonOrExit()` — lock PID dans `data/.bot.pid`, refuse de démarrer une 2e instance (exit 11).
2. `fetch.preconnect` vers Discord/Twitch/Challonge (try/catch — Bun canary throw "Invalid port").
3. `setupLogCapture()` puis `startApiServer(BOT_API_PORT ?? 3001)`.
4. `setupEventBridge()` — relaie events Discord → topics WebSocket pub/sub.
5. **DI** : `DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container)` AVANT l'import des modules décorés.
6. `await import('./_entry-imports.generated.js')` — charge tous les fichiers décorés.
7. `waitForSessions()` — vérifie `session_start_limit` Discord avant `bot.login()` (évite session burn).
8. Sur `clientReady` : `clearApplicationCommands()` + `initApplicationCommands()` + `setupCronJobs()`.
9. Cache `bot-settings` (ContentBlock Prisma, TTL 30s) pour maintenance mode + disabled commands.
10. **Fatal startup error → wait 60s avant `exit(1)`** pour éviter de cramer les sessions Discord en restart-loop.

### Layout `src/`
- `commands/{Admin,Beyblade,General}/` — slash commands discordx (`@Discord`, `@Slash`, `@SlashGroup`).
- `components/` — handlers boutons/modals (`@ButtonComponent`, `@ModalComponent`).
- `events/` — listeners Discord (`@On`, `@Once`).
- `cron/` — `index.ts` enregistre les tasks de `cron/tasks/*.ts` (RankingPost, LiveTournamentSync, MentionsScan, etc.).
- `lib/` — services injectés ou singletons :
  - `bot.ts` — `new Client({ intents, botGuilds, simpleCommand: { prefix: '!' } })`.
  - `prisma.ts` — `PrismaClient` via `@prisma/adapter-pg` (Neon, base `rpb` ; Postgres local décommissionné le 2026-05-14), client généré dans `src/generated/prisma/`.
  - `api-server.ts` — `Bun.serve` sur :3001 : REST `/api/*`, WebSocket pub/sub (topics `logs`, `bot-events`, `interactions`), bridge Discord Activity (`/api/discord/token-exchange`, `/api/discord/webhook/entitlement`), **fallback SPA `/play/*`** via `servePlayBundle()` qui lit `apps/gacha-client/dist/`.
  - `discord-activity.ts` — OAuth token-exchange Discord ↔ session interne gacha (`ensureGachaSession` mint un Bearer pour Colyseus :5050) + webhook IAP Ed25519 + idempotence créditation currency.
  - `event-bridge.ts` — wire Discord events vers `publishEvent(topic, payload)` du WS server.
  - `gacha-api.ts` — pont REST vers `apps/gacha` :5050 (sessions, mint Bearer).
  - `challonge.ts` + `challonge-sync.ts` + `scrapers/challonge-scraper.ts` — pipeline tournament.
  - `canvas/`, `meta-canvas.ts`, `gacha-images.ts` — rendu serveur via `@aphrody-code/canvas` (fork Skia).
  - `twitch-bot.ts` — client Twurple.
  - `redis.ts` — `Bun.RedisClient`.
  - `singleton-guard.ts`, `log-capture.ts`, `state.ts`, `secrets.ts`.
- `tests/` — tests unitaires (preload via bunfig).
- `_entry-imports.generated.ts` — **généré, ne pas éditer**.
- `generated/prisma/` — client Prisma, gitignored.

### Tests `test/`
4 fichiers de tests d'intégration bridge Activity : `discord-activity.test.ts`, `gacha-api.test.ts`, `api-server.test.ts`, `play-command.test.ts`. Lancer ensemble via `bun run test:bridge`.

## Pièges spécifiques (rappels denses)

- **`import type` casse tsyringe DI** : `Reflect.metadata("design:paramtypes")` perd l'info → `INJECTION_ERROR: TypeInfo not known for "Function"`. Toujours `import { Database }` (sans `type`) pour une classe injectée par constructeur.
- **`Bun.$` interdit dans `bot/src/**`** : compilé par SWC, pas par le transpileur Bun. Pareil pour les rewrites TS-direct (réf. matrice n2b dans `~/vps/CLAUDE.md`).
- **Ne pas committer `src/_entry-imports.generated.ts`** : gitignored, regénéré à chaque build.
- **Schéma Prisma** : `prisma/schema.prisma` est **synchronisé depuis `apps/rpb-dashboard`** — toute modif doit être faite côté dashboard puis re-sync. Le check est dispo via `bun run schema:check`.
- **`patch-dht-debug.sh` à re-lancer après `bun install`** : sinon `discord-html-transcripts` crash au runtime sur `Cannot find module 'debug'`.
- **Discord Webhook Events v1** : PING `type=0` → répondre `204 No Content` (pas `{type:1}` qui est l'envelope Interactions, sens inverse). 3 PING ratés = webhook désactivé par Discord. Code dans `discord-activity.ts`.
- **Singleton lock** : si le service refuse de démarrer (exit 11), vérifier `data/.bot.pid` avant restart.

## Style commits

Conventional `feat(scope):` / `fix(scope):` / `chore(scope):` en français, 1 ligne, pas d'emoji, pas de `Generated with…`. Scopes courants : `bot`, `bridge`, `activity`, `commands`, `cron`, `cms`.
