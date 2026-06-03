---
title: "Métagame WBO — extraction & données consommées par rpbey"
description: "Pipeline d'extraction des classements et du métagame WBO (Wayback Machine) consommé par le dashboard rpbey."
scope:
  - apps/web/data
  - apps/web/src/server/services/global-search.ts
status: "stable"
last_updated: "2026-06-02"
related_symbols:
  - wbo-combos.json
  - wbo-meta.json
  - refresh_combos_wayback.ts
---

# Métagame WBO — extraction & données consommées par rpbey

Ce document décrit la chaîne d'extraction des classements (*rankings*) et du
métagame du forum **World Beyblade Organization** (`worldbeyblade.org`), et la
façon dont rpbey consomme ces données.

> Le moteur d'extraction vit **hors monorepo**, dans Bxc (`/home/ubuntu/bxc`,
> read-only). rpbey n'embarque pas ce code : il consomme les JSON produits
> (rafraîchis périodiquement). Côté monorepo, les combos WBO sont matérialisés
> dans `apps/web/data/wbo-combos.json` (cf. commit `bbc35bc`, rafraîchissement
> via Wayback Machine). Pour le crawl/RAG X.com (distinct), voir
> [crawling-rag-x.md](crawling-rag-x.md).

## 1. Contournement headless & reconnaissance WBO

Les forums `worldbeyblade.org` sont protégés agressivement par **Cloudflare
Turnstile**. Pour extraire en mode headless sans risquer un bannissement IP du
VPS, l'extraction s'appuie sur les archives de la **Wayback Machine** plutôt que
sur un accès direct.

Le script interroge l'API CDX d'Internet Archive pour trouver les snapshots
valides de `/rankings` et de ses sous-catégories, puis les télécharge localement
pour traitement :

1. Général / Top 50 — `web.archive.org/web/20251105085224/https://worldbeyblade.org/rankings`
2. Format Burst — `web.archive.org/web/20260217210849/https://worldbeyblade.org/rankings/burst`
3. Format Metal Saga — `web.archive.org/web/20260105220438/https://worldbeyblade.org/rankings/metal`

## 2. Structure des données extraites

Le parser structure les données dans deux fichiers JSON sous `/home/ubuntu/bxc/data/`.

### A. Classement des joueurs (`wbo_rankings_parsed.json`)

Liste des joueurs WBO avec statistiques victoires/défaites, points et classement
officiel :

```json
[
  {
    "rank": 1,
    "username": "Kei",
    "profileUrl": "https://worldbeyblade.org/User-Kei",
    "points": 1800,
    "pointsType": "BR",
    "wins": 480,
    "losses": 172,
    "category": "General/Top"
  }
]
```

### B. Métagame & synergies (`bbx_metagame_data.json`)

Analyse du thread WBO *"Winning Combinations at WBO Organized Events"* : efficacité
des pièces sur le podium (1er = 3 pts, 2e = 2 pts, 3e = 1 pt) et synergie entre
pièces via un score bayésien (shrinkage penalty) :

```json
{
  "metadata": {
    "total_tournaments": 23,
    "scraped_at": "2026-05-29T08:36:53.579Z"
  },
  "part_rankings": [
    { "part": "Phoenix Wing", "average_score": 2.07, "placements": 43, "total_score": 89 }
  ],
  "combo_synergy": [
    { "part_a": "9-60", "part_b": "Unicorn Sting", "co_occurrences": 6, "synergy_score": 2.429 }
  ]
}
```

## 3. Dashboard & API (côté Bxc)

Bxc expose un serveur Elysia (port `3000`, local à `/home/ubuntu/bxc`) servant un
dashboard et deux endpoints de lecture :

- Dashboard : `http://localhost:3000/`
- API classement joueurs : `http://localhost:3000/api/v1/rankings`
- API métagame & synergies : `http://localhost:3000/api/v1/metagame`

Le dashboard (Vanilla CSS, Chart.js) présente : efficacité moyenne Blades /
Ratchets / Bits avec filtres, top synergies de combos, leaderboard WBO par
catégorie (Général, Burst, Metal), et des recommandations de decks méta.

## 4. Rafraîchissement des données

Depuis `/home/ubuntu/bxc` :

```bash
# 1. Trouver les nouvelles URL de snapshots archivés (CDX)
bun run scripts/fetch_rankings_cdx.ts
# 2. Télécharger les HTML correspondants
bun run scripts/fetch_all_rankings.ts
# 3. Parser les HTML → JSON
bun run scripts/parse_rankings_all.ts
```

Le serveur Elysia recharge les JSON modifiés à la prochaine requête HTTP (pas de
redémarrage). Lancement manuel : `bun run server:start`.

Côté rpbey, les combos consommés par le dashboard métagame sont régénérés par
`~/bxc/scripts/refresh_combos_wayback.ts` vers `apps/web/data/wbo-combos.json`.
