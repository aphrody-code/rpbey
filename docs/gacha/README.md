---
title: "Système Gacha — RPBey"
description: "Documentation canonique du gacha TCG Beyblade : trois surfaces web, bot, serveur sur une DB partagée."
scope:
  - apps/gacha-server
  - apps/web
status: "stable"
last_updated: "2026-06-02"
related_symbols:
  - gacha_cards
  - card_inventory
  - currency_transactions
  - GachaRoom
  - gacha-api.ts
---

# Système Gacha — RPBey

Documentation canonique et complète du **gacha TCG Beyblade** de la République Populaire du Beyblade.

> Source de vérité du code : les `file:line` cités. Ce doc est descriptif — en cas de divergence, le code gagne. Pensez à le mettre à jour quand vous touchez le gacha.

## Sommaire

| Doc | Contenu |
| --- | --- |
| [database.md](./database.md) | Tables `@rpbey/db`, colonnes, enums, invariant timestamp |
| [web.md](./web.md) | `apps/web` — routes `/api/gacha` + `/api/v1/gacha`, service, DAL, actions, contrat, pages dashboard |
| [server.md](./server.md) | `apps/gacha-server` — serveur de jeu `:5050` (Colyseus/Bun) : REST économie, CORS, déploiement, gaps |
| [bot.md](./bot.md) | `apps/bot` — client `gacha-api.ts` du serveur `:5050`, commandes `/gacha` `/duel` `/jeu`, canvas |
| [rules.md](./rules.md) | Mécaniques : raretés, taux, pity, daily/streak, duel, économie/dette, badges, fusion + roster bannière 1 |
| [assets-pipeline.md](./assets-pipeline.md) | Pipeline catalogue (scrape → optim → classif → montage template → post Discord) |
| [server-references.md](./server-references.md) | Liens Colyseus / Discord Activity / PixiJS + notes d'intégration |

## Vue d'ensemble

Le gacha est un jeu de cartes communautaire (thème Beyblade : *Metal Fusion / Bakuten Shoot / Burst*). Il existe **trois surfaces** qui partagent **le même Postgres** (`@rpbey/db`, base `rpb_neon`, socket `/var/run/postgresql`) :

```
                         ┌─────────────────────────────┐
                         │   Postgres partagé rpb_neon  │
                         │  users · sessions · profiles │
                         │  gacha_cards · gacha_drops    │
                         │  card_inventory · card_wishlists
                         │  currency_transactions · …    │
                         └──────────────┬──────────────┘
            ┌───────────────────────────┼───────────────────────────┐
            │ Drizzle (DAL)             │ Drizzle (sessions⋈users)   │ façade Prisma
   ┌────────┴─────────┐      ┌──────────┴──────────┐       ┌─────────┴──────────┐
   │ apps/web  :3002  │      │ apps/gacha-server   │       │ apps/bot           │
   │ Next.js dashboard│      │ :5050 (Colyseus/Bun)│◄──────┤ slash commands     │
   │ /api/gacha/*     │      │  Discord Activity / │ Bearer│ /gacha /duel /jeu  │
   │ /api/v1/gacha/*  │      │  jeu temps réel     │ HTTP  │ gacha-api.ts client│
   │ mobile (Bearer)  │      │ /api/gacha/pull …   │ loop  │ + Prisma direct    │
   └──────────────────┘      └─────────────────────┘       └────────────────────┘
```

### Les 3 surfaces (à ne PAS confondre)

1. **`apps/web` (Next.js, `:3002`)** — dashboard web + API mobile (Bearer). Routes `/api/gacha/*` (legacy, authentifiées) et `/api/v1/gacha/*` (publiques, contrat Zod → SDK). Accès DB direct via **Drizzle DAL** (`server/dal/gacha.ts`). Coût pull simple = **100**. Voir [web.md](./web.md).
2. **Serveur gacha `:5050` — `apps/gacha-server`** — service de jeu **dans le monorepo** (Colyseus 0.17 sur Bun, transport `BunWebSockets`) : REST économie + temps réel Discord Activity. Le bot en est le **client** via `apps/bot/src/lib/gacha-api.ts` (`GACHA_API_URL`, défaut `http://127.0.0.1:5050`). Endpoints `/api/gacha/pull` (coût **50**), `/api/gacha/pull10`, `/api/gacha/sell`, `/api/gacha/fusion`, badges, leaderboard… Auth = **sessions Bearer mintées par le bot** dans la table `sessions` partagée (validées via Drizzle `sessions ⋈ users`). systemd loopback + nginx `/gacha/` (WSS). Voir [server.md](./server.md).
3. **`apps/bot` (Discord)** — slash commands `/gacha *`, `/duel`, `/jeu`, `/play`. Appelle le serveur `:5050` (gacha-api) **ou** tape la DB en direct (façade Prisma) pour `parier`, `donner`, duel rapide, dette. Voir [bot.md](./bot.md).

### Divergence assumée — deux économies

⚠️ **`/api/gacha/pull` existe sur DEUX serveurs avec des coûts différents** :
- web `:3002` → **100** 🪙 (`apps/web/src/app/api/gacha/helpers.ts:61`)
- serveur `:5050` → **50** 🪙 (`apps/gacha-server/src/config.ts:69`, `PULL_COST` — source serveur faisant autorité ; valeur miroir affichée par le bot en `EconomyGroup.ts:33`)

Ce sont des chemins identiques sur des services distincts. Les deux écrivent `profiles.currency` / `currency_transactions` dans la **même DB**. C'est la principale source de confusion du système — toujours préciser **quelle surface** on touche.

## Fichiers clés (index rapide)

| Zone | Fichier |
| --- | --- |
| Schéma DB | `packages/db/src/schema.ts`, `relations.ts` |
| Web routes legacy | `apps/web/src/app/api/gacha/{pull,multi,daily,duel,inventory,profile,drops,wishlist,card}/…` |
| Web routes v1 | `apps/web/src/app/api/v1/gacha/{cards,drops,leaderboard}/route.ts` |
| Web service / DAL | `apps/web/src/server/services/gacha.ts`, `apps/web/src/server/dal/gacha.ts` |
| Web actions (parts) | `apps/web/src/server/actions/gacha.ts` |
| Web constantes | `apps/web/src/app/api/gacha/helpers.ts` |
| Contrat Zod | `packages/api-contract/src/gacha.ts` |
| Serveur :5050 | `apps/gacha-server/src/{index,handlers,rest,cors,auth,config,discord-token,game,http}.ts`, `rooms/GachaRoom.ts` |
| Serveur déploiement | `apps/gacha-server/deploy/{rpbey-gacha.service,nginx-gacha.location.conf}` |
| Bot client :5050 | `apps/bot/src/lib/gacha-api.ts` |
| Bot images (Skia) | `apps/bot/src/lib/gacha-images.ts` |
| Bot commandes | `apps/bot/src/commands/General/{EconomyGroup,DuelCommand,GameGroup,PlayCommand}.ts` |
| Pipeline catalogue | `apps/bot/scripts/{scrape-channel,optimize-images,build-gacha-json,render-cards,post-gacha}.ts` |

## Pièges & dette connue

- **Coût pull divergent 50 vs 100** entre `:5050` et web (cf. ci-dessus).
- **Constantes dupliquées** : `RARITY_WEIGHTS` / `SINGLE_PULL_COST` / `PITY_THRESHOLD` / `DAILY_*` existent en double (`apps/web/src/app/api/gacha/helpers.ts` **et** `apps/web/src/server/actions/gacha.ts`). Un changement = 2+ endroits.
- **Pity lue hors transaction** : `apps/web/src/app/api/gacha/pull/route.ts:30` lit `getProfilePityCount()` avant le `executeCardPullTx` → 2 pulls concurrents peuvent sauter le compteur.
- **`awardDuelReward` hors transaction** (`dal/gacha.ts`) : duel calculé puis récompense non atomique.
- **`gacha_audit_log` jamais écrite** par la DAL web (table morte côté web).
- **`gacha_friendships`** : table présente, aucune route web (réservée / gérée côté `:5050`).
- **Validation Zod absente** sur les routes web legacy `/api/gacha/{pull,multi,duel,wishlist}` (entrées non validées).
- **Échange async retiré** (commit `984b8e0`, 2026-05-30) : `/api/trade/*` + `/api/duel/*` étaient des stubs **501**, et `/gacha echange` (qui appelait `tradePropose()`) échouait donc à 100 %. Routes REST, commande `echange` et méthodes client `trade*`/`duel*` (gacha-api.ts) supprimées. Les duels restent intacts (commande `/duel`, **DB directe** `duel_matches`, jamais le serveur `:5050`). Réimplémentation DB-backed (table `trade_proposals` + UI web accept/refuse) à faire post-teams. Cf. [server.md](./server.md).

Pistes de refonte : centraliser les constantes (`lib/gacha-config.ts`), lire la pity dans la tx, wrapper le duel dans une tx, brancher l'audit log. (Non fait — touche l'économie prod.)
