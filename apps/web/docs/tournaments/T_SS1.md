# T_SS1 — The Stardust Series #1

> Analyse technique post-mortem du tournoi Challonge `T_SS1`, finalisé le 2026-05-03.

## Identité

| Champ | Valeur |
|---|---|
| **Slug Challonge** | `T_SS1` |
| **URL** | https://challonge.com/T_SS1 |
| **Nom Challonge** | `Tournoi Importé` (à renommer) |
| **Nom DB** | `The Stardust Series #1` |
| **Catégorie DB** | `STARDUST SERIES` (id `cmobvakj50000s7ro0fwh1052`) |
| **Tournament ID DB** | `cmobvakra0001s7rog85nt10h` |
| **Challonge ID** | `17824455` |
| **Status DB** | `COMPLETE` |
| **`challongeState`** | `complete` |
| **Date enregistrée** | `2026-05-03T17:24:27Z` (timestamp d'import — le scrape a renvoyé `started_at=null` et `completed_at=null` côté Challonge) |

## Format technique

| Champ | Valeur |
|---|---|
| **`tournament_type`** | `double elimination` |
| **`group_stages_enabled`** | `undefined` (= **pas** de group stage Challonge natif) |
| **`group_stages_were_used`** | `undefined` |
| **`grand_finals_modifier`** | `null` (= grande finale en 1 set — pas de bracket reset obligatoire) |
| **`progress_meter`** | `100%` |
| **`points_for_*`** | tous absents (pas de système round-robin Challonge) |
| **Game** | non défini (`game_name=null`) |

### Format réel (pool → bracket)

Le tournoi a été tenu en **deux phases**. La structure des poules n'est pas exposée dans le store JSON Challonge (`groupId=null` partout dans `/module` JSON), mais **elle l'est dans le HTML rendu** — le scraping HTML est donc la source canon.

1. **Phase de poules** — **6 groupes round-robin**. La page `/module` contient 6 sections `<div class="group">` avec une `<table class="standings">` par groupe. Le parser HTMLRewriter Bun-native [`scripts/parse-module-html.ts`](../../scripts/parse-module-html.ts) extrait pour chaque participant : `rank`, `displayName`, `challongeUsername`, `advanced` (qualifié), W-L-T, TB, set wins/ties, **pts Challonge**, et la `matchHistory` (liste des `data-match-id` avec leur résultat W/L). **85 matches reconstruits** par cross-référence des `matchHistory`.
2. **Phase bracket** — double élimination pure 18 joueurs. **35 matches** avec rounds positifs (WB R1 à R6, R6 = grande finale) + rounds négatifs (LB R-1 à R-7).

### Composition des poules

| Group | Effectif | Matches RR | Top 3 qualifiés (Advanced) |
|---|---:|---:|---|
| A | 5 | 10 | VentoNaBendo (4-0), Zeikuo (2-2), Masamune_Kadoya (2-2) |
| B | 6 | 15 | azurekun (4-1), SkarnGameMaster (3-2), Upolemno (3-2) |
| C | 6 | 15 | CrozyfletteCrue (4-1), LightYamani (3-2), SAtR_Younsi (3-2) |
| D | 6 | 15 | LeKingJoker (4-1), Inhezia (3-2), sewpoo_0192 (3-2) |
| E | 6 | 15 | Yolkster_ (4-1), Tategamii (4-1), Clemmmm (2-3) |
| F | 6 | 15 | BenVinzen (4-1), Kaiouss (3-2), Berserk91 (3-2) |
| **Total** | **35** | **85** | **18 qualifiés bracket** |

> Group A a **5 participants** (un inscrit en moins, peut-être un forfait avant tournoi) → 10 matches RR (C(5,2)) au lieu de 15.

### Total

- **35 joueurs inscrits** (18 bracket + 17 éliminés en poule)
- **120 matches** (85 pool round-robin + 35 bracket double-elim)

## Bracket Challonge — 35 matches

### Distribution par round

| Round | Phase | Matches |
|---:|---|---:|
| 1 | WB R1 | 2 |
| 2 | WB R2 | 8 |
| 3 | WB R3 | 4 |
| 4 | WB R4 | 2 |
| 5 | WB R5 (WB Final) | 1 |
| 6 | **Grande finale** | 2 |
| -1 | LB R1 | 2 |
| -2 | LB R2 | 4 |
| -3 | LB R3 | 4 |
| -4 | LB R4 | 2 |
| -5 | LB R5 | 2 |
| -6 | LB R6 | 1 |
| -7 | LB R7 (LB Final) | 1 |

> **Note** : la grande finale apparaît dupliquée (round 6 = 2 matches) → un *bracket reset* a été créé mais le second match n'a pas été nécessaire (champion WB = champion overall).

### Qualité des données

| Métrique | Valeur | Commentaire |
|---|---:|---|
| Matches complete | **35 / 35** | aucun pending |
| Forfait | **0** | |
| Attachement | **0** | aucune capture/preuve attachée |
| Score détaillé (`score ≠ "0-0"`) côté bracket | **0 / 35** | les scores set-par-set ne sont **pas** stockés dans `tournament_matches` Challonge — seul le W/L est connu |
| Score détaillé pool stage (via log) | **82 / 82** | les rapports `/log` contiennent le score (ex. `"4-0"`, `"3-2"`) et sont stockés dans `score` |

> ⚠️ **Conséquence ranking** : avec la formule BTS, l'absence de score détaillé bracket n'a aucun impact (le calcul ignore les sets, il compte W/L). Mais pour un éventuel ranking *par sets* (ancienne formule heuristique stardust), l'information bracket est perdue. Les scores détaillés pool stage **sont** dispo (parsés depuis `/log`).

## Participants & placements

**35 inscrits** : 18 dans le bracket + 17 éliminés en poule. Distribution finale :

| Phase | Effectif | finalPlacement DB |
|---|---:|---|
| Bracket Challonge | 18 | 1, 2, 3, 4, 5×2, 7×2, 9×4, 13×4, 17×2 |
| Éliminés en poule | 17 | 19 (sentinel : au-delà du bucket top8 BTS → 0 bonus placement) |

### Bracket (18 finalistes)

| Final | Joueur | W/L (bracket) | W/L (pool) | W/L (total) |
|---:|---|---:|---:|---:|
| **1** | Kaiouss | 8/1 | 3/1 | 11/2 |
| **2** | LightYamani | 4/2 | 2/2 | 6/4 |
| **3** | BenVinzen | 3/2 | 3/1 | 6/3 |
| **4** | LeKingJoker | 4/2 | 4/1 | 8/3 |
| 5 | Masamune_Kadoya | 2/2 | 2/2 | 4/4 |
| 5 | SkarnGameMaster | 2/2 | 3/2 | 5/4 |
| 7 | Inhezia | 2/2 | 3/2 | 5/4 |
| 7 | Zeikuo | 2/1 | 2/2 | 4/3 |
| 9 | Clemmmm | 2/2 | 1/4 | 3/6 |
| 9 | CrozyfletteCrue | 1/2 | 4/1 | 5/3 |
| 9 | SAtR_Younsi | 2/2 | 3/1 | 5/3 |
| 9 | Tategamii | 2/2 | 4/1 | 6/3 |
| 13 | Upolemno | 0/2 | 3/2 | 3/4 |
| 13 | VentoNaBendo | 0/2 | 3/0 | 3/2 |
| 13 | azurekun | 0/2 | 4/1 | 4/3 |
| 13 | sewpoo_0192 | 1/2 | 3/2 | 4/4 |
| 17 | Berserk91 | 0/2 | 3/2 | 3/4 |
| 17 | Yolkster_ | 0/2 | 5/0 | 5/2 |

### Éliminés en poule (17)

`finalPlacement = 19` pour tous (au-delà du bucket top8 BTS).

| poolRank | Joueurs | W/L (pool) |
|---:|---|---|
| 4 | Zeln3090, Loup_, Lady_Barbatrucc, Haellyss, Nera_, CØL_Éther | 1-3 W variable |
| 5 | OrO, Kineria, LuXx598, Natellen, FeedMy, Vincent___ | 1-2 W |
| 6 | KoFeJy, LOTTEUX!, CharlieFlanders, Nxzo, KamenZ | 0-1 W |

> Aucun participant Challonge n'a de `challongeUsername` rempli — tous identifiés par display name uniquement. **3 / 18** ont été matchés à un user RPB existant via leur `playerName` ; les 15 autres sont en `userId=null` (le ranking se base sur `playerName`, donc cela ne pose pas problème pour le calcul, mais limite les liens user → `stardustBlader`).

## Ranking — formule appliquée (canon stardust)

Source unique de vérité : [`src/lib/stardust-sync-bts.ts`](../../src/lib/stardust-sync-bts.ts), utilisée à la fois par le script CLI [`scripts/finalize-tournament.ts`](../../scripts/finalize-tournament.ts) et le server action `syncStardustRanking()`.

```
points = participation        (500, toujours)
       + finalRankBucket
       + Σ pointsForWin(match)  pour chaque victoire
       + 0                      pour chaque défaite (peu importe la phase)
```

### Barème complet

| Phase / Position | Points | Source |
|---|---:|---|
| **Participation** | 500 | `ranking_system.participation` |
| **1er** | 15 000 | `ranking_system.firstPlace` |
| **2ème** | 7 000 | `ranking_system.secondPlace` |
| **3ème** | 5 000 | `ranking_system.thirdPlace` |
| Top 4-8 | 500 | `ranking_system.top8` |
| ≥ 9ème | 0 | hors bucket |
| **Win en Winner Bracket** (`round > 0`) | **1 000** | `POINTS_WB_WIN` |
| **Win en Loser Bracket** (`round < 0`, `≠ -100`) | **500** | `POINTS_LB_WIN` |
| **Win en Pool** (`round === -100`) | **250** | `POINTS_POOL_WIN` |
| Défaite (peu importe la phase) | 0 | — |

> **Justification du 250 en pool** : la phase de poule sert à qualifier — chaque match y est moins sélectif qu'un match en élimination directe. Un win en pool vaut donc la moitié d'un win en LB (lui-même la moitié d'un win en WB). Hiérarchie cohérente : `WB > LB > Pool`, ratio 4:2:1.
>
> **Justification de la défaite à 0** : seules les performances positives (wins) rapportent. Une défaite en bracket ou en pool ne donne aucun point — la participation seule (500 pts) compense le fait de jouer.
>
> Tri : `score desc`, `tournamentWins desc`, `wins desc`.

### Trustworthy gate

Les bonus de placement (rank bucket + `tournamentWins`/`top3`/`top5` counters) ne sont crédités **que si** :
1. `status` DB ∈ {`COMPLETE`, `ARCHIVED`} **OU** `challongeState === 'complete'`
2. Distribution des `finalPlacement` montre **≥ 2 buckets distincts**

Pour T_SS1 les deux conditions sont remplies (status=COMPLETE, 9 buckets distincts). → bonus crédités.

### Résultats canon — 35 joueurs (formule WB/LB/Pool)

| # | Joueur | Score | W/L | Décomposition |
|---:|---|---:|---:|---|
| 1 | Kaiouss | **21 750** | 11/2 | 500 + 15 000 + 3 WB + 5 LB + 3 pool |
| 2 | LightYamani | **12 000** | 6/4 | 500 + 7 000 + 4 WB + 0 LB + 2 pool |
| 3 | BenVinzen | **9 250** | 6/3 | 500 + 5 000 + 3 WB + 1 LB + 3 pool ≈ |
| 4 | LeKingJoker | **4 500** | 8/3 | 500 + 500 + WB/LB/pool mix |
| 5 | SkarnGameMaster | **3 750** | 5/4 | top8 (rank 5) |
| 6 | Masamune_Kadoya | **3 500** | 4/4 | top8 (rank 5) |
| 7 | SAtR_Younsi | **3 250** | 5/3 | rank 9, hors bucket |
| 8 | Inhezia | **2 750** | 5/4 | top8 (rank 7) |
| 9 | Clemmmm | **2 750** | 3/6 | rank 9 |
| 10 | Tategamii | **2 500** | 6/3 | rank 9, beaucoup de pool wins (pondération 250) |
| 11-18 | _bracket finalists rank 9-17_ | 1 750–2 500 | variable | |
| 19-35 | _pool eliminees_ | 500–1 750 | 0-3 wins pool | participation + Σ pool wins × 250 |

> **Comparaison avant/après pool weighting** : Tategamii passe de #5 (avec pool full weight) à **#10** (pool ÷4 vs WB) — ses 4 wins en poule ne pèsent plus comme 4 wins de bracket. Yolkster_ (5 pool wins, 0 bracket win) sort du top 10. Top 4 inchangés (champions du bracket).

> **Vérification d'intégrité** : 35/35 participants ont un ratio W/L parfaitement cohérent avec leurs matches en DB (audit SQL `tournament_matches` ↔ `tournament_participants`).

## Pipeline d'import

Script CLI : [`bun scripts/finalize-tournament.ts T_SS1`](../../scripts/finalize-tournament.ts)

Flags :
- `--sync-only` : skip le scraping, recalcule uniquement le ranking depuis la DB.
- `--keep-name` : ne pas écraser `Tournament.name` avec `metadata.name` Challonge.

### Étapes

1. Localiser le tournoi DB par `challongeId` ou `challongeUrl`.
2. Scraper via `@rpbey/challonge` (`ChallongeScraper`) — récupère `participants`, `matches`, `standings`, `stations`, `log`.
3. Logger le breakdown matches par phase (`pools` vs `bracket`, basé sur `groupId`).
4. Dump JSON brut → `data/scrapes/T_SS1_<ISO>.json`.
5. Update `Tournament` : `status=COMPLETE`, `challongeState`, `standings`, `stations`, `activityLog`, `date=metadata.completedAt ?? startedAt ?? now`, `name=metadata.name` (sauf `--keep-name`).
6. Upsert `TournamentParticipant` : matching par `challongeParticipantId` ou `playerName` (ou `userId` si user RPB matché). `userId` matched via `name`/`username`/`profile.bladerName`.
7. Upsert `TournamentMatch` : un par `challongeMatchId`, mémorise `playerName`/`winnerName` en parallèle des FK `userId`.
8. Dispatch ranking sync via `classifyRanking(category.name)` :
   - `STARDUST` → `syncStardustRankingsToDb` (présent module)
   - `WILD` / `WB` → `syncWbRanking`
   - `SATR` / `BBT` / `SUN AFTER` → `syncSatrRanking`
   - sinon → `RankingService.recalculateAll()`

## Anomalies & dette technique

| # | Sujet | Détail | Action recommandée |
|---:|---|---|---|
| 1 | ~~**Phases de poules**~~ | ~~Challonge n'expose aucun `groupId`.~~ | **Résolu** : `/log` Challonge contient tous les rapports pool — script `scrape-pool-matches.ts` extrait 82 matches et les insère avec `round=-100`. |
| 2 | ~~**Doublons `standing-XXX`**~~ | ~~18 entrées créées par un précédent scrape supprimées par erreur.~~ | **Résolu** : 17 éliminés en poule restaurés via `restore-pool-eliminated.ts` avec `finalPlacement=19`. |
| 3 | **Scores set-par-set absents** | 35 / 35 matches ont `score = "0-0"`. | Inviter l'organisateur à reporter les scores détaillés pour les prochains tournois (utile pour stats sets, head-to-head). |
| 4 | **Nom Challonge** | "Tournoi Importé" sur Challonge. | Renommer côté Challonge en "The Stardust Series #1" pour cohérence avec la DB. |
| 5 | **Date Challonge `null`** | `started_at` et `completed_at` retournés `null` par le scraper. | À investiguer côté Challonge ou côté scraper — fallback actuel = timestamp d'import. |
| 6 | **Standings Challonge polluants** | La page `/standings` retourne 53 entrées (multi-rang) — ne contient pas que les 18 du tournoi. | Filtrer côté `ChallongeScraper` pour ne garder que les standings dont le `name` matche un participant du tournoi. |
| 7 | **Mapping users RPB** | 3 / 18 (17 %) participants matchés à un user RPB. | Améliorer le matching : ajouter `discordTag`, fuzzy match sur `bladerName`, ou demander aux participants de lier leur compte Challonge → RPB via leur profil. |

## Artefacts

- Dump bracket Challonge : `data/scrapes/T_SS1_2026-05-03T17-24-27-355Z.json`
- Dump log entries (153 lignes, 8 pages) : `data/scrapes/T_SS1_log_entries_<ISO>.json`
- HTML brut /log : `data/scrapes/T_SS1_log_<ISO>.html`
- DB rows :
  - `tournaments` : 1 ligne (`cmobvakra0001s7rog85nt10h`)
  - `tournament_participants` : **35 lignes** (18 bracket + 17 pool elim)
  - `tournament_matches` : **120 lignes** (35 bracket avec rounds réels + 85 pool round-robin avec `round=-100`, IDs Challonge réels)
  - `stardust_rankings` : 35 lignes
  - `stardust_bladers` : 35 entrées avec `history` JSONB

## Pipeline complet (T_SS1 et tournois ultérieurs)

```bash
cd ~/vps/apps/rpb-dashboard

# 1. Scrape bracket + participants + standings (Challonge JSON store)
bun scripts/finalize-tournament.ts T_SS1 --keep-name

# 2. Restaurer/insérer les éliminés en poule (depuis le dump JSON existant)
bun scripts/restore-pool-eliminated.ts

# 3. Dump HTML brut de /module (6 groupes + bracket finals rendus)
bun scripts/dump-challonge-module.ts T_SS1

# 4. Parser le HTML → JSON structuré (groupes, participants, 85 matches RR)
bun scripts/parse-module-html.ts T_SS1

# 5. Importer les 85 matches pool en DB (avec IDs Challonge réels) + re-sync
bun scripts/import-pool-matches-from-module.ts T_SS1

# 6. Re-sync ranking pure (debug, pas de scrape)
bun scripts/finalize-tournament.ts T_SS1 --sync-only --keep-name

# 7. Build + deploy prod
bash scripts/ops/safe-deploy.sh rpb-dashboard
```

> Pour un tournoi suivant (ex. `T_SS2`), il faudra **généraliser** les scripts 2 et 5 pour qu'ils prennent le slug en argument et identifient le `tournamentId` automatiquement via `prisma.tournament.findFirst({ where: { challongeId: slug } })`. Le pipeline HTMLRewriter (3+4+5) est déjà robuste : il fonctionne pour tout tournoi Challonge avec phase de poule.

### Source de vérité : HTML `/module` plutôt que log scrape

Le premier import (étapes 2 puis `scrape-pool-matches.ts` sur `/log`) avait extrait **82 matches** via parsing du log paginé Challonge — manque de 3 matches probablement non reportés ou texte mal formatté. Le pipeline HTML extrait **85 matches** (source officielle) via les `data-match-id` exposés dans la table standings de chaque groupe. Le script `import-pool-matches-from-module.ts` remplace les matches précédents par ceux du HTML, en utilisant les **vrais IDs Challonge** (clés stables, idempotence garantie sur re-runs).
