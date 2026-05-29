# Gacha — Base de données

Toutes les tables vivent dans **`@rpbey/db`** (`packages/db/src/schema.ts` + `relations.ts`), Postgres `rpb_neon`. Source de vérité unique du schéma : toute évolution passe par ce package.

## Invariant timestamp (⚠️ source #1 de bugs)

Les colonnes gacha/économie sont **toutes** en `mode:"string"` (string ISO) — contrairement aux tables **auth** (`users/sessions/accounts/verifications/twoFactors`) qui sont en `mode:"date"` (objet `Date`).

- Écrire une colonne gacha → `new Date().toISOString()`.
- Lire pour afficher → wrapper `new Date(x)` avant `.toLocaleDateString()` / `.getTime()`.
- Mauvais type → `TypeError: x.toISOString is not a function`.

En cas de doute : `bun -e "import{schema}from'@rpbey/db';console.log(schema.<table>.<col>.columnType)"`.

## Enums

| Enum | Fichier | Valeurs |
| --- | --- | --- |
| `cardRarity` | `schema.ts:21-27` | `COMMON` · `RARE` · `SUPER_RARE` · `LEGENDARY` · `SECRET` |
| `cardType` | `schema.ts:28` | `PNG` · `ARTIST` |
| `transactionType` | `schema.ts:71-82` | `DAILY_CLAIM` · `GACHA_PULL` · `ADMIN_GIVE` · `ADMIN_TAKE` · `TOURNAMENT_REWARD` · `SELL_CARD` · `STREAK_BONUS` · `MULTI_PULL` · `BADGE_REWARD` · `DUEL_REWARD` |
| `beyType` | `schema.ts:20` | `ATTACK` · `DEFENSE` · `STAMINA` · `BALANCE` (combat, hors gacha pur) |

> Note : `element` (`gacha_cards.element`) et `cardType` n'ont pas tous d'enum pg strict — `element` est `text` default `NEUTRAL` ; valeurs gameplay utilisées : `FEU, VENT, TERRE, EAU, LUMIERE, OMBRE, NEUTRAL` (cf. duel, [rules.md](./rules.md)).

## Tables

### `gacha_cards` — cartes (catalogue) — `schema.ts:608-654`

| Colonne | Type | Null/Default | Notes |
| --- | --- | --- | --- |
| `id` | text PK | `createId()` | |
| `slug` | text | — | **unique** (`gacha_cards_slug_key`) |
| `name` / `nameJp` | text | nameJp nullable | |
| `series` | text | — | **index** |
| `rarity` | `cardRarity` | `COMMON` | **index** |
| `imageUrl` / `beyblade` / `description` | text | nullable | |
| `dropRate` | doublePrecision | `0` | poids/taux propre carte |
| `isActive` | boolean | `true` | seules les actives sont tirables |
| `att` / `def` / `end` / `equilibre` | integer | `0` | stats duel |
| `element` | text | `NEUTRAL` | |
| `specialMove` / `artistName` | text | nullable | dessinateur = `artistName` |
| `cardType` | `cardType` | `PNG` | `PNG` ou `ARTIST` |
| `dropId` | text | nullable | **FK → `gacha_drops.id`** (set null on delete) |
| `createdAt` / `updatedAt` | timestamp `string` | now | |

Index : `dropId`, `rarity`, `series`, `slug`(unique).

### `gacha_drops` — bannières / saisons — `schema.ts:883-913`

| Colonne | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | text PK | `createId()` | |
| `slug` | text | — | **unique**, index |
| `name` / `theme` | text | — | |
| `season` | integer | `1` | |
| `maxCards` | integer | `32` | |
| `startDate` / `endDate` | timestamp `string` | — | fenêtre de la bannière |
| `isActive` | boolean | `false` | **index** |
| `imageUrl` | text | nullable | |
| `createdAt` / `updatedAt` | timestamp `string` | now | |

### `card_inventory` — collection joueur — `schema.ts:194-233`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `userId` | text | **FK → users.id** (cascade), index |
| `cardId` | text | **FK → gacha_cards.id** (cascade) |
| `count` | integer (def `1`) | quantité (doublons) |
| `obtainedAt` | timestamp `string` | |

Unique : `(userId, cardId)` — un row par couple, `count` incrémenté.

### `card_wishlists` — souhaits — `schema.ts:265-303`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `profileId` | text | **FK → profiles.id** (cascade), index |
| `cardId` | text | **FK → gacha_cards.id** (cascade) |
| `createdAt` | timestamp `string` | |

Unique : `(profileId, cardId)`. ⚠️ clé = **profileId** (pas userId).

### `gacha_friendships` — amis — `schema.ts:980-1005`

PK composite `(userId, friendId)`, les deux **FK → users.id**. `status` text (def `pending`). `createdAt`/`updatedAt` string. *Aucune route web ne l'utilise (réservé / `:5050`).*

### `gacha_announcements` — annonces — `schema.ts:484-494`

`id` PK, `authorId`, `severity` (def `info`), `title`, `body`, `pinned` (def false), `publishedAt`, `expiresAt?`, `createdAt`. Pas d'index/FK.

### `gacha_audit_log` — audit — `schema.ts:1550-1558`

`id` PK, `userId?`, `action`, `payload` jsonb, `ip?`, `userAgent?`, `createdAt`. *Jamais écrite par la DAL web (table morte côté web).*

### `currency_transactions` — journal monnaie — `schema.ts:338-373`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `userId` | text | **FK → users.id**, index |
| `amount` | integer | signé (+gain / −coût) |
| `type` | `transactionType` | voir enum |
| `note` | text? | ex. `iap:discord:sku=…` |
| `createdAt` | timestamp `string` | index |

Index : `userId`, `createdAt`, + unique partiel `currency_transactions_iap_note_uniq` (`where note like 'iap:%'`) → idempotence des achats in-app.

### `profiles` — colonnes économie/gacha — `schema.ts:823-881`

| Colonne | Type | Default | Rôle |
| --- | --- | --- | --- |
| `currency` | integer | `0` | **BeyCoins** (peut être **négatif** = dette) |
| `lastDaily` | timestamp `string` | nullable | dernier claim quotidien |
| `dailyStreak` | integer | `0` | jours consécutifs |
| `lastGiftSent` | timestamp `string` | nullable | cooldown don |
| `pityCount` | integer | `0` | compteur pity gacha |
| `duelWins` / `duelLosses` | integer | `0` | duels |
| `duelStreak` / `duelBestStreak` | integer | `0` | séries |
| `duelRating` | integer | `1000` | ELO duel, **index** (`profiles_duelRating_idx`) |

(+ colonnes non-gacha : wins, losses, tournamentWins, rankingPoints, experience, bladerName, bio, réseaux…)

## Relations (`relations.ts`)

- `gachaCards` → `many(cardInventory)`, `many(cardWishlists)`, `one(gachaDrops)` via dropId.
- `cardInventory` → `one(gachaCards)`, `one(users)`.
- `cardWishlists` → `one(gachaCards)`, `one(profiles)`.
- `gachaFriendships` → `one(users)` ×2 (userId, friendId).
- `currencyTransactions` → `one(users)`.
- `profiles` → `many(cardWishlists)`, `one(users)`.
