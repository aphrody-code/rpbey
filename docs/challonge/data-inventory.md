---
title: "Challonge — Inventaire des données (extrait vs manquant)"
description: "Mapping fixtures vs données déjà extraites par ScrapedTournament, et gaps à combler dans le module scraper."
scope:
  - packages/challonge
status: "stable"
last_updated: "2026-05-29"
related_symbols:
  - ScrapedTournament
  - ChallongeScraper
  - ChallongeApi
  - parseBracketSvg
---

# Challonge — Inventaire des données (extrait vs manquant)

Ce qu'on extrait déjà, sous quelle forme, et ce qui manque pour étendre le module.

## Mapping des fixtures

`packages/challonge/tests/fixtures/` (extraction B_TS4, 81 participants, 161 matches,
double elimination, état `complete`) :

| Fichier | Forme | Top-level keys / shape |
| --- | --- | --- |
| `bts4_full.json` | API v1 | `{ tournament: { id, name, url, full_challonge_url, state, tournament_type, participants_count(81), game_name("Beyblade X"), started_at, completed_at, subdomain, participants[81], matches } }` |
| `bts4_matches.json` | API v1 | `array[161]` de `{ match: {…36 champs} }` |
| `bts4_participants.json` | API v1 | `array[81]` de `{ participant: {…42 champs} }` |
| `bts4_root.html` | SSR | bracket SPA, `TournamentController`, 4 stores (JS-literal) |
| `bts4_module.html` | SSR | SPA module, `TournamentController`, `TournamentStore` (JS-literal) |
| `bts4_log.html` | SSR | `LogEntriesController`, `LogEntryListStore` (array) + `ActivityFeedSettingsStore` |
| `bts4_standings.html` | SSR | table `striped-table standings`, 116 win / 116 loss / 232 match-report |
| `bts4_participants.html` | SSR | coquille `#participant-management` (lignes React, 0 `<tr>`) |
| `games.json` | catalogue | array `{id, value, tokens[], permalink}` (~114 KB ; Beyblade X = 337197, Beyblade = 758) |
| `org_landing.html` | SSR | landing org `<sub>.challonge.com` (~292 KB ; parsée par `parseOrgLanding`) |
| `user_profile.html` | SSR | profil `/users/{name}` (~64 KB ; parsée par `parseUserProfile`) |

(Plus un dossier `legacy/` pour les fixtures de l'ancien rendu HTMLRewriter.)

> Les `.html` B_TS4 sont en **JS-literal** (clés bare) → `JSON.parse` KO → fixtures STALE
> par rapport au LIVE (JSON valide). Voir [`react-stores.md`](react-stores.md).

### Champs réels (vérifiés sur les `.json`)

- **`match` v1 (36 champs)** : `id, tournament_id, state, player1_id, player2_id,
  player1_prereq_match_id, player2_prereq_match_id, player1_is_prereq_match_loser,
  player2_is_prereq_match_loser, winner_id, loser_id, started_at, created_at,
  updated_at, identifier, has_attachment, round, player1_votes, player2_votes,
  group_id, attachment_count, scheduled_time, location, underway_at, optional,
  completed_at, suggested_play_order, forfeited, open_graph_image_file_name,
  open_graph_image_content_type, open_graph_image_file_size, metadata,
  player1_metadata, player2_metadata, prerequisite_match_ids_csv, scores_csv`.
- **`participant` v1 (42 champs)** : `id, tournament_id, name, seed, active,
  created_at, updated_at, invite_email, final_rank, misc, icon, on_waiting_list,
  invitation_id, group_id, checked_in_at, ranked_member_id, custom_field_response,
  clinch, integration_uids, metadata, challonge_username, challonge_user_id,
  challonge_email_address_verified, removable, participatable_or_invitation_attached,
  confirm_remove, invitation_pending, display_name_with_invitation_email_address,
  email_hash, username, display_name, attached_participatable_portrait_url,
  can_check_in, checked_in, reactivatable, check_in_open, group_player_ids,
  has_irrelevant_seed, ordinal_seed, roster_complete, roster_size`.

## Données DÉJÀ extraites (forme canonique)

Forme produite par le package = `ScrapedTournament` (`packages/challonge/src/types.ts`) :

```
ScrapedTournament {
  metadata: { id, name, url, state, type, participantsCount, startedAt, completedAt, game, subdomain }
  participants: ScrapedParticipant[]   // id, name, seed, ordinalSeed, challongeUsername, challongeProfileUrl, challongeUserId, emailHash, portraitUrl, finalRank, clinched, metadata
  matches: ScrapedMatch[]              // id, identifier, round, bracketSide(WB|LB|GF|RR), player1Id, player2Id, winnerId, loserId, scores, sets[2-D], state, forfeited, optional, timestamps, attachmentCount, hasAttachment, suggestedPlayOrder, groupId
  standings: ScrapedStanding[]         // rank, name, challongeUsername, challongeProfileUrl, wins, losses, stats
  stations: ScrapedStation[]           // (toujours [] — /stations non porté)
  log: ScrapedLogEntry[]               // timestamp, type, message, matchId?, matchIdentifier?, who?, raw?
  raw: any
}
```

Producteurs :
- `ChallongeApi.toCanonical()` (`api.ts:454`) — depuis v1 ; peut synthétiser `log[]`
  depuis les timestamps de matches (`synthesizeLogFromMatches`, `api.ts:597`).
- `ChallongeScraper.scrape()` (`scraper.ts:498`) — `/module` (TournamentStore) +
  `/standings` (table) + `/log` (paginé) + `/participants` (extra).
- `htmlrewriter.ts` `snapshotToScrapedTournament` (`:271`) — depuis le snapshot bxc.
- bxc `extractChallongeTournament` → `ChallongeTournamentSnapshot` (meta 40+ flags,
  rounds[], matches[] + matches_by_round{}, third_place_match, consolation_matches[],
  groups[], participants[], standings dérivées, react mount, gon).

Côté SVG : `bracket-svg.ts` `parseBracketSvg` extrait `matchId, identifier, state,
x, y, player1/2{participantId, name, seed, score, winner}` — **mais** seul
`htmlrewriter.ts` legacy l'utilise ; le mapper principal `scraper.ts:193`
(`mapSnapshotToScrapedTournament`) n'appelle **pas** `parseBracketSvg` → `ScrapedMatch` n'a pas de x/y.

## Données MANQUANTES / partielles

| Donnée | État | Détail |
| --- | --- | --- |
| **Search index global** | manquant | aucun `searchTournaments({gameId,state,type,page})` wrappant `/tournaments?game_id=` ni le XHR `tournaments.json`. Voir `search-engine.md`. |
| **Catalogue `games.json`** | figé | `game_id` Beyblade X = **337197** (fixture `games.json` committée + `games-catalog.ts`). Reste à confirmer le **nom** du param de filtre (`game_id` vs `filter[game_id]`). |
| **Group stages détaillés** | partiel | `groups[]` typé `unknown[]` partout ; standings de poule round-robin non dérivées séparément (les matches existent via `group_id`). |
| **Coords SVG dans le mapper principal** | partiel | `mapSnapshotToScrapedTournament` (`scraper.ts:193`) n'appelle pas `parseBracketSvg` → pas de x/y. Seul `htmlrewriter.ts` les expose. |
| **Profils users** (`/users/{name}` medals/history) | extrait | `parseUserProfile` (`extractors/stores/user-profile.ts:222`) + fixture `user_profile.html`. |
| **Communities/orgs landing** (`<sub>.challonge.com`) | extrait | `parseOrgLanding` (`extractors/stores/org-landing.ts:253`) + fixture `org_landing.html`. |
| **Attachments de match** | partiel | `has_attachment`/`attachment_count`/`open_graph_image_*` lus, mais contenu (images) jamais téléchargé. v1 `/matches/{m}/attachments` non implémenté. |
| **Stations** (`/stations`) | manquant | `ScrapedStation` typé mais `scraper.ts:599` retourne `[]` (withStations log+skip). Page jamais capturée. |
| **Standings officielles** | partiel | bxc dérive du graphe (`deriveStandings`, best-effort) ; les vraies standings = table HTML (`parseStandingsTable`, unifiée dans `extractors/stores/standings.ts:34`, façades `scraper.ts:237` / `reverse.ts:458`). |
| **Predictions / announcements** | manquant | login-wall, jamais capturé. |
| **Faye live-refresh** | non implémenté | canal `/tournaments/<id>` non souscrit (piste temps-réel). |

## Données meta Beyblade locales (hors Challonge, `apps/web/data/`)

`wbo-combos.json` (~2.3 MB : events + placements + combos blade/ratchet/bit),
`wbo-meta.json` (periods), `wb_blader_profiles.json` [159], `satr_blader_profiles.json`
[401], `bx-catalog.json` (~1.2 MB). Utiles pour croiser usernames/joueurs Challonge
avec la meta locale.

## Doublons / dette résolue côté package (rappel modularité)

- **Triple-dédup RÉSOLUE** : un seul `parseStandingsTable` dans
  `extractors/stores/standings.ts:34` ; les deux call-sites sont des façades
  (`scraper.ts:237` et `reverse.ts:458`). Un seul `parseInitialStoreState` dans
  `extractors/store-state.ts:30` ; `parseStoreState` (`scraper.ts:108`) et
  `extractInitialStoreState` (`reverse.ts:445`) y délèguent tous deux.
- `STORE_STATE_RE` supprimé (0 occurrence dans `src/`).
- Reste : 2 mappers snapshot→ScrapedTournament divergents (`scraper.ts:193`
  `mapSnapshotToScrapedTournament` vs `htmlrewriter.ts:271`).

## Gaps (live non résolu)

- Routes listing/découverte CF hard-block après rafale (pas de cookie jar).
- `game_id` Beyblade X figé (337197) ; reste le **nom** du param de filtre à confirmer live.
- Bracket SVG server-rendered jamais observé sur le site actuel.
- HAR post-hydratation (XHR client-side) non capturé (nécessite Chrome CDP).
