# Challonge — Moteur de recherche / découverte de tournois

La recherche/découverte globale est la surface **la plus CF-gatée** de challonge.com.
Sans cookie jar valide (absent : `storage/cookies/challonge_cookie.json` manquant,
`CHALLONGE_COOKIE_PATH` non défini), l'IP VPS passe quelques requêtes puis se fait
hard-block (403 `cf-mitigated` / `challenge-error-text`). Les réponses 200 capturées
ci-dessous sont réelles mais transitoires.

## Endpoints confirmés live

### 1. Catalogue des jeux — `GET challonge.com/games.json`

- **200, `application/json`, ~114 KB** (CF-gated, transitoire sans cookie).
- C'est la **source autocomplete game_id**. Shape par item :

```json
{ "id": 202503, "value": "0 A.D.", "tokens": ["0", "A.D."], "permalink": "0-ad" }
```

- Mapping `game_id ↔ nom ↔ permalink`. Pour filtrer les tournois Beyblade :
  `games.filter(x => /beyblade/i.test(x.value))`. (Le `game_name` Beyblade X est
  confirmé dans les fixtures ; le `game_id` exact reste à figer depuis ce JSON quand
  l'accès est restauré — voir gaps.)

### 2. Page de recherche filtrée — `GET challonge.com/tournaments?…`

- **200, `text/html`, ~53 KB** (SSR React-hydraté, PAS du JSON). La page HTML
  `/tournaments` est **403 CF** sans cookie en navigate ; c'est le moteur public.
- Params confirmés :
  - `game_id` (entier, mappe sur `games.json`)
  - `state` ∈ `{in_progress, ended, pending}`
  - `tournament_type` ∈ `{single_elimination, double_elimination, round_robin, swiss}`
  - `page` (pagination 1-based)
- Rendu = HTML avec les mêmes patterns `data-react-class` + `window._initialStoreState[...]`
  que les pages tournoi. Le store de listing exact / les classes de cartes n'ont
  pas pu être re-capturés (CF block) — à finaliser avec cookie valide.

### 3. JSON de recherche (XHR) — `GET challonge.com/tournaments.json?…`

- **200, `application/json`** avec headers `X-Requested-With: XMLHttpRequest` +
  `Accept: application/json`. C'est l'API XHR derrière la page `/tournaments`.
- Params : `q` (texte), `page` (10 résultats/page), `state`, `game_id`.
- Shape de la réponse :

```json
{
  "next_page": true,
  "collection": [
    {
      "name": "string",
      "link": "https://worldbeyblade.challonge.com/ab0tbhd6",
      "owner": "username",
      "filter": { "id": 337197, "name": "Beyblade X" },
      "banner": "//user-assets.challonge.com/…",
      "details": "…",
      "organizer": "…"
    }
  ]
}
```

- `page_size` = 10. Pagination via `next_page: bool` + `page=N`.
- `link` peut être un subdomain org (`worldbeyblade.challonge.com/<slug>`).

### 4. Store public tournoi — `GET challonge.com/{slug}.json`

- 200 ~208 KB JSON (= `TournamentStore`) **quand non CF-gated** — instable en 2026.
  Détail dans [`pages-selectors.md`](pages-selectors.md) §8 et [`react-stores.md`](react-stores.md).

## Endpoints autocomplete — INEXISTANTS (404 confirmé)

- `/tournaments/search?q=…` → **404**
- `/tournaments/search.json` → **404**
- `/tournaments/autocomplete?term=…` → **404**
- `/autocomplete/users?term=…` → **404**
- `/games/autocomplete?term=…` → **404**
- `/users/search.json` → **500**
- `/users/autocomplete?term=…` → **403 CF** (existe probablement, gardé/mal-paramétré)

Il n'y a **pas** d'endpoint REST autocomplete dédié pour tournois/users côté front.
L'autocomplete jeu = `games.json` (liste complète, filtrage client-side via `tokens`).

> Collision de namespace : `/search?q=foo` redirige vers un tournoi si `foo` matche
> un slug (`/<slug>` capture tout).

## L'API (v1 / v2.1) ne fait PAS de recherche cross-tournoi

- v1 `list({state, type, subdomain})` (`api.ts:259`) : scopé au token, pas de
  `q`/`game_id`.
- v2.1 `listTournaments({state, page, per_page})` (`apps/bot/src/lib/challonge.ts:170`) :
  JSON:API, scopé au token, pas de `game_id`/`q`/`type`.

→ **La découverte publique de tournois Beyblade passe obligatoirement par le scraper
HTML `/tournaments?game_id=…` (ou le XHR `tournaments.json`)**, jamais par l'API.

## Recommandation pour le module

Ajouter un `searchTournaments({ gameId, state, type, page })` qui :
1. soit parse le XHR `tournaments.json` (`X-Requested-With: XMLHttpRequest`) — JSON
   propre, le plus simple ;
2. soit parse le HTML SSR `/tournaments?…` (store de listing) en fallback.

Figer une fois le `games.json` (ou au moins le `game_id` Beyblade X) en cache local.
Maintenir un cookie jar + pacer ≥ 4 s pour survivre au gating CF.

## Gaps

- IP VPS hard-block CF sur les routes listing après ~10 requêtes. La structure
  exacte des cartes de résultat de la page HTML filtrée (store key de listing,
  classes de cartes, format pagination DOM) **non re-capturée**. À finaliser via
  tunnel SOCKS (memo `project_reddit-scraper-ip-block`) ou avec cookie jar présent.
- `game_id` Beyblade X exact non figé (`games.json` 200 puis 403). `game_id=337197`
  testé mais le filtre `game_id` **n'a pas restreint** (a renvoyé "Modern Warships")
  → le bon nom de param (`game_id` vs `filter[game_id]` vs `game_name`) reste à
  confirmer pacé/avec cookie.
- HAR post-hydratation des bundles JS (pour voir un éventuel XHR autocomplete
  client-side) nécessiterait Chrome CDP (bxc fast/stealth), non lancé.
- GraphQL interne `/graphql` : 404 une fois CF passé (route absente publiquement,
  cf. `api-routes.md`).
