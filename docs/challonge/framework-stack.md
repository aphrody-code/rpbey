# Challonge — Stack applicative & signatures de détection

Confirmé via fixtures (ground truth) + recon live. challonge.com = **Ruby on Rails**
(ERB SSR) + **react-rails** SPA mounts, derrière Cloudflare. PostgreSQL + Redis +
Sidekiq supposés (recon Gemini) mais non observables : Cloudflare masque tous les
headers origin sur la réponse de challenge.

## Backend : Ruby on Rails

### Signatures HTML certaines (fixtures)

1. **Body class = convention Rails `<controller> <controller>-<action>`** :

   | Fixture | `<body class="…">` | Controller / action Rails |
   | --- | --- | --- |
   | root | `tournaments tournaments-show -application-new` | `TournamentsController#show` |
   | module | `tournaments tournaments-module` | `TournamentsController#module` |
   | log | `log_entries log_entries-index -application-new` | `LogEntriesController#index` |
   | standings | `participants participants-standings -application-new` | `ParticipantsController#standings` |
   | participants | `participants participants-new -application-new` | `ParticipantsController#new` |

   Le suffixe `-application-new` = layout. (Vérifié par `grep '<body class=' *.html`.)

2. **CSRF Rails** : `<meta name="csrf-param" content="authenticity_token" />` +
   `<meta name="csrf-token" content="…">` (`protect_from_forgery`). Le token est
   **session-bound** → ne jamais le hardcoder.

3. **Gem `gon`** (Rails → JS bridge) : `window.gon = {};` puis assignations.
   Clés observées (root) : `gon.adminIds`, `gon.participantUserIdMap`,
   `gon.targetingKeyValues`, `gon.forceDeferredCallback`. Le scraper bxc lit déjà
   `adminIds` / `participantUserIdMap` / `targetingKeyValues`. Exemple de targeting :
   `{ category: "Tabletop Game", game: "Beyblade X" }`.

4. **Turbolinks** : `<a data-turbolinks="false">` (×29 sur le root). Turbolinks
   présent (désactivé sur certains liens). Pas de Hotwire/Turbo moderne.

5. **i18n Rails** : `<html lang="fr">`, URLs locale-préfixées `/:lang/:slug`
   (canonique `/fr/B_TS4`), 28 `<link rel="alternate" hreflang>` avec
   `id="locale-<code>"` : `ar cs da de en es fi hu id it ja ko lv-lv nl no pl pt
   pt-br ro ru sk sv th tr uk vi zh-cn zh-tw`. `en` = path nu sans préfixe.
   `CurrentUserStore.locale = "fr"`.

## Asset pipeline (dual : Sprockets + Webpacker/Shakapacker)

Hébergé sur `assets.challonge.com` (`meta[name=asset-host]`). Deux pipelines
coexistent (signature Rails 6/7 + react-rails) :

- **Sprockets** (digest 64-hex) : `application-<64hex>.css`, `application-<64hex>.js`,
  `faye-browser-min-<64hex>.js`, `trumbowyg-langs/fr.min-<64hex>.js`.
- **Webpacker/Shakapacker** (`assets/packs/`, digest 64-hex, 4 chunks) :
  `vendors`, `react-shared`, `react-tournament`, `react-tournament-form`.

Ordre de chargement `<script>` (root) :
`gtag` → `js.stripe.com/v3` → `packs/vendors` → `packs/react-shared` →
`packs/react-tournament` → `packs/react-tournament-form` → `application-*.js` →
`faye-browser` → `trumbowyg-langs/fr`.

## Frontend : react-rails SPA mount

Pattern react_ujs : `<div data-react-class="…" data-react-props='…'>`. **Un seul
mount par page** :

| Page | `data-react-class` | `data-react-props` |
| --- | --- | --- |
| root + module | `TournamentController` | `{"initialView":"final-stage","allowRoundCollapsing":false,"waitForIntegrationData":false}` (fixtures) ; `"{}"` vide en live |
| log | `LogEntriesController` | `"{}"` vide en live ; entries dans le store |
| participants | **aucun mount** | — (table/coquille SSR + `#participant-management`) |
| standings | **aucun mount** | — (table HTML SSR) |

Architecture **hybride** clé pour le scraper :
- bracket / module / log → **parser le store-state JS** (`_initialStoreState`) ;
- participants / standings → **parser la table HTML SSR** (`parseStandingsTable`,
  `packages/challonge/src/scraper.ts:480` ≡ `reverse.ts:448`, dupliqué).

Le `react-props.ts` du package (`extractors/react-props.ts:14-22`) liste des
controllers supposés (`StandingsController`, `ParticipantsController`,
`StationsController`, `PredictionsController`, `AnnouncementsController`,
`BracketController`, `TournamentHeaderController`) — **non retrouvés** dans les
fixtures/live actuels : soit dépréciés, soit migrés vers `_initialStoreState` /
tables SSR. Leurs types `StandingsProps`/`ParticipantsProps` sont spéculatifs.

## Hydratation : stores Flux via `window._initialStoreState`

PAS de Redux, PAS un seul blob JSON. Initialisé :
`if (window._initialStoreState === undefined) window._initialStoreState = {};`
puis assignations incrémentales par clé. Détail complet dans
[`react-stores.md`](react-stores.md).

### Piège de sérialisation critique (vérifié sur fixtures)

Dans les fixtures B_TS4, les valeurs sont des **objets-littéraux JS** à clés
**bare-identifier** (NON quotées), pas du JSON :

```
window._initialStoreState["TournamentStore"] = {
  requested_plotter: "DoubleEliminationBracketPlotter",
  tournament: { id: 17… },
  …
};
window._initialStoreState["CurrentUserStore"] = { locale: "fr", is_superadmin: false };
window._initialStoreState["ThemeStore"] = { options: { hideSeeds: false, … } };
window._initialStoreState["BracketSettingsStore"] = { panOnSingleClick: false, … };
```

→ `JSON.parse` **échoue** sur ces blobs au top-level → `bxc extract` et le
brace-parser du package renvoient vide/throw **sur les fixtures**. Les **fixtures
sont STALE**.

En **LIVE**, le `/module` sérialise désormais du **JSON valide** (clés
single-quote `'TournamentStore'`, valeurs JSON propres) → `extractChallongeTournament`
et le brace-counter marchent. Le pipeline reste **fragile** : un retour au
JS-literal le casserait. Le path `.json` (JSON garanti par construction) est le
plus sûr quand il n'est pas CF-gated.

Le parser du package (`scraper.ts:101-171` `parseStoreState`, `reverse.ts:354-435`
`extractInitialStoreState`) gère :
- clé entre `['"]` (single OU double quote) ;
- opener `{` **et** `[` (LogEntryListStore est un array direct) via un
  **brace-counter** robuste qui tient compte des strings/escapes ;
- mais **pas** le JS-literal (clés bare) → échoue silencieusement par clé.

Le `bxc findStore` (`~/bxc/src/scrapers/challonge.ts:272`) utilise une regex
non-greedy `\{[\s\S]*?\}` + `JSON.parse` : fragile sur gros payload imbriqué et
**rate** les stores ouvrant par `[`.

## Live-refresh : Faye / Bayeux (pub-sub)

- `<meta name="stream-url" content="https://stream.challonge.com:8000/faye">`.
- JS : `new Faye.Client("https://stream.challonge.com:8000/faye")` puis
  `.subscribe("/tournaments/<id>", message => { _loadRefreshData(message.TournamentStore); _refreshTournament(); })`.
- Canal = `/tournaments/<tournament_id>` ; le serveur push un message
  `{ TournamentStore: … }` de **même shape** que l'hydratation initiale.
- Globals injectés : `window._refreshTournament`, `window._loadRefreshData`,
  `window.__CF*` (Cloudflare).

> Piste crawler temps-réel : s'abonner au canal Faye `/tournaments/<id>` donnerait
> les updates de match en push sans repoll. Non implémenté dans le package.

## Analytics / tiers (root)

- GA4 `googletagmanager.com/gtag/js?id=G-1EEPZLM6JC` + ancien UA `UA-2701080-3`.
- **Stripe.js** `js.stripe.com/v3/` (paiements pro/abos).
- **NitroPay** ads `s.nitropay.com/ads-74.js`.
- **Trumbowyg** (WYSIWYG, `langs/fr`) pour les descriptions.
- Google Fonts (`fonts.googleapis.com` ×5).
- `<meta name="theme-color" content="#272a33">`, Open Graph `og:title`/`og:url`/`og:type`.
  Pas de `twitter:card` ni JSON-LD observés dans le root (à vérifier sur autres pages).

## Récapitulatif des signatures de détection

| Type | Signature exacte |
| --- | --- |
| Backend Rails | `meta[name=csrf-param][content=authenticity_token]` + `meta[name=csrf-token]` + `window.gon` (gem gon) + `body.class = "<controller> <controller>-<action>"` |
| react-rails | `div[data-react-class][data-react-props]` (react_ujs) |
| Asset dual-pipeline | Sprockets `application-<64hex>.{css,js}` + Webpacker `assets/packs/{vendors,react-shared,react-tournament,react-tournament-form}-<64hex>.js`, host `meta[name=asset-host]` |
| Turbolinks | `<a data-turbolinks="false">` |
| i18n | `html[lang]`, `/:lang/:slug`, 28× `link[rel=alternate][hreflang][id=locale-<code>]` |
| Faye | `meta[name=stream-url]=https://stream.challonge.com:8000/faye` + `Faye.Client(...).subscribe("/tournaments/<id>")` |
| Cloudflare challenge | `cf-mitigated: challenge`, `<title>Just a moment...</title>`, CSP `challenges.cloudflare.com` |

## Gaps

- Headers origin Rails (`Set-Cookie _challonge_session`, `X-Request-Id`,
  `Server: puma/nginx`) non observables (CF les masque). PG/Redis/Sidekiq
  supposés, non prouvés.
- `ThemeStore`/`BracketSettingsStore` ont des clés bare-identifier au top-level
  (JS-literal) → `JSON.parse` échouerait, mais le scraper ne les lit pas (non bloquant).
- API live (v1/v2.1/GraphQL) : signatures dans `api-routes.md` ; GraphQL interne
  non atteignable anonyme.
- Pas de `twitter:card`/JSON-LD vérifié sur org landing / user profile (pas de
  fixture pour ces types).
