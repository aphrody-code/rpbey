# Challonge — Types de page, stores & sélecteurs CSS

Pour chaque type de page : url pattern, statut live, stores `_initialStoreState`,
`data-react-class`, sélecteurs CSS exacts, et données extractables. Vérifié sur
fixtures (primaire) + live bxc curl-impersonate Chrome 131 (2026-05-29).

> Rappel transverse : `/module` est le **seul chemin Cloudflare-tolérant fiable**.
> Les autres routes (root, `/standings`, `/participants`, `/log`, `/{slug}.json`)
> sont stochastiquement 403 CF en curl-impersonate sans cookie. Le package
> route déjà tout par `/module` (`scraper.ts:680` `extractStore`,
> `dumpChallongeRaw(slug, "module")`). Les fetchers `/log`/`/standings`/`/participants`
> retournent silencieusement `[]` sous CF tant qu'aucun cookie jar n'est présent.

## 1. Tournament root — `/{lang}/{slug}`

- URL : `https://challonge.com/fr/B_TS4`
- Live : 200 ou **403 CF** (stochastique).
- `body.class` : `tournaments tournaments-show -application-new`.
- `data-react-class="TournamentController"`.
- Stores : `TournamentStore`, `CurrentUserStore`, `ThemeStore`, `BracketSettingsStore`.
- `gon` : `adminIds`, `participantUserIdMap`, `targetingKeyValues{category,game}`, `forceDeferredCallback`.
- Méta : `meta[name=csrf-param]`, `meta[name=asset-host]`, `meta[name=stream-url]`,
  `meta[name=theme-color]`, `og:title/og:url/og:type`.
- **Préférer `/module`** (le scraper utilise `/module` pour `TournamentStore`).

## 2. Tournament module — `/{lang}/{slug}/module`

- URL : `https://challonge.com/fr/B_TS4/module`
- Live : **200 fiable** (seul path CF-tolérant). HTML ~162-221 KB.
- `body.class` : `tournaments tournaments-module`.
- `data-react-class="TournamentController"` (props `"{}"` vide en live, `{initialView,…}` en fixture).
- Store canonique : `window._initialStoreState['TournamentStore']` (single-quote +
  JSON valide en live ; double-quote + **JS-literal** dans les fixtures → voir
  [`react-stores.md`](react-stores.md) piège). Clés : `requested_plotter,
  tournament, rounds[], matches_by_round{}, third_place_match, consolation_matches[],
  groups[]`.
- Extractable : match graph complet, participants (depuis `TournamentStore` players),
  meta tournoi (40+ flags), `gon`.
- **Note SVG** : `/module` n'émet **pas** de bracket SVG serveur (0 `<svg>`, 0
  `<g class="match">` dans `bts4_module.html` et en live). Le bracket se
  reconstruit depuis `matches_by_round` (round > 0 = WB, < 0 = LB, 0 = group stage).

## 3. Bracket SVG (mode legacy/embed — absent du /module actuel)

Le parser `packages/challonge/src/scrapers/bracket-svg.ts` cible un mode de rendu
SVG **non présent** sur le `/module` courant. Sélecteurs (toujours valides si le
mode SVG réapparaît — embed/iframe/thème legacy) :

```
g.match[data-match-id][data-identifier][transform="translate(X Y)"]   # état: classe -complete|-open|-pending|-locked
  svg.match--player[data-participant-id]
    text.match--seed                          # seed
    text[class^="match--player-name"]         # nom (+ classe -winner)
    text[class^="match--player-score"]        # score
```

- `transform="translate(X Y)"` → X infère le round, Y la bracket-side en double-elim.
- Produit `BracketMatch { matchId, identifier, state, x, y, player1, player2 }`
  (coords x/y utilisées par `htmlrewriter.ts` legacy, **pas** par le mapper
  principal `scraper.ts:290`).

## 4. Group stages (round-robin)

- Même page `/module`. Données : `TournamentStore.groups[]` +
  `matches_by_round["0"]` (round 0 = group stage).
- Mode legacy HTMLRewriter (`htmlrewriter.ts:537` `parseLegacyHtml`) parse les
  tables de poule : `li.group-name`, `div.group-standings-pane table.standings tbody tr td`
  (colonnes 0=rank, 1=name(+username)/`img.portrait`, 2=`W-L-T`, 3=tb, 4=setWins,
  5=setTies, 6=pts), `a.match-report[data-match-id][data-match-state]` +
  `a.match-report div.trend-box.-win|-loss`. Sert seulement quand `TournamentStore`
  absent (rare).

## 5. Standings — `/{lang}/{slug}/standings`

- URL : `https://challonge.com/fr/B_TS4/standings`
- Live : 200 ou **403 CF**. HTML ~172-215 KB. **PAS de `_initialStoreState`** (pas de `StandingsStore`).
- `body.class` : `participants participants-standings -application-new`.
- **Aucun mount React** → table HTML SSR pure. Parser : `parseStandingsTable`
  (`scraper.ts:480` ≡ `reverse.ts:448`, dupliqué).

Sélecteurs exacts (confirmés `bts4_standings.html`) :

```
table.striped-table.-light.-padbody.limited_width.standings > tbody > tr
  td.rank > div.rank-tile.-centered.-sm > h5.lbl            # rang (entier)
  td.white.text-center.display_name > strong                # nom (peut finir par ✅, stripé)
  td.text-center > a[href*="/users/"]                        # username Challonge (challongeProfileUrl)
  a.match-report[data-match-id][data-match-state] > div.trend-box.-win|.-loss   # W/L (compte les boxes)
```

- Fixture B_TS4 : 116 `trend-box -win` / 116 `-loss` / 232 `match-report complete`.
- Le parser compte les `-win`/`-loss` pour dériver wins/losses.

## 6. Participants — `/{lang}/{slug}/participants`

- URL : `https://challonge.com/fr/B_TS4/participants`
- Live : **login-wall** (302 → `/user_session/new?continue=…participants`) ou 403 CF.
- `body.class` : `participants participants-new -application-new`.
- **Aucun mount React, aucun `_initialStoreState`**. Les lignes participant sont
  React-rendues (0 `<tr>`/`<td>` dans la coquille SSR `bts4_participants.html`).
- Données SSR sur `<div id="participant-management">` (attrs **précèdent** l'id, tag
  multi-ligne) :

```
#participant-management[data-tournament][data-rankings][data-locale][data-is-locked][data-has-ads]
```

  - `data-tournament` = `{id, state, maxParticipants, notifyUsersWhenMatchesOpen,
    isTeams, isGroups, isLocked, signupCap, url}` (JSON).
  - `data-rankings` = `[...]` (souvent `"[]"` dans la fixture).
- Parser : `reverse.ts:253` `getParticipants` (`parseJsonAttr` sur `data-tournament`
  + `data-rankings`).
- **Source autoritaire des participants** = `/module` `TournamentStore` players (sans
  login). `/participants` n'ajoute que `username`/`portrait`/`check-in`.

## 7. Log / Activity — `/{lang}/{slug}/log[?page=N]`

- URL : `https://challonge.com/fr/B_TS4/log`
- Live : 200 (flaky 2/3) ou **403 CF**. HTML ~67-110 KB.
- `body.class` : `log_entries log_entries-index -application-new`.
- `data-react-class="LogEntriesController"` (props `"{}"` vide en live).
- Stores : `window._initialStoreState['LogEntryListStore']` (**array direct**,
  opener `[`), `ActivityFeedSettingsStore` (pagination sous
  `.logEntries{currentPage,totalPages,totalCount}`), `CurrentUserStore`.
- Parser : `scraper.ts:227` `storeToLogEntries` (gère array + legacy `{entries}`/`{log}`).
  Pagination : `?page=N` (1-based), `activityFeedSettings` (`scraper.ts:271`).
- **Seule source de l'activity log** (l'API v1 ne l'expose pas).

## 8. Public JSON — `/{lang}/{slug}.json`

- URL : `https://challonge.com/fr/B_TS4.json`
- Live : 200 (warm) ou **403 CF** — **INSTABLE/RÉGRESSION**. Cloudflare gate
  désormais souvent le suffixe `.json` des pages tournoi.
- Quand 200 : JSON valide ~208 KB = même payload que `TournamentStore`. Top-keys :
  `requested_plotter, tournament, rounds, third_place_match, consolation_matches,
  matches_by_round, groups`.
- Parser : `reverse.ts:277` `getStore()`. **Path le plus sûr quand accessible**
  (JSON garanti, pas de parsing de store-state), mais 403 CF rend `getStore()`
  non fiable en 2026 → fallback `/module`.

## 9. Org / community — `<org>.challonge.com`

- Pattern : `<32hex>.challonge.com` ou nommé (`1-2smash`, `0oz`, `worldbeyblade`).
- **Non live-testé** (403 CF attendu comme la racine). Landing = liste de tournois.
- Aucun extracteur dans le package.

## 10. User profile — `/users/{username}`

- URL : `https://challonge.com/users/berserk91`
- Live : **200** (~63 KB), profil public SSR (medals/history).
- Cible des liens `challongeProfileUrl` (standings/participants).
- Aucun extracteur ni type dédié dans le package (gap).

## 11. Search / discovery — `/tournaments`

- URL : `https://challonge.com/tournaments?game_id=N&state=S&tournament_type=T&page=P`
- Live (page HTML, navigate) : **403 CF**. Seul le XHR `tournaments.json` passe
  (transitoire). Détail dans [`search-engine.md`](search-engine.md).
- Filtres : `game_id`, `state(in_progress\|ended\|pending)`,
  `tournament_type(single_elimination\|double_elimination\|round_robin\|swiss)`, `page`.

## Divergence de shape match

Le **store match** (`TournamentStore.matches_by_round`, `ChallongeMatch` bxc
`~/bxc/src/scrapers/challonge.ts:88`) imbrique `player1`/`player2` comme **objets**
(`{id, seed, display_name, portrait_url, participant_id, challonge_username,
final_rank, …}`). Le **match v1 API** (`bts4_matches.json`) utilise des `*_id` plats
+ `scores_csv`. **Deux parsers nécessaires** (voir `react-stores.md` et `data-inventory.md`).

## Gaps

- Org subdomain + user profile : structures non live-capturées (403 CF attendu).
- Aucune capture d'un tournoi qui server-render le bracket SVG (`g.match`) — les
  sélecteurs `bracket-svg.ts` restent valides en théorie mais non confirmés sur le
  site actuel ; bracket = `matches_by_round` uniquement.
- Bypass CF pour `/participants /standings /log /{slug}.json` non résolu en
  curl-impersonate seul (cookie jar / CDP requis).
- `StandingsController`/`ParticipantsController`/etc. (react-props.ts:14-22) non
  retrouvés dans fixtures/live — shapes spéculatives.
- HAR post-hydratation (XHR/GraphQL après mount React) non capturé — nécessiterait
  un vrai Chrome CDP.
