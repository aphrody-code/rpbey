---
title: "Gacha — Bot Discord (client du serveur `:5050`)"
description: "Client gacha du bot Discord : authentification Bearer, endpoints appelés, commandes /gacha /duel /jeu."
scope:
  - apps/bot
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - gacha-api.ts
  - gacha-images.ts
  - EconomyGroup.ts
  - DuelCommand.ts
  - ensureGachaSession
---

# Gacha — Bot Discord (client du serveur `:5050`)

Le bot (`apps/bot`, discordx + tsyringe) expose les commandes joueur. Pour le gacha « riche » (tirage, vente, fusion, badges) il est **client du serveur de jeu `:5050`** (`apps/gacha-server`, dans le monorepo — voir [server.md](./server.md)). Pour le reste (parier, donner, duel rapide, dette) il tape la DB en direct via la **façade Prisma**.

## Serveur gacha `:5050` — `apps/gacha-server`

- Base URL : `process.env.GACHA_API_URL ?? "http://127.0.0.1:5050"` (`gacha-api.ts:52`).
- Serveur de jeu **dans le monorepo** (`apps/gacha-server`, Colyseus 0.17 / Bun) : REST économie + temps réel Discord Activity. Détails serveur → [server.md](./server.md). Côté bot vivent le *client* (`gacha-api.ts`) et le pont d'images (`gacha-images.ts`).
- Partage la **même DB** que web/bot (lit/écrit `profiles.currency`, `card_inventory`, etc., s'authentifie via la table `sessions`).

### Authentification — sessions Bearer mintées par le bot (`gacha-api.ts`)

Le bot crée/réutilise une session Bearer par utilisateur Discord et la passe au serveur `:5050` :
- `SESSION_TTL_MS = 6 h` (`:53`), réutilisée si ≥ 30 min restantes (`SESSION_REUSE_MIN_REMAINING_MS`, `:54`).
- Pool pg direct (`DATABASE_URL`, max 3 conns, `:58-71`) — pas la façade Prisma.
- `upsertUser()` → `findReusableSession()` → sinon `mintSessionInternal()` (token `randomBytes(32).hex()`, insert `sessions`) ; `mintSession()` coalesce les mints concurrents ; `getSession()` = cache mémoire ; **`ensureGachaSession(discordId, name)`** = export public `{token, userId, expiresAt}`.
- Pont Discord Activity (OAuth code → session) : `apps/bot/src/lib/discord-activity.ts` + endpoints bot `/api/discord/*` (voir `api-server.ts`).

### Endpoints appelés (interface `GachaApiClient`, `gacha-api.ts:321-375`)

| Méthode client | HTTP | Coût | Note |
| --- | --- | --- | --- |
| `pull()` | POST `/api/gacha/pull` | **50** 🪙 | tirage ×1 → `PullResult` |
| `pullMulti()` | POST `/api/gacha/pull10` | **450** 🪙 | ×10 → `MultiPullResult` |
| `daily()` | POST `/api/gacha/daily` | — | streak, intérêts dette, tiers |
| `balance()` | GET `/api/gacha/balance` | — | `{currency, dailyStreak, pityCount}` |
| `inventory(opts)` | GET `/api/gacha/inventory/page` | — | pagination curseur |
| `sell(cardId)` / `sellAll()` | POST `/api/gacha/sell[-all]` | — | vente doublons |
| `gift(recipientId, cardId)` | POST `/api/gacha/gift` | — | don de carte |
| `wishlist()` / `wishlistToggle(id)` | GET/POST `/api/gacha/wishlist[/toggle]` | — | |
| `card(id)` / `searchCards(q)` | GET `/api/gacha/cards/{id}` / `…/search` | — | |
| `badges()` / `claimBadge()` | GET/POST `/api/gacha/badges[/claim]` | — | paliers collection |
| `fusionPreview()` / `fuse(id)` | GET/POST `/api/gacha/fusion[…]` | — | fusion de doublons |
| `leaderboard(cat, limit)` | GET `/api/leaderboard/{cat}` | — | cat ∈ currency/wins/mmr/collection |
| `adminGrant(userId, amount, note)` | POST `/api/admin/currency/grant` | — | admin |

Robustesse : timeout 15 s → `GachaApiError("TIMEOUT")` ; 502/503/504 → `SERVICE_UNAVAILABLE` ; `tryGachaClient()` renvoie `null` si down (dégradation gracieuse, le bot affiche un embed « service indispo »). Normalisation `balanceAfter` → `newBalance` (`normalizeBalanceFields`, `:446-458`).

### Pont images Skia — `gacha-images.ts` (~179 l)

Fetch PNG rendus par `:5050`, cache **ETag + buffer Redis** (TTL 1 h, clés `gacha:etag:{k}` / `gacha:buf:{k}`), réutilise via `If-None-Match` (304). Timeout 20 s, fallback `null` (embed-only). **État serveur recréé** : seul `/api/cards/:id/image.png` répond (redirect 302 → OG web) ; les rendus Skia profil/mosaïque/leaderboard/pity ne sont pas réimplémentés → le bot tombe sur le fallback embed-only. Fonctions :
- `fetchCardPng(cardId)` → `/api/cards/{id}/image.png`
- `fetchProfileCardPng(userId, bearer?)` → `/api/profile/{userId}/card.png`
- `fetchLeaderboardPng(cat)` → `/api/leaderboard/{cat}/image.png`
- `fetchBannerPromoPng(slug)` → `/api/banners/{slug}/promo.png`
- `fetchPityPng(cardId, bearer)` → `/api/cards/{cardId}/pity.png` (non caché)
- `fetchInventoryMosaicPng(userId, bearer?)` → `/api/inventory/{userId}/mosaic.png`

## Commandes bot

### `/gacha *` — `commands/General/EconomyGroup.ts` (~2015 l)

Groupe injectable (tsyringe), helper `api(interaction)` → client gacha. Constantes bot (`:33-64`) :
- `GACHA_COST = 50`, `MULTI_PULL_COST = 450`.
- `STREAK_BONUSES` : 3 j → +50 · 7 j → +150 · 14 j → +300 · 30 j → +750 🪙.
- `BADGES` (paliers collection) : 5→200 · 10→500 · 15→750 · 20→1000 · 25→1500 · 31→3000 🪙.
- `RARITY_CONFIG.sellPrice` : COMMON 5 · RARE 15 · SUPER_RARE 50 · LEGENDARY 150 · SECRET 500.
- `GIFT_COOLDOWN_MS = 12 h` ; dette : intérêts **15 %/jour** (`:102`).

Sous-commandes (FR) : `gacha` (×1), `multi` (×10), `daily`, `solde`, `collection`, `catalogue`, `voir`, `vendre`, `vendre-tout`, `wish`, `wishlist`, `donner` (Prisma direct, cooldown 12 h), `duel` (1v1 rapide — Prisma direct, pick cartes aléatoire), `parier` (quitte-ou-double — Prisma direct RNG), `dette`, `drop`, `aide`, `taux`, `classement`, `admin-give` (admin, ±1 M max). La plupart passent par `gacha-api` + `gacha-images` ; `donner`/`parier`/`duel`/`dette` tapent la DB en direct.

### `/duel *` — `commands/General/DuelCommand.ts` — TCG best-of-3 (async)

`duel combat @x [mise]` : Challenge 60 s → sélection 3 cartes 90 s → 3 rounds (3,5 s) → résultats. Min 3 cartes/joueur, mise 0-5000. Met à jour `duelWins/Losses/Streak/BestStreak/Rating(ELO)` + table `duelMatch`, rendu canvas `generateDuelArenaCard()`. Cooldown 3 min. Sous-cmd `stats`, `classement` (top 10 ELO), `historique`.

### `/jeu *` — `commands/General/GameGroup.ts` — combat Beyblade X

`jeu combat` (deck/combo vs adversaire, reward 15-200 🪙 + streak), `jeu aleatoire`, `jeu interaction`, `jeu wanted`, etc. Canvas via `canvas-utils.ts`.

### `/play` — `commands/General/PlayCommand.ts`

Invite à lancer la **Discord Activity** (deeplink si en vocal) ou fallback PWA (`play.rpbey.fr`).

## Partage économie bot ↔ web ↔ :5050

- **Une seule DB** (`@rpbey/db`). 3 accès parallèles : web (Drizzle), bot (Prisma façade + appels HTTP `:5050`), serveur `:5050` (`apps/gacha-server`, Drizzle).
- **API du bot** (`apps/bot` `Bun.serve` `:3001`, `BOT_API_KEY`) : le web l'appelle pour status/logs/commands (`/api/status`, `/api/bot/events` WS). Pont Discord Activity : `/api/discord/token-exchange` (OAuth → session gacha), `/api/discord/webhook/entitlement` (IAP → crédite `currency`, idempotence via note `iap:%`).
- **Écriture monnaie** : commandes gacha → `:5050` ; `parier`/`donner`/duel rapide → Prisma direct ; IAP → webhook bot. **Lecture web** : Drizzle direct.

## Constantes bot (récap, file:line)

| Const | Valeur | Fichier |
| --- | --- | --- |
| `GACHA_COST` | 50 | EconomyGroup:33 |
| `MULTI_PULL_COST` | 450 | EconomyGroup:34 |
| sellPrice C/R/SR/L/S | 5/15/50/150/500 | EconomyGroup:56-60 |
| `STREAK_BONUSES` | 3→50,7→150,14→300,30→750 | EconomyGroup:36-41 |
| `BADGES` | 5→200…31→3000 | EconomyGroup:43-50 |
| `GIFT_COOLDOWN_MS` | 12 h | EconomyGroup:64 |
| dette intérêts | 15 % | EconomyGroup:102 |
| `SESSION_TTL_MS` | 6 h | gacha-api:53 |
| `SESSION_REUSE_MIN_REMAINING_MS` | 30 min | gacha-api:54 |
| `BASE_URL` | `:5050` (`GACHA_API_URL`) | gacha-api:52 |
| `FETCH_TIMEOUT_MS` (images) | 20 s | gacha-images:24 |
| duel cooldown / sélection / round | 3 min / 90 s / 3,5 s | DuelCommand:64-67 |
| mise duel max | 5000 | DuelCommand |

> Le serveur `:5050` est désormais dans le repo (`apps/gacha-server`, cf. [server.md](./server.md)). Ce qui précède décrit le **côté client** (`gacha-api.ts`, `gacha-images.ts`, `discord-activity.ts`) ; le rendu Skia temps réel et la signature webhook restent non réimplémentés côté serveur.
