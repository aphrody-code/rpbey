---
title: "Gacha — Couche web (`apps/web`, Next.js `:3002`)"
description: "Routes API gacha Next.js (legacy + v1), DAL Drizzle, service, server actions et pages dashboard."
scope:
  - apps/web
status: "stable"
last_updated: "2026-05-30"
related_symbols:
  - executeCardPullTx
  - claimDailyTx
  - getApiUser
  - GachaCardsResponse
  - server/dal/gacha.ts
---

# Gacha — Couche web (`apps/web`, Next.js `:3002`)

Dashboard + API mobile. Accès DB direct via **Drizzle DAL** (`server/dal/gacha.ts`, server-only). Deux familles de routes :
- `/api/gacha/*` — **legacy**, authentifiées (session cookie OU Bearer mobile), lecture+mutation.
- `/api/v1/gacha/*` — **API-first**, publiques, validées par le contrat Zod (`@rpbey/api-contract`) → SDK `@rpbey/api-client`.

## Authentification — `getApiUser()` (`app/api/gacha/helpers.ts:10-24`)

1. Header `Authorization: Bearer <token>` → `findUserBySessionToken(token)` (résout via `sessions`, vérifie `expiresAt > now`).
2. Sinon cookie → `auth.api.getSession()` (better-auth).
Helpers : `unauthorized()` (401), `badRequest(msg)` (400), `serverError(e)` (500).

## Constantes gameplay (web) — `app/api/gacha/helpers.ts:41-68`

| Const | Valeur | |
| --- | --- | --- |
| `RARITY_WEIGHTS` | COMMON 60 · RARE 25 · SUPER_RARE 10 · LEGENDARY 4 · SECRET 1 | `rollCardRarity()` |
| `SINGLE_PULL_COST` | **100** | pull ×1 |
| `MULTI_PULL_COST` | **450** | pull ×5 (−10 %) |
| `MULTI_PULL_COUNT` | 5 | |
| `PITY_THRESHOLD` | 3 | garantie SR+ |
| `DAILY_BASE_AMOUNT` | 50 | |
| `DAILY_STREAK_BONUS` | 10 / jour | |
| `DAILY_MAX_BONUS` | 100 | total ≤ 150 |
| `DAILY_RESET_HOURS` | 48 | streak reset |
| `DUEL_REWARD` | 25 | `app/api/gacha/duel/route.ts:18` |

⚠️ Ces constantes sont **dupliquées** dans `server/actions/gacha.ts:69-84`.

## Routes `/api/gacha/*` (legacy)

| Route | Méthode | Auth | Entrée | Réponse | Appelle |
| --- | --- | --- | --- | --- | --- |
| `/api/gacha/pull` | POST | oui | — | `{success, cards, newBalance, pityCount}` | `executeCardPullTx` + `pickActiveCardByRarityTx` |
| `/api/gacha/multi` | POST | oui | — | idem (5 cartes, 1 SR+ garanti) | `executeCardPullTx` |
| `/api/gacha/daily` | POST | oui | — | `{success, amount, streak, newBalance}` | `claimDailyTx` |
| `/api/gacha/duel` | POST | oui | `{cardId}` | `{winner, playerCard, opponentCard, playerDamage, opponentDamage, elementAdvantage, reward}` | `getOwnedCard` + `getRandomActiveCard` + `awardDuelReward` |
| `/api/gacha/profile` | GET | oui | — | `{profile + user + cardCount}` | `getGachaProfile` |
| `/api/gacha/inventory` | GET | oui | — | `{cards, total}` | `getCardInventory` |
| `/api/gacha/wishlist` | GET / POST | oui | POST `{cardId, action?}` | liste / `{action}` | `getWishlistCards` / `addToWishlist` / `removeFromWishlist` |
| `/api/gacha/drops` | GET | public | — | `{drops}` | `listGachaDrops` |
| `/api/gacha/card` | GET | public | `?id=` ou `?slug=` | **image OG PNG 640×960** (Satori/next-og) | `getGachaCard` |
| `/api/game/inventory` | GET | oui | — | `{items, stats}` (pièces Beyblade) | `getPartInventory` + `determinePartRarity` |

### Carte OG (`app/api/gacha/card/route.tsx`)
Thème par rareté (couleurs/étoiles) : COMMON 1★ gris · RARE 2★ bleu · EPIC/SUPER_RARE 3★ violet · LEGENDARY 4★ ambre · SECRET 5★ rouge. Cache `max-age=3600, s-maxage=86400`.

## Routes `/api/v1/gacha/*` (API-first, publiques)

| Route | Query | Réponse (contrat) | Service |
| --- | --- | --- | --- |
| `/api/v1/gacha/cards` | `rarity? dropId? series? search? activeOnly? limit?(1-200)` | `GachaCardsResponse {cards, total}` | `getGachaCards` |
| `/api/v1/gacha/drops` | — | `GachaDropsResponse {drops}` | `getGachaDrops` |
| `/api/v1/gacha/leaderboard` | `limit?(1-200)` | `GachaLeaderboardResponse {entries}` | `getGachaLeaderboardEntries` |

## Service — `server/services/gacha.ts`

Orchestre la DAL et porte le **seam DAL↔SDK** (`isRemote`). N'expose que les **lectures publiques** : `getGachaCards`, `getGachaDrops`, `getGachaLeaderboardEntries`. En mode distant (`isRemote`), lit via le SDK généré (`@rpbey/api-client`) ; sinon chemin DAL local (VPS). Les mutations restent côté routes legacy/actions.

## DAL — `server/dal/gacha.ts` (~1043 l, server-only)

Fonctions clés (toutes les écritures sont transactionnelles) :

- **`executeCardPullTx({userId, rarities[], cost, type, newPityCount, pickFn, noteFor})`** — TX atomique : charge le profil → vérifie `currency ≥ cost` (sinon `INSUFFICIENT_FUNDS`) → `pickFn(tx, rarity)` par rareté (sinon `NO_CARDS`) → `UPDATE profiles SET currency -= cost, pityCount = newPityCount` → upsert `card_inventory` (count+1) → insert `currency_transactions`. Retourne `{cards, newBalance, pityCount}`.
- **`pickActiveCardByRarityTx(tx, rarity)`** — carte active aléatoire de cette rareté (COUNT puis OFFSET RANDOM), fallback toute carte active.
- **`claimDailyTx({userId, baseAmount, streakBonus, maxBonus, resetHours})`** — TX anti-race : compare `lastDaily` au jour UTC courant ; si déjà réclamé → `ALREADY_CLAIMED` ; sinon `newStreak = (hoursSince < resetHours) ? streak+1 : 1`, `bonus = min((streak-1)*streakBonus, maxBonus)`, `total = base + bonus` ; `UPDATE` conditionnel `lastDaily < startOfTodayIso` (garde-fou concurrence) + insert `DAILY_CLAIM`.
- **`awardDuelReward(userId, reward, note)`** — ⚠️ hors TX : `UPDATE profiles currency += reward` + insert transaction.
- **`getProfilePityCount(userId)`** — lit `pityCount` (utilisé hors-tx par la route pull → race possible).
- Lectures : `listGachaCards`, `getGachaCard`, `listGachaDrops`, `listGachaDropOptions`, `getGachaProfile`, `getGachaDashboardProfile`, `getProfileCurrency`, `getCardInventory`, `getDashboardCardInventory` (pagination curseur sur `obtainedAt`), `getWishlistCardIds/Cards`, `getProfileIdByUser`, `getGachaLeaderboard(limit=100)`, `listCurrencyTransactions`, `getOwnedCard`, `getRandomActiveCard`, `findUserBySessionToken`.
- **Système « parts » (Beyblade X)** : `getPartsForLine(line)` (filtre `PART_TYPES = [BLADE, OVER_BLADE, RATCHET, BIT, LOCK_CHIP, ASSIST_BLADE]`), `executePartPullTx(...)` (TX identique au pull cartes mais sur `part_inventory`).

## Server actions — `server/actions/gacha.ts` (~495 l)

Actions pour le **pull de pièces** (parts Beyblade X), distinct du pull de cartes :
- `pullBooster(line)` → ×1 (`SINGLE_PULL_COST`), `pullMulti(line)` → ×5 (`MULTI_PULL_COST`, 1 EPIC+ garanti), `claimDaily()`, `getInventory()`, `getUserCurrency()`.
- Logique interne : `determinePartRarity()` (rareté par poids/stats selon le type de pièce — barèmes détaillés `actions/gacha.ts:106-199`), `rollRarity()`, `selectPartByRarity()`, `executePull()` → `executePartPullTx()`.

## Contrat Zod — `packages/api-contract/src/gacha.ts`

`GachaRaritySchema` (enum) · `GachaCardSchema` · `GachaCardsQuerySchema` / `…ResponseSchema` · `GachaDropSchema` / `…ResponseSchema` · `GachaLeaderboardEntrySchema` (`rank, userId, name, image, currency, duelWins, duelRating, cardCount`) / `…QuerySchema` / `…ResponseSchema`. Source unique route + OpenAPI + SDK.

## Pages dashboard — `app/dashboard/gacha/**`

| Page | Composant | Contenu |
| --- | --- | --- |
| `/dashboard/gacha` | `GachaProfileCard` | stats profil (currency, streak, pity, wins, cardCount) |
| `/dashboard/gacha/inventory` | `InventoryClient` | pagination curseur (PAGE_SIZE 24), filtres rarity/dropId, wishlist |
| `/dashboard/gacha/leaderboard` | `LeaderboardClient` | top 100 (currency/duelWins/duelRating/cardCount), revalidate 60 s |
| `/dashboard/gacha/history` | `HistoryClient` | transactions (limit 100), filtre par type |

Layout `layout.tsx` : onglets Profil / Inventaire / Classement / Historique.

## Flux — pull carte (web)

```
POST /api/gacha/pull
 → getApiUser()
 → getProfilePityCount()            # hors TX (⚠ race)
 → rollCardRarity()                 # 60/25/10/4/1
 → pity: newPity = pity+1 ; si ≥3 et pas SR+ → force SUPER_RARE, reset ; si SR+ → reset
 → executeCardPullTx({cost:100, type:GACHA_PULL, newPityCount, pickFn})  # TX
     vérifie solde → pick carte(s) → débite 100 → upsert inventory → log tx
 → { success, cards, newBalance, pityCount }
```

## Flux — daily (web)

```
POST /api/gacha/daily → claimDailyTx({base:50, streakBonus:10, maxBonus:100, resetHours:48})
 jour UTC déjà réclamé ? → ALREADY_CLAIMED
 sinon streak (reset si >48 h) → bonus = min((streak-1)*10, 100) → +(50+bonus) → log DAILY_CLAIM
```

## Flux — duel (web)

```
POST /api/gacha/duel {cardId}
 getOwnedCard() → getRandomActiveCard()
 dmg = att*0.35 + def*0.25 + end*0.25 + equilibre*0.15
 avantage élément (FEU>VENT>TERRE>EAU>FEU, LUMIERE↔OMBRE) → ×1.25
 ±15 % aléatoire → vainqueur
 si joueur gagne → awardDuelReward(+25)   # ⚠ hors TX
```
