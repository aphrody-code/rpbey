---
title: "Gacha — Règles & mécaniques"
description: "Raretés, coûts, pity, daily/streak, duel, économie/dette, badges, fusion et roster bannière 1."
scope:
  - apps/gacha-server
  - apps/web
status: "stable"
last_updated: "2026-05-29"
related_symbols:
  - cardRarity
  - PULL_COST
  - pityCount
  - duelRating
---

# Gacha — Règles & mécaniques

Mécaniques de jeu, valeurs d'équilibre, et roster de la bannière 1. Les valeurs **divergent entre les surfaces** (web `:3002` vs serveur `:5050`) — voir colonnes.

## Raretés

`COMMON · RARE · SUPER_RARE · LEGENDARY · SECRET` (enum `cardRarity`). Taux de tirage carte (web, `helpers.ts:41-47`) :

| Rareté | Poids | Prix de vente (bot) |
| --- | --- | --- |
| COMMON | 60 % | 5 🪙 |
| RARE | 25 % | 15 🪙 |
| SUPER_RARE | 10 % | 50 🪙 |
| LEGENDARY | 4 % | 150 🪙 |
| SECRET | 1 % | 500 🪙 |

Le projet communautaire prévoit en plus une répartition cible par bannière : **Commun ×16, Rare ×10, Super Rare ×4, Légendaire ×2**.

> **Attention** : le serveur `:5050` utilise une **table de tirage DISTINCTE et rééquilibrée**, avec un slot **MISS** (tirage raté, aucune carte) — ce n'est **PAS** aligné sur le 60/25/10/4/1 du web (`apps/gacha-server/src/config.ts:78-93`) :
> **MISS 30 % · COMMON 39 % · RARE 18 % · SUPER_RARE 9 % · LEGENDARY 3 % · SECRET 1 %** (somme = 100).

### Niveaux d'effort (convention artistes)
- **R** = dessin propre · **SR** = plus poussé · **LR/Légendaire** = boosté + légèrement animé (seules les LR sont animées ; si l'artiste ne sait pas animer, c'est pris en charge).

## Coûts & pity

| Mécanique | Web `:3002` | Serveur `:5050` (bot) |
| --- | --- | --- |
| Pull ×1 | **100** 🪙 | **50** 🪙 |
| Pull ×5/×10 | 450 🪙 (×5) | 450 🪙 (×10) |
| Pity | 3 tirages sans SR+ → SUPER_RARE garanti, reset sur SR+ | géré côté serveur (« 3 ratés → garanti ») |

Pity web : `pityCount` sur `profiles`, incrémenté à chaque pull, reset à 0 dès qu'un SR+ sort ou que le seuil force un SUPER_RARE. Le **multi reset** la pity à 0.

## Daily & streak

Web (`claimDailyTx`) : base **50** + bonus `min((streak-1)×10, 100)` → **50 à 150 🪙/jour**. Streak reset si > **48 h** sans claim. Un seul claim par jour UTC.

Serveur `:5050` (bot) : cooldown ~20 h, **tiers de streak** bonus (3 j +50 · 7 j +150 · 14 j +300 · 30 j +750 🪙), et **intérêts de dette prélevés** sur la récompense si `currency < 0`.

## Duel

### Web — duel instantané (`/api/gacha/duel`)
- Dégâts : `att×0.35 + def×0.25 + end×0.25 + equilibre×0.15`.
- Avantage élément ×1,25 : `FEU → VENT → TERRE → EAU → FEU`, `LUMIERE ↔ OMBRE`.
- Variance ±15 %. Récompense victoire : **25 🪙** (`DUEL_REWARD`).

### Bot — duel TCG async (`/duel combat`)
Best-of-3, sélection de 3 cartes, ELO (`duelRating`, départ 1000), mise 0-5000, bonus synergie/underdog/momentum. Stats persistées (`duelWins/Losses/Streak/BestStreak/Rating`) + table `duelMatch`.

### Bot — duel rapide (`/gacha duel`)
1v1 immédiat, cartes tirées au hasard de l'inventaire (Prisma direct), récompense en 🪙.

## Économie / dette

- Monnaie = `profiles.currency` (**peut être négative** = dette).
- Journal `currency_transactions` (type + montant signé + note).
- **Dette** (bot) : intérêts **15 %/jour**, bloque `gacha`/`multi`/`parier` tant que `currency < 0`.
- **Achats in-app** : webhook Discord entitlement → crédite `currency`, idempotence via note `iap:%` (index unique).

## Badges de collection (bot, `:5050`)
Paliers : 5 → 200 · 10 → 500 · 15 → 750 · 20 → 1000 · 25 → 1500 · 31 → 3000 🪙.

## Fusion (bot, `:5050`)
`fusionPreview()` / `fuse(cardId)` — combine des doublons (logique côté serveur `:5050`).

## Système « parts » (Beyblade X, web actions)
Distinct des cartes : pull de **pièces** (BLADE/OVER_BLADE/RATCHET/BIT/LOCK_CHIP/ASSIST_BLADE), rareté **calculée** par poids/stats (`actions/gacha.ts:106-199`), inventaire séparé (`part_inventory`). Pas de route HTTP dédiée (server actions + `/api/game/inventory` en lecture).

## Règles communautaires (projet bannière 1)

- **16 personnages** par bannière, chaque artiste réserve son perso (message épinglé, zéro doublon).
- Thème bannière 1 : **vibe saison 1** (Metal Fusion / Bakuten Shoot). Style & tenue **libres**.
- Cadence ~**3 mois** entre bannières. Sortie bannière 1 visée : début juin.
- Template de carte unique (cadre par soupy) → montage **uniforme** des illustrations (voir [assets-pipeline.md](./assets-pipeline.md)).
- Chef de projet : **Berserk** ; coordination : **Tategami**. Illustrateurs : Berserk, Paimy, Illu, Azure, Mei, Karu, Crépuscule, zeLn.

### Roster bannière 1 — *perso · rareté · dessinateur · état*
✅ carte montée · 🟡 en cours · ⏳ à faire

| Perso | Rareté | Dessinateur | État |
| --- | --- | --- | --- |
| Gingka Hagane | LR | Crépuscule | ✅ (vitrail) |
| Ekusu | LR | Berserk | ⏳ (animée) |
| Takao (Tyson) | SR | Crépuscule | ✅ (vitrail) |
| Kai Hiwatari | SR | Kineria | ✅ (découpé du duo) |
| Kyoya Tategami | SR | Illu | ✅ |
| Valt | SR | Azure | ⏳ |
| Tsubasa Otori | R | Karu | ✅ (Earth Eagle) |
| Rei | R | Karu | ⏳ |
| Shu Kurenai | R | Azure | 🟡 (lineart) |
| Rantaro Kiyama | R | thob | 🟡 (croquis→colo) |
| Ken | R | Paimy | ⏳ |
| Bird | R | Mei | ⏳ |
| Multi (kawaii / élégant) | R | Illu | ⏳ |
| Max · Kenta | R | — | ⏳ |

Pièce spéciale : illustration duo **Kai & Kyoya** (Kineria) — la carte SR Kai en est la moitié gauche découpée.
