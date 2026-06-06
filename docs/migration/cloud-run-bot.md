---
title: "Migration Bot — apps/bot → Google Cloud Run (LIVE)"
description: "Bot Discord @rose-griffon/bot (discordx + discord.js gateway, build SWC) déployé sur Google Cloud Run, projet aphrody, région europe-west3 (Frankfurt). 100 % serverless : zéro Redis (mentions/scan-meta rebackés Postgres Neon, cache + pub/sub in-process), singleton min=1/max=1 no-cpu-throttling pour la gateway persistante, secrets via Secret Manager. Caveat voix/lavalink (UDP)."
scope:
  - apps/bot
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - Dockerfile
  - rpbey-bot
  - DATABASE_URL
  - DISCORD_TOKEN
---

# Migration Bot — apps/bot → Google Cloud Run (LIVE)

## État : DÉPLOYÉ ✅ (2026-06-04)

| Élément | Valeur |
| --- | --- |
| Projet GCP | **`aphrody`** (facturation activée) |
| Région | **`europe-west3`** (Frankfurt — co-localisé avec la base Neon Frankfurt, ~1 ms bot↔DB) |
| Service Cloud Run | `rpbey-bot` |
| URL | `https://rpbey-bot-468000409790.europe-west3.run.app` |
| Image | `europe-west3-docker.pkg.dev/aphrody/rpbey/rpbey-bot` |
| Statut | `Ready=True`, gateway `Logged in as RPBey#5070`, 44 slash commands enregistrées |

## Cible

| Élément | Avant (VPS) | Après (Cloud Run) |
| --- | --- | --- |
| Hébergement | systemd `rpb-bot.service` (failed) | **Cloud Run** `rpbey-bot`, projet `aphrody`, `europe-west3` |
| Modèle | process long-running | container **persistant** : `--min-instances 1 --max-instances 1 --no-cpu-throttling` (gateway WS permanente, pas request/response) |
| Build | SWC local → `dist/` | image Docker (base `ubuntu:26.04` + Bun) via Cloud Build (contexte = racine monorepo) |
| DB | socket local | `DATABASE_URL` (Neon **pooled** Frankfurt) via `--set-secrets` |
| État partagé | **Redis** (mentions, cache, pub/sub) | **supprimé** — Postgres + in-process (cf. §Serverless) |
| API REST | `Bun.serve` :3001 | port `$PORT` (8080) — bind `0.0.0.0` quand `K_SERVICE` est défini |
| Secrets | `apps/bot/.env` | **GCP Secret Manager**, injectés via `--set-secrets` |

## Serverless — élimination totale de Redis

Sur Cloud Run le bot tourne en **singleton** (min=1/max=1) : une seule instance,
donc aucun besoin d'un store partagé inter-process. Redis a été **entièrement retiré** :

- **`src/lib/redis.ts`** — le compteur de mentions (`rpb:mentions`) et la méta de
  scan (`rpb:mentions:meta`) sont **rebackés en Postgres Neon** via `@rpbey/db`
  (tables `bot_mentions(from_id, to_id, count)` + `bot_scan_meta(k, v)`). Mêmes
  signatures exportées (`getMentions/incrMentions/setMentions/getAllMentions/
  clearMentions/setScanMeta/getScanMeta`) → `MentionsScan.ts`, `RpbeyMention.ts`,
  `GameGroup.ts` inchangés. `incrMentions` = upsert `count = count + n`. Le module
  exporte aussi un **client Redis-compatible in-process** (Map + TTL + EventEmitter)
  pour les autres usages (`send/get/set/setex/del/hset/publish/subscribe/duplicate`)
  → `cache.ts`, `events-pubsub.ts`, `config-service.ts`, `persona.ts` inchangés.
  Plus aucune dépendance à `REDIS_URL`.
- **`src/lib/cache.ts`** — cache mémoire `Map` + TTL (balayage périodique `unref()`).
- **`src/lib/events-pubsub.ts`** — `EventEmitter` in-process (mêmes signatures
  `publishEvent`, + `subscribeEvent`).

Migration Drizzle : `packages/db/drizzle/0007_bot_serverless_state.sql` (idempotent,
`CREATE TABLE IF NOT EXISTS` — les autres tables préexistent dans la base Frankfurt).
Appliquée sur le projet Neon `rpbey-eu` (`shiny-sunset-55093016`).

## Caveat voix / lavalink (IMPORTANT)

Cloud Run **ne route pas l'UDP** (ni entrant ni sortant fiable) : le voice gateway
Discord utilise RTP/UDP. **La musique / le voice est non fonctionnel** sur Cloud Run.
La gateway (events, slash commands, REST, gacha, tournois, canvas) fonctionne
normalement (tout est WS/HTTP sortant). Si le voice redevient critique, garder ce
sous-système sur une VM dédiée. La migration vise gateway + slash commands.

## Secrets (Secret Manager, projet `aphrody`)

`DISCORD_TOKEN`, `DATABASE_URL` (Neon **pooled** Frankfurt), `DIRECT_DATABASE_URL`,
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`,
`DISCORD_GUILD_ID`, `GUILD_ID`, `BOT_API_KEY`, `BETTER_AUTH_SECRET`,
`CHALLONGE_API_KEY`. La SA runtime Cloud Run (`<projectNumber>-compute@…`) a
`roles/secretmanager.secretAccessor` sur chacun. **Plus de `REDIS_*`** (serverless).

## Gotchas vérifiés au déploiement (mémoire institutionnelle)

1. **glibc 2.43** — le binaire natif Skia de `@aphrody/canvas-linux-x64-gnu@0.1.99`
   est compilé contre `GLIBC_2.43` (host de build = VPS Ubuntu 26.04). Base
   `oven/bun` (Debian, glibc 2.36/2.41) → crash runtime
   « `libm.so.6: version GLIBC_2.43 not found` » → Fatal Startup. **Fix : base
   `ubuntu:26.04` + Bun installé via le script officiel** (tag `canary` pour matcher
   le lockfile VPS) + libs `libfontconfig1`/`libfreetype6`.
2. **dist prébuildé des forks discordx** — `packages/discordx/.gitignore` ignore
   `dist/`. `gcloud builds submit` respecte `.gitignore` (et les imbriqués) → le
   `dist/` de `@rpbey/di`, `@rpbey/discordx`, … (prébuildés, NON rebuildés par
   `bun install`) n'était pas uploadé → runtime « Cannot find module '@rpbey/di' ».
   **Fix : `.gcloudignore` racine** (gcloud l'utilise SEUL, n'enchaîne plus sur les
   `.gitignore`) qui conserve `packages/**` (dist inclus) + **`.dockerignore`** qui
   exclut `apps/*/dist` mais PAS `packages/discordx/**/dist` (jamais de `**/dist` global).
3. **Alias tsconfig `@aphrody/x`** — `tsconfig.json` mappe `@aphrody/x` →
   `./types/aphrody-x/index.d.ts` (pour le typecheck : le paquet ship du TS brut).
   Mais **Bun applique les `paths` du tsconfig AUSSI à l'exécution** → il chargeait
   le `.d.ts` (qui `import "./core/session"` sans `.js`) → « Cannot find module
   './core/session' ». **Fix : le Dockerfile retire `compilerOptions.paths` du
   tsconfig de l'image** (post-build) → Bun résout `@aphrody/x` depuis
   `node_modules/@aphrody/x` (`exports "." → ./src/index.ts`). Le tsconfig dev garde
   l'alias (typecheck = 0).
4. **lockfile v2 / Bun canary** — `bun.lock` (v2) écrit par Bun 1.4.0 stable ;
   l'image Bun canary re-résout quelques transitives → `--frozen-lockfile` échoue.
   **Fix : `bun install` (sans `--frozen-lockfile`)** dans l'image — bun.lock reste la
   base de résolution, le delta mineur est réconcilié déterministiquement.
5. **puppeteer postinstall** — dep d'`apps/web` (pas du bot) télécharge Chrome et
   échoue. **Fix : `PUPPETEER_SKIP_DOWNLOAD=true`** dans le stage deps.
6. **patches/** — `package.json#patchedDependencies` (kysely) → copier `patches/`
   avant `bun install`.

## Déploiement (manuel)

```bash
GH_TOK=$(gh auth token)
TAG=$(git rev-parse --short=8 HEAD)
IMAGE="europe-west3-docker.pkg.dev/aphrody/rpbey/rpbey-bot:$TAG"

# (a) Artifact Registry (idempotent)
gcloud artifacts repositories create rpbey --project aphrody \
  --location europe-west3 --repository-format docker || true

# (b) Build (Cloud Build, contexte racine)
gcloud builds submit --project aphrody --region europe-west3 \
  --config apps/bot/cloudbuild.yaml \
  --substitutions="_IMAGE=$IMAGE,_GH_PACKAGES_TOKEN=$GH_TOK" .

# (c) Deploy
gcloud run deploy rpbey-bot --project aphrody --region europe-west3 \
  --image "$IMAGE" --min-instances 1 --max-instances 1 --no-cpu-throttling \
  --cpu 1 --memory 1Gi --port 8080 --no-allow-unauthenticated \
  --set-secrets "DISCORD_TOKEN=DISCORD_TOKEN:latest,DATABASE_URL=DATABASE_URL:latest,..."
```

Le workflow `.github/workflows/deploy-bot.yml` exécute (a)+(b)+(c) automatiquement
sur push `apps/bot/**` / `packages/**` (auth SA `GCP_SA_KEY`, token GH Packages
`GH_PACKAGES_TOKEN`).

## Vérification

```bash
gcloud run services describe rpbey-bot --project aphrody --region europe-west3 \
  --format='value(status.url,status.conditions[0].status)'   # → URL, True
gcloud logging read 'resource.type="cloud_run_revision" AND
  resource.labels.service_name="rpbey-bot"' --project aphrody --limit 50 \
  --format='value(textPayload)'    # → "Logged in as RPBey#5070 — 44 commands"
```

Preuve live : `[Bot] Logged in as RPBey#5070 — 44 commands registered.`,
`Connecté en tant que : RPBey#5070`, crons schedulés, **aucune erreur Redis**,
Postgres Frankfurt connecté (ConfigService + sync commands = lectures DB OK).
