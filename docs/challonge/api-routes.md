---
title: "Challonge — Cartographie des routes & API"
description: "Table exhaustive des endpoints Challonge : REST v1, v2.1 OAuth JSON:API, routes SSR internes et GraphQL interne."
scope:
  - packages/challonge
status: "stable"
last_updated: "2026-06-02"
related_symbols:
  - ChallongeApi
  - ChallongeApiTournament
  - ChallongeApiMatch
  - getChallongeClient
---

# Challonge — Cartographie des routes & API

Quatre couches : (1) REST v1 read-only, (2) REST v2.1 read+write OAuth JSON:API,
(3) routes internes front SSR (CF-fronted), (4) GraphQL interne (non exposé).
Vérifié sur code (`file:line`) + live (bxc curl-impersonate chrome131).

## (1) REST v1 — read-only — `packages/challonge/src/api.ts`

- **Base** : `https://api.challonge.com/v1` (`api.ts:198`).
- **Auth** : HTTP Basic `api:<API_KEY>` → `Authorization: Basic btoa("api:"+key)` (`api.ts:206`).
- **Accept** : `application/json` (`api.ts:191`). XML aussi supporté côté Challonge, non utilisé ici.
- **Rate limit** : 600 req/min/token ; respecte `Retry-After` sur 429 (`api.ts:196-201`).
- **Format** : suffixe `.json`.

| Endpoint | Méthode | Params | Source |
| --- | --- | --- | --- |
| `/tournaments/{idOrSlug}.json` | GET | `include_participants=0\|1`, `include_matches=0\|1` | `api.ts:302` `get()` |
| `/tournaments.json` | GET | `state(all\|pending\|in_progress\|ended)`, `type`, `subdomain` | `api.ts:326` `list()` |

- `idOrSlug` accepte id numérique, slug url, ou `subdomain-slug`.
- **Lacune documentée** (`api.ts:8`) : v1 n'expose **pas** `/log`, `/predictions`,
  `/announcements` → seul le scraper y accède.
- **Gap** : v1 attachments (`GET/POST /tournaments/{t}/matches/{m}/attachments`)
  existent côté Challonge mais **non implémentés** dans `api.ts`.
- **Live vérifié** : `GET /v1/tournaments.json` sans auth → **401**
  (`www-authenticate: Basic realm="Application"`). `api.challonge.com/` racine → 200
  (origin OpenResty/1.25.3.2 derrière CF, pas de challenge).

### Shapes v1 (raw)

- `ChallongeApiTournament` (`api.ts:91`) : `id, name, url, full_challonge_url,
  state, tournament_type, participants_count, game_name, started_at, completed_at,
  subdomain, participants[], matches[]`.
- `ChallongeApiParticipant` (`api.ts:27`) : `id, tournament_id, name, display_name,
  username, challonge_username, challonge_user_id, email_hash, seed, ordinal_seed,
  active, checked_in, checked_in_at, final_rank, portrait_url,
  attached_participatable_portrait_url` (le bon champ — `attached_participant_*`
  était une faute tolérée, `api.ts:43-50`)`, group_id, group_player_ids, clinch,
  metadata, custom_field_response`.
- `ChallongeApiMatch` (`api.ts:58`) : `id, tournament_id, identifier, round (positif=WB,
  négatif=LB, > max_wb=GF), state, player1_id, player2_id, winner_id, loser_id,
  scores_csv ("3-1,2-3"), forfeited, optional, has_attachment, attachment_count,
  started_at, underway_at, completed_at, created_at, updated_at, scheduled_time,
  location, suggested_play_order, prerequisite_match_ids_csv,
  player1_prereq_match_id, player2_prereq_match_id, player1_is_prereq_match_loser,
  player2_is_prereq_match_loser, group_id`.

## (2) REST v2.1 — read+write — `packages/challonge/src/write.ts` (module `@rose-griffon/challonge/write`)

Le client réel vit dans le package partagé (`packages/challonge/src/write.ts`, ~517
lignes). `apps/bot/src/lib/challonge.ts` n'est plus qu'un **shim de re-export** (22
lignes) de `@rose-griffon/challonge/write` (`getChallongeClient` + types JSON:API).

- **Base API** : `https://api.challonge.com/v2.1` (`write.ts:28` `API_BASE`).
- **Base OAuth** : `https://api.challonge.com` (`write.ts:29` `OAUTH_BASE`).
- **Headers** (`write.ts:151-153`) : `Content-Type: application/vnd.api+json`,
  `Accept: application/json`, `Authorization-Type: v1|v2`.
  - v1 : `Authorization: <apiKey>` (brut, **pas** Basic).
  - v2 : `Authorization: Bearer <oauth_token>`.
- **OAuth2 Client Credentials** (`write.ts:123-129`) : `POST /oauth/token`,
  `Content-Type: x-www-form-urlencoded`, body
  `grant_type=client_credentials&client_id=…&client_secret=…&scope="me tournaments:read
  tournaments:write matches:read matches:write participants:read participants:write"`.
  Réponse `{access_token, token_type, expires_in, created_at}`. Cache avec marge 5 min.
- **Singleton** `getChallongeClient()` (`write.ts:490`) : préfère OAuth v2 si
  `CHALLONGE_CLIENT_ID` + `CHALLONGE_CLIENT_SECRET`, sinon fallback v1 `apiKey`.
- Toutes les réponses sont **JSON:API** (`data: { type, attributes }`).

| Endpoint | Méthode | Body / params | Source |
| --- | --- | --- | --- |
| `/oauth/token` | POST | `grant_type, client_id, client_secret, scope` | `write.ts:123` |
| `/tournaments` | GET | `state, page, per_page` | `write.ts:188` `listTournaments` |
| `/tournaments/{id}` | GET | — | `write.ts:205` `getTournament` |
| `/tournaments` | POST | `data{type:"tournaments", attributes{name,url,tournament_type,description,game_name,start_at,signup_cap,open_signup}}` | `write.ts:212` `createTournament` |
| `/tournaments/{id}/change_state` | PUT | `data{type:"TournamentState", attributes{state: start\|finalize\|reset}}` | `write.ts:248` |
| `/tournaments/{id}` | DELETE | — | `write.ts:263` `deleteTournament` |
| `/tournaments/{id}/participants` | GET | — | `write.ts:272` `listParticipants` |
| `/tournaments/{id}/participants` | POST | `data{type:"participants", attributes{name,email,seed,misc}}` | `write.ts:282` `createParticipant` |
| `/tournaments/{id}/participants/bulk_add` | POST | `data[]` (array de participants) | `write.ts:322` `bulkCreateParticipants` |
| `/tournaments/{id}/participants/{pid}` | DELETE | — | `write.ts:340` `deleteParticipant` |
| `/tournaments/{id}/participants/randomize` | POST | — | `write.ts:347` `randomizeParticipants` |
| `/tournaments/{id}/participants/{pid}` | PUT | `data{type:"participants", attributes{checked_in: true\|false}}` | `write.ts:282` check-in / undo |
| `/tournaments/{id}/open_for_check_in` | PUT | — | `write.ts:399` `openCheckIn` |
| `/tournaments/{id}/close_check_in` | PUT | — | `write.ts:409` `closeCheckIn` |
| `/tournaments/{id}/matches` | GET | `state(open\|pending\|complete)` | `write.ts:418` `listMatches` |
| `/tournaments/{id}/matches/{mid}` | GET | — | `write.ts:435` `getMatch` |
| `/tournaments/{id}/matches/{mid}` | PUT | `data{type:"matches", attributes{winner_id, scores_csv}}` | `write.ts:445` `updateMatch` (report) |
| `/tournaments/{id}/matches/{mid}/change_state` | PUT | `data{type:"MatchState", attributes{state:"mark_underway"}}` | `write.ts:471-479` `markMatchUnderway` |

- **Live vérifié** : `GET /v2.1/tournaments` avec `Authorization-Type: v1` mais
  mauvais `Content-Type` → **415** `{"errors":{"detail":"Invalid header value in
  Content-Type"}}` puis **406** (exige `application/vnd.api+json` en Content-Type ET
  Accept). Confirme l'API JSON:API. Endpoints write non testables sans credentials.
- **`listTournaments` ne filtre que `state/page/per_page`** (scopé au token) → **pas**
  de recherche cross-tournoi par `game_id`/`q`/`type` (voir `search-engine.md`).

## (3) Routes internes front (SSR React, Cloudflare-fronted)

Base : `challonge.com/{slug}` ou `challonge.com/{lang}/{slug}` (défaut package
`https://challonge.com/fr`, `reverse.ts:117`). Slug accepte aussi un subdomain
(`org.challonge.com/{slug}`). Toutes consommées via `BxcTransport` (chrome131).

| Route | Live (curl-impersonate, sans cookie) | Stores / source | Source code |
| --- | --- | --- | --- |
| `/{slug}` (root) | 200 ou **403 CF** (stochastique) | `TournamentStore`, `CurrentUserStore`, `BracketSettingsStore`, `ThemeStore` ; RC `TournamentController` ; `gon.*` | `reverse/scraper` |
| `/{slug}/module` | **200 fiable** (chemin canonique) | mêmes stores que root, source de `TournamentStore` | `scraper.ts:395` `extractStore` |
| `/{slug}/log[?page=N]` | 200 (flaky) ou 403 CF | `LogEntryListStore` (array), `ActivityFeedSettingsStore` (`.logEntries{currentPage,totalPages,totalCount}`), `CurrentUserStore` ; RC `LogEntriesController` | `reverse.ts:205` ; `scraper.ts:422` `fetchLog` (paginé ≤12 pages // ) |
| `/{slug}/standings` | 200 ou 403 CF | **pas de store** → table HTML SSR | `reverse.ts:270` ; `scraper.ts:483` |
| `/{slug}/participants` | login-wall (302 `/user_session/new`) ou 403 CF | `#participant-management[data-tournament][data-rankings]` (coquille SSR, lignes React) | `reverse.ts:297` ; `scraper.ts:468` |
| `/{slug}.json` | 200 (warm) ou **403 CF** — fallback auto vers `/module` | JSON = `TournamentStore` (`tournament, rounds[], matches_by_round{}, third_place_match, consolation_matches[], groups[], requested_plotter`) | `reverse.ts:330` `getStore()` |
| `/{slug}/stations` | non porté | `ScrapeOptions.withStations` retourne `[]` + log | `scraper.ts:599` |
| `/{slug}/groups` | login-wall (302) | — (dérivable de `/module` `groups[]`) | — |
| `/{slug}/predictions`, `/announcements` | 200 coquille auth-gated | — | — |
| `/{slug}/spectate` | **404** | — | — |
| `/users/{username}`, `/{lang}/users/{username}` | 200 | profil SSR (medals/history) | — (pas d'extracteur) |

Méta extraites : `meta[property=og:title|og:url|og:image|og:description]`
(ordre content-avant-property, `og:image` porte aussi `itemprop="image"`),
`meta[name=csrf-token]`, `meta[name=asset-host]`. Hôtes assets :
`assets.challonge.com` (CSS/JS/manifest), `user-assets.challonge.com` (portraits/bannières).

> **Auto-recouvrant** : `getStore()` (`reverse.ts:330`) cible `/{slug}.json` qui est
> désormais souvent **403 CF** (vérifié sur `B_TS5.json` et `fr/B_TS5.json`), mais
> fallback automatiquement vers `#getStoreFromModule` (`reverse.ts:379`) qui lit
> `/module` + `parseInitialStoreState` sur tout échec (403, redirect, JSON vide). Le
> docstring `reverse.ts:320-329` documente ce fallback. Détail dans `pages-selectors.md`.

## (4) GraphQL — interne, NON exposé publiquement

Vérifié live :
- `POST challonge.com/graphql` headers minimaux → **403 CF**.
- `POST challonge.com/graphql` avec headers browser complets (`Origin`, `Referer`,
  `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors`, `X-Requested-With`) →
  **404** `application/json {"status":"404","error":"Not Found"}`. Une fois CF passé,
  la route **n'existe pas** sur le host public.
- `POST/GET api.challonge.com/graphql` → **404** (jamais CF-bloqué, route absente).

Conclusion : le GraphQL mentionné par la recon Gemini est **strictement interne**
(auth session admin requise, jamais atteignable anonyme). Aucune référence
"graphql" dans le HTML SSR des fixtures.

## Recherche / découverte (bonus)

- `GET challonge.com/tournaments.json` (XHR, headers `X-Requested-With: XMLHttpRequest`
  + `Accept: application/json`) → **200** `{next_page, collection[...]}`. Détail
  complet dans [`search-engine.md`](search-engine.md).
- `GET challonge.com/games.json` → **200** ~114 KB (catalogue jeux).
- 404 : `/tournaments/search.json`, `/tournaments/search`, `/tournaments/autocomplete`,
  `/autocomplete/users`, `/games/autocomplete`. 500 : `/users/search.json`.
  403 CF : `/users/autocomplete?term=`.

## Observation Cloudflare (gating)

Stochastique : les premières requêtes cookie-less passent (200) puis l'IP VPS est
flag (403 "Just a moment") après une rafale. Mitigations : pacer ≥ 4 s, maintenir
un cookie jar (`storage/cookies/challonge_cookie.json`, **absent**), préférer headers
XHR `Sec-Fetch-Site: same-origin/cors` plutôt que navigate (`Sec-Fetch-Site: none`).
Le package a un retry interne (`utils/retry.ts`, sur 429/5xx/transient) ; la CLI
`bxc challonge` (profile `http`) **n'a pas** de retry sur 403 → flaky sur `/log`.

## Gaps

- v1 attachments non implémenté.
- GraphQL non introspectable sans session admin.
- Filtre `game` sur `tournaments.json` non confirmé : le `game_id` Beyblade X est
  **figé = 337197** (fixture `games.json` + `games-catalog.ts`), mais le param
  `game_id=337197` n'a pas restreint live (a renvoyé "Modern Warships"). Reste à
  fixer le **nom** du param de filtre (`game_id` vs `filter[game_id]`).
- `/stations` non porté.
- write v2.1 non testable sans `CHALLONGE_CLIENT_ID/SECRET`.
