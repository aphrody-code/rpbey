# Challonge — Stores `window._initialStoreState`

L'hydratation React de Challonge se fait par **stores Flux** (PAS Redux, PAS un
seul blob JSON). Chaque store est assigné individuellement :

```
if (window._initialStoreState === undefined) window._initialStoreState = {};
window._initialStoreState["TournamentStore"] = { … };
window._initialStoreState["CurrentUserStore"] = { … };
…
```

## Sérialisation — le piège #1 (vérifié sur fixtures)

| Contexte | Clé du store | Valeur | `JSON.parse` ? |
| --- | --- | --- | --- |
| **Fixtures B_TS4** | double-quote `["TournamentStore"]` | **objet-littéral JS** (clés **bare**, ex `requested_plotter:`, `tournament:`, `locale:`) | ❌ échoue (clés non quotées) |
| **Live `/module` 2026** | single-quote `['TournamentStore']` | **JSON valide** (clés quotées, valeurs JSON) | ✅ marche |

Extrait réel de `bts4_module.html` (ligne ~367) :

```
window._initialStoreState["TournamentStore"] = {
  requested_plotter: "DoubleEliminationBracketPlotter",   // <- clé bare = JS-literal
  tournament: { id: 17… },
  …
};
window._initialStoreState["CurrentUserStore"] = { locale: "fr", is_superadmin: false };
window._initialStoreState["ThemeStore"] = { options: { hideSeeds: false, … } };
window._initialStoreState["BracketSettingsStore"] = { panOnSingleClick: false, … };
```

Conséquences :
- **Fixtures STALE** : `bxc extract` + brace-parser du package renvoient vide/throw
  sur elles. Les tests basés dessus ne valident pas le format live.
- Le LIVE `/module` marche (JSON valide) mais le pipeline est **fragile** : un
  retour au JS-literal casserait tout.
- Le path `/{slug}.json` (JSON garanti par construction) serait le plus robuste —
  mais il est souvent **403 CF** en 2026 (voir `pages-selectors.md`).

### Parsers en présence

| Parser | Gère quote `['"]` | Gère opener `[` | Gère JS-literal (clés bare) |
| --- | --- | --- | --- |
| `scraper.ts:101` `parseStoreState` (brace-counter) | ✅ | ✅ | ❌ |
| `reverse.ts:354` `extractInitialStoreState` (brace-counter) | ✅ | ✅ | ❌ |
| `~/bxc/src/scrapers/challonge.ts:272` `findStore` (regex `\{[\s\S]*?\}` + JSON.parse) | ✅ | ❌ (rate `[`) | ❌ |

Les brace-counters du package sont les plus robustes (string/escape-aware) mais
restent tributaires de `JSON.parse` par clé → ignorent silencieusement une clé
malformée.

## Inventaire des stores par page

| Store | Pages | Opener | Lu par le scraper ? |
| --- | --- | --- | --- |
| `TournamentStore` | root, module | `{` | **Oui** (source #1) |
| `CurrentUserStore` | root, module, log | `{` | Partiellement |
| `ThemeStore` | root, module | `{` | Non (UI prefs) |
| `BracketSettingsStore` | root, module | `{` | Non (UI prefs) |
| `LogEntryListStore` | log | `[` (array direct) | **Oui** |
| `ActivityFeedSettingsStore` | log | `{` | **Oui** (pagination) |

(participants & standings : **aucun** `_initialStoreState` → tables SSR.)

## `TournamentStore` (le store principal)

```
{
  requested_plotter: "DoubleEliminationBracketPlotter" | "SingleEliminationBracketPlotter" | …,
  tournament: { … },                  // 22+ clés, voir ci-dessous
  rounds: [ … ],                      // métadonnée par round (round signé)
  matches_by_round: { "<roundKey>": [match, …] },  // roundKey entier signé : positif=WB, négatif=LB, 0=group stage
  third_place_match: { … } | null,
  consolation_matches: [ … ],
  groups: [ … ]                       // round-robin / group stages (typé unknown[] côté package)
}
```

### `tournament` (sous-objet, clés observées)

`id, name, state, tournament_type, quick_advance, hide_seeds, hide_identifiers,
show_station_and_time, animated, accept_attachments, participant_count_to_advance,
owner_ids, admin_ids, participants_swappable, progress_meter, group_stage_progress_meter,
grand_finals_modifier, predict_the_losers_bracket, voting_underway, is_team,
split_participants, participants_per_match, only_start_matches_with_stations`
(+ `started_at`, `completed_at`, `full_url` selon source).

### `match` (élément de `matches_by_round`)

Champs (shape store) : `id, tournament_id, identifier, round, state, player1_id,
player2_id, winner_id, loser_id, scores_csv, scheduled_time, started_at, underway_at,
completed_at, created_at, updated_at, suggested_play_order, group_id, optional,
forfeited, has_attachment, attachment_count, location, metadata, player1_metadata,
player2_metadata, player1_votes, player2_votes, player1_is_prereq_match_loser,
player2_is_prereq_match_loser, player1_prereq_match_id, player2_prereq_match_id,
prerequisite_match_ids_csv, open_graph_image_*`.

Dans le store, **`player1`/`player2` sont des OBJETS imbriqués** :
`{ id, seed, display_name, portrait_url, participant_id, challonge_username,
final_rank, attached_participatable_portrait_url, active, quick_added, misc,
integration_uids, team_members }`. (À distinguer du match v1 plat `player1_id` + `scores_csv`.)

## `CurrentUserStore`

```
{ locale: "fr", is_superadmin: false }
```

## `ThemeStore`

```
{ options: { hideSeeds: false, hideIdentifiers: …, showStationAndTime: …, participantsPerMatch: … } }
```

(Clés bare-identifier dans les fixtures → non parsé ; non lu par le scraper.)

## `BracketSettingsStore`

```
{ panOnSingleClick: false, zoomScaleOnDoubleClick: null, use100vh: …, showDetailsOnHover: … }
```

(Idem ThemeStore — UI prefs, non lu.)

## `LogEntryListStore` (array)

`window._initialStoreState['LogEntryListStore'] = [ <entry>, … ]` (opener `[`).
Entry shape (`extractors/react-props.ts:115` `ChallongeRawLogEntry`) :

```
{
  id?, key?, created_at | timestamp, type | action, description | message | text,
  user?: { id, name },
  owner?: { username, portrait_url, premier } | null,
  trackable?: {...} | null,
  textParams?: {...},
  tournament_id?
}
```

Mappé vers `ScrapedLogEntry { timestamp, type, message, who, raw }`
(`reverse.ts:180-186`, `scraper.ts:227`).

## `ActivityFeedSettingsStore` (pagination)

```
{ logEntries: { currentPage: N, totalPages: M, totalCount: K } }
```

(Layout 2026 : pagination nichée sous `.logEntries`. Layout ancien : flat à la racine.)
Lu par `activityFeedSettings` (`scraper.ts:271`) et `getLogPage`
(`reverse.ts:194-212`). Le crawler log paginé suit `?page=2..totalPages` (≤ 12
pages en parallèle, `scraper.ts:721`).

## `gon` (gem Rails, hors `_initialStoreState`)

`window.gon` (root) : `adminIds`, `participantUserIdMap`, `targetingKeyValues`
(`{category, game}`, ex `{category:"Tabletop Game", game:"Beyblade X"}`),
`forceDeferredCallback`. Lu par bxc `extractChallongeTournament`
(`~/bxc/src/scrapers/challonge.ts:573-587`).

## Stores absents / supposés

- `StandingsStore` : **absent** des pages `/standings` 2026 → fallback table HTML
  obligatoire (`storeToStandings` `scraper.ts:526` renverra `[]`, puis
  `parseStandingsTable`).
- `ParticipantsStore` : non observé ; participants via `#participant-management`
  attrs ou `/module` players.
- `StationsStore` : non observé (`/stations` non porté).

## Gaps

- Le LIVE n'a pas été re-capturé en JSON-valide cette session (CF) → la cohabitation
  fixtures-JS-literal vs live-JSON repose sur la recon de session précédente.
- `groups[]` typé `unknown[]` partout (standings de poule non dérivées séparément).
- `ThemeStore`/`BracketSettingsStore` jamais exposés (clés bare → JSON.parse KO).
