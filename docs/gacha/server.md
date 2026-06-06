---
title: "Serveur gacha — `apps/gacha-server` (Colyseus / Bun)"
description: "Serveur de jeu gacha Colyseus/Bun : REST économie, salle temps réel, CORS, hébergement Google Cloud Run."
scope:
  - apps/gacha-server
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - GachaRoom
  - mountRest
  - configureCors
  - handlers.ts
  - ranking.ts
---

# Serveur gacha — `apps/gacha-server` (Colyseus / Bun)

Serveur de jeu gacha : **REST économie** (consommée par le bot) + **temps réel** (Discord Activity). Recréé dans le monorepo (`apps/gacha-server`) depuis le contrat client `apps/bot/src/lib/gacha-api.ts`. Bâti sur **Colyseus 0.17** (transport `BunWebSockets`), backé par la DB partagée `@rpbey/db`.

> Historique : le serveur d'origine n'existait plus (ni VPS, ni GitHub, ni git history). Recréé end-to-end le 2026-05-29. Liens framework → [server-references.md](./server-references.md).

## Arborescence

| Fichier | Rôle |
| --- | --- |
| `src/index.ts` | `defineServer({ transport: BunWebSockets, rooms, express })` + `server.listen(PORT, HOST)`. JWT secret, `configureCors()`, /health, monitor/playground |
| `src/config.ts` | Constantes d'équilibre (alignées bot) + `HOST`/`PORT` + allowlist CORS (`isAllowedOrigin`) |
| `src/auth.ts` | `bearerToken(req)`, `resolveUser(token)` — valide la session Bearer (`sessions ⋈ users`, non expirée) |
| `src/cors.ts` | `configureCors()` — override du CORS permissif de Colyseus (cf. §CORS) |
| `src/http.ts` | `ApiError(code, message, status, retryInMs?)` → enveloppe `{ ok:false, error }` |
| `src/game.ts` | `cardDto()`, `rollRarity()` (tirage pondéré + soft-pity), `computeEffectiveRates()`, `srPlusBoostFactor()`, `legendaryShareInSrPlus()`, RNG injectable |
| `src/handlers.ts` | Tous les handlers économie (pull, daily, sell, gift, fusion, badges, leaderboard, adminGrant…) + helpers tx (`moveCurrency`, `addCard`, `resolvePull` pity SR+/legendary, `pickCard` pondéré wishlist, `getLegendaryPityCount`) |
| `src/ranking.ts` | Tiers MMR purs (`getTier`, `TIERS`, `percentile`, `applyDecay`, `tierProgress`) — sans DB, testable en isolation |
| `src/rest.ts` | `mountRest(app)` — routes express → handlers, wrapper `authed()` Bearer |
| `src/discord-token.ts` | `mountDiscordToken(app)` — `POST /discord_token` (OAuth Discord → session Bearer + JWT Colyseus) |
| `src/rooms/GachaRoom.ts` | `GachaRoom extends Room` — état `@colyseus/schema` synchronisé, `onAuth=JWT.verify`, messages pull/daily/balance |
| `test/smoke.ts` | Smoke auto-contenu (spawn serveur + session test + endpoints + CORS), `bun run smoke` |
| `test/concurrency.ts` | Test de concurrence du verrou `SELECT … FOR UPDATE` (8 pulls parallèles → pas d'overspend), `bun test/concurrency.ts` |
| `test/gacha-algorithms.test.ts` | Tests unitaires purs (31 cas) : distribution taux de base, soft-pity SR+/LEGENDARY, hard-pity, RNG injectable/déterministe, monotonie, tiers ranking, percentile, decay |
| `deploy/rpbey-gacha.service` | (Legacy) Unité systemd |
| `deploy/nginx-gacha.location.conf` | (Legacy) Snippet nginx `/gacha/` (WSS) |

## Endpoints REST (contrat = `gacha-api.ts`)

Auth = **Bearer** (table `sessions` partagée, mintée par le bot). Enveloppes exactes attendues par le client.

| HTTP | Handler | Note |
| --- | --- | --- |
| `POST /api/gacha/pull` | `pull` | coût **50** 🪙, pity, badge unlock |
| `POST /api/gacha/pull10` | `pullMulti` | coût **450**, ≥1 SR+ garanti |
| `POST /api/gacha/daily` | `daily` | streak, intérêts dette, paliers |
| `GET /api/gacha/balance` | `balance` | `{currency, dailyStreak, lastDaily, pityCount, userId}` |
| `GET /api/gacha/inventory/page` | `inventoryPage` | pagination curseur |
| `POST /api/gacha/sell` · `/sell-all` | `sell` · `sellAll` | vente doublons |
| `POST /api/gacha/gift` | `gift` | don (cooldown 12 h, doublon requis) |
| `GET/POST /api/gacha/wishlist[/toggle]` | `wishlist` · `wishlistToggle` | |
| `GET /api/gacha/history` | `history` | journal transactions |
| `GET /api/gacha/rates` | `rates` | taux + `pityThreshold`, `pitySrSoftStart`, `pityLegendaryThreshold` |
| `GET /api/gacha/cards/search` · `/cards/:id` | `searchCards` · `cardById` | |
| `GET /api/gacha/banners` | `banners` | |
| `GET/POST /api/gacha/badges[/claim]` | `badges` · `claimBadge` | paliers collection |
| `GET/POST /api/gacha/fusion[/preview]` | `fusionPreview` · `fuse` | 3 doublons → +1 rareté |
| `GET /api/leaderboard/:category` | `leaderboard` | currency/wins/mmr/collection — payload étendu : `rank`, `tier` (mmr), `percentile` (mmr) |
| `POST /api/admin/currency/grant` | `adminGrant` | admin only (`isAdmin`) |
| `GET /api/cards/:id/image.png` | redirect 302 | → rendu OG du web (`WEB_BASE/api/gacha/card?id=`) |
| `POST /discord_token` | `mintGachaSession` | OAuth Discord → session + JWT |

### Échange / duel async — RETIRÉS (commit `984b8e0`, 2026-05-30)

- `/api/trade/*` et `/api/duel/*` étaient des stubs **501** (`notImplemented`). `/gacha echange` appelait `tradePropose()` → échec systématique. Routes, helper `notImplemented` local, commande `echange` et méthodes client `trade*`/`duel*` supprimés. Réimplémentation DB-backed à faire post-teams (table `trade_proposals` + UI web).
- Les **duels fonctionnent** via la commande `/duel` (bot) en **DB directe** (`duel_matches`, façade Prisma) — n'ont jamais transité par ce serveur.

### Gaps connus (501 NOT_IMPLEMENTED)

- Rendus Skia (`/api/profile/:id/card.png`, `/api/inventory/:id/mosaic.png`, etc., consommés par `gacha-images.ts`) : non réimplémentés (le bot a un fallback embed-only). L'image carte redirige vers l'OG web.

## CORS

Colyseus pose un CORS **permissif** au niveau du serveur HTTP brut (`prependListener('request')` dans `@colyseus/core`, **avant** express) : `DEFAULT_CORS_HEADERS` avec `Access-Control-Allow-Origin: *` + credentials, et `getCorsHeaders()` reflète **n'importe quelle** origine. Un middleware express est court-circuité.

`src/cors.ts` `configureCors()` override `matchMaker.controller` :
- reflet de l'origine **uniquement** si autorisée — `isAllowedOrigin` : `*.discordsays.com`, `rpbey-*.vercel.app` (previews du projet uniquement), `rpbey.fr`/`www`/`bot`/`play`, `discord.com`, `localhost:3002`, + `GACHA_EXTRA_ORIGINS` (CSV) ;
- sinon → origine canonique fixe `https://rpbey.fr` (un navigateur tiers reçoit un ACAO ≠ son origine → bloqué).

## Déploiement (Cloud Run)

Le serveur gacha est hébergé en production sur **Google Cloud Run** (`rpbey-gacha`, région `europe-west3`) et communique avec le bot Discord via une URL cloud-to-cloud sécurisée.

- **Variables d'environnement** :
  - `DATABASE_URL` : Neon Postgres (pooled).
  - `AUTH_SECRET` / `BETTER_AUTH_SECRET` : Clé de validation des JWT Colyseus.
- **Port** : Écoute sur le port fourni par `$PORT` (8080 par défaut).
- **Bot** : Le bot consomme les API du serveur gacha en résolvant l'URL configurée dans `GACHA_API_URL` (pointant vers le service Cloud Run du gacha).
- **CORS** : Les origines autorisées incluent `rpbey.fr` (et ses variantes Vercel) ainsi que `*.discordsays.com` pour la Discord Activity.

## Vérif

`bun run smoke` (depuis `apps/gacha-server`) — spawn serveur + session test + boot/401/CORS/balance/rates/pull/badges/leaderboard. Test de concurrence du verrou : `bun test/concurrency.ts` (8 pulls parallèles → exactement 2 succès, jamais de solde négatif). Tests unitaires algorithmiques : `bun test test/gacha-algorithms.test.ts` (31 cas, sans DB). Gate : `bunx tsc --noEmit`, `bunx oxlint apps/gacha-server`, `bunx oxfmt --check`.
