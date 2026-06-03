---
title: "Challonge.com — cartographie pour le scraper rpbey"
description: "Vue d'ensemble factuelle de challonge.com — stack, routes, accès API et scraper — pour le module @rose-griffon/challonge."
scope:
  - packages/challonge
status: "stable"
last_updated: "2026-06-02"
related_symbols:
  - ChallongeScraper
  - ChallongeApi
  - ChallongeReverse
  - BxcTransport
  - _initialStoreState
---

# Challonge.com — cartographie pour le scraper rpbey

Documentation factuelle de challonge.com du point de vue du module de scraping
`@rose-griffon/challonge` (package `packages/challonge`). Tout ce qui est ici est
vérifié soit sur les **fixtures** (`packages/challonge/tests/fixtures/`), soit en
**live** via `bxc` (curl-impersonate Chrome 131), soit sur le **code source** du
package et du bot. Les hypothèses non confirmées sont marquées comme telles.

Date de recon : 2026-05-29. Slug de test : `B_TS4` / `B_TS5` (Beyblade, organisé
sur `challonge.com/fr/B_TS4`, double elimination, 81 participants, 161 matches,
19 rounds, état `complete`).

## Vue d'ensemble de la stack

| Couche | Réalité observée |
| --- | --- |
| Edge | **Cloudflare** (anycast 104.20.17.209 / 172.66.145.188, `cf-ray …-FRA`, HTTP/2). NS `greg/elsa.ns.cloudflare.com`. Cert wildcard `*.challonge.com` (GoGetSSL DV). |
| Bot mgmt | **JS managed challenge actif** (`cf-mitigated: challenge`, `<title>Just a moment...</title>`) sur la surface SPA/HTML. Le profil curl-impersonate seul ne suffit plus sur certaines routes (voir `infra-dns-cdn.md`). |
| Backend | **Ruby on Rails** (ERB SSR + react-rails). Signatures : `<body class="<controller> <controller>-<action>">`, `meta[name=csrf-token]`, gem **gon** (`window.gon`), Turbolinks (`data-turbolinks`). PostgreSQL/Redis/Sidekiq supposés par recon (non observables, masqués par CF). |
| Frontend | **React (react-rails)** monté via `<div data-react-class="…" data-react-props="…">`. Hydratation par **stores Flux** dans `window._initialStoreState[...]` (PAS Redux, PAS un seul blob JSON). |
| Live-refresh | **Faye/Bayeux** sur `https://stream.challonge.com:8000/faye`, canal `/tournaments/<id>`. |
| API | v1 (`api.challonge.com/v1`, Basic `api:<key>`), v2.1 (OAuth2 + JSON:API, `api.challonge.com/v2.1`). GraphQL interne **non exposé publiquement** (404 une fois CF passé). |
| Assets | `assets.challonge.com` (CSS/JS), `user-assets.challonge.com` (portraits/bannières). KB sur `kb.challonge.com` (Crisp). Mail via Google + SES + Mandrill + Sendinblue (`outbound.challonge.com`, UpCloud). |

## Comment le package accède aux données

Deux chemins complémentaires (`packages/challonge/src/`) :

1. **API v1 GET** (`api.ts`, classe `ChallongeApi`) — données propres
   (tournament/participants/matches) sans challenge CF, mais nécessite une clé
   et n'expose **pas** `/log`, `/predictions`, `/announcements`.
2. **Scraper browser-less** (`reverse.ts` `ChallongeReverse`, `scraper.ts`
   `ChallongeScraper`) — via `BxcTransport` (curl-impersonate Chrome 131, bun:ffi)
   qui imite le fingerprint TLS+H2 d'un vrai Chrome pour passer Cloudflare. Lit
   les stores `_initialStoreState` et les tables HTML SSR.

L'**écriture** (création de tournoi/participants, report de scores) vit dans le
package partagé `packages/challonge/src/write.ts` (module `@rose-griffon/challonge/write`,
API v2.1 OAuth), ré-exporté côté bot par le shim `apps/bot/src/lib/challonge.ts`.
Voir `api-routes.md`.

## Les routes par fiabilité (curl-impersonate sans cookie, 2026-05-29)

| Route | Statut live | Source de données |
| --- | --- | --- |
| `/{lang}/{slug}/module` | **200, fiable** (chemin canonique) | `TournamentStore` (match graph complet) |
| `/{lang}/{slug}.json` | 200 (warm) ou **403 CF** selon le moment — instable | JSON valide = même payload que `TournamentStore` |
| `/{lang}/{slug}/standings` | 200 ou 403 CF | table HTML SSR (pas de store) |
| `/{lang}/{slug}/log[?page=N]` | 200 (flaky) ou 403 CF | `LogEntryListStore` + `ActivityFeedSettingsStore` |
| `/users/{username}` | 200 | profil SSR (medals/history) |
| `/{slug}/participants`, `/{slug}/groups` | login-wall (302 `/user_session/new`) ou 403 CF | dérivables de `/module` |
| `/` (racine), `/tournaments`, `/search` | **403 CF** (découverte gated) | — |
| `/tournaments.json` (XHR), `/games.json` | 200 transitoire puis 403 après rafale | recherche/catalogue jeux |

> Observation transverse : le gating Cloudflare est **stochastique et path-spécifique**.
> `/module` est le plus tolérant. Pacer les requêtes (≥ 4 s), maintenir un cookie
> jar (`storage/cookies/challonge_cookie.json`, **absent** actuellement), préférer
> les headers XHR `Sec-Fetch-Site: same-origin` réduisent le gating.

## Index des documents

- [`infra-dns-cdn.md`](infra-dns-cdn.md) — DNS, IPs Cloudflare, sous-domaines, TLS, ports, mail, posture bot-management.
- [`framework-stack.md`](framework-stack.md) — Rails + react-rails, asset pipeline, gon, Turbolinks, Faye, analytics, signatures de détection.
- [`api-routes.md`](api-routes.md) — table exhaustive des endpoints : v1 (api_key), v2.1 (OAuth JSON:API), routes internes front, GraphQL, recherche.
- [`pages-selectors.md`](pages-selectors.md) — par type de page : url pattern, stores, sélecteurs CSS, extractable.
- [`react-stores.md`](react-stores.md) — chaque store de `_initialStoreState` : clé, shape, sérialisation (piège JSON vs JS-literal).
- [`search-engine.md`](search-engine.md) — recherche/découverte de tournois, catalogue jeux, autocomplete, pagination.
- [`data-inventory.md`](data-inventory.md) — données déjà extraites vs manquantes, mapping fixtures, gaps.

## Sources citées dans ces docs

- **Fixtures** : `packages/challonge/tests/fixtures/{bts4_root,bts4_module,bts4_log,bts4_standings,bts4_participants}.html` + `{bts4_full,bts4_matches,bts4_participants}.json` (extraction B_TS4) ; plus `games.json` (catalogue jeux, Beyblade X = 337197), `org_landing.html`, `user_profile.html`, et un dossier `legacy/`.
- **Code package** : `packages/challonge/src/{api,reverse,scraper,types}.ts`, `src/transports/htmlrewriter.ts`, `src/extractors/react-props.ts`, `src/scrapers/bracket-svg.ts`, `src/utils/cookies.ts`.
- **Code bot** : `apps/bot/src/lib/challonge.ts` (write v2.1 OAuth).
- **bxc** : `~/bxc/src/scrapers/challonge.ts`, `~/bxc/src/cli/challonge.ts`, `~/bxc/src/api/browser.ts`, `~/bxc/src/ffi/curl-impersonate.ts`, `~/bxc/src/cookies/`.
- **Recon** : aphrody `dns_recon` + `advanced_recon` + Gemini ; probes live `bxc detect/recon/har` + `dig`/`host`/`curl_chrome131`.
