# Changelog — `@rose-griffon/challonge`

## v4.0.0 (2026-05-29) — Refonte modulaire (crawler + transports/engine pluggables + write v2.1 + schémas Zod)

Refonte interne en cinq phases (P1→P5). La surface publique est **préservée** : tous les ajouts sont additifs (nouveaux sub-paths, nouveaux exports), aucun consommateur existant n'a à changer. Le package passe de 13 à 33 sub-paths exportés.

### P1 — Parseur store-state unifié + interface Transport

- **`./store-state`** : `parseInitialStoreState` extrait `window._initialStoreState` une seule fois, partagé par tous les chemins d'extraction (scraper, reverse, crawler).
- **`./transport`** : interface neutre `Transport` (`fetch(url, opts?)` + `close?()`) extraite de `BxcTransport`. Permet l'injection par interface (transport conforme injectable, fake en test) sans dupliquer les types (ré-exportés sous des noms neutres).

### P2 — Mappers snapshot unifiés + injection Transport

- **`./mappers/snapshot`** : `snapshotToScrapedTournament`, mapper **pur** (zéro bxc, universellement bundlable) qui fusionne le snapshot `module` et les pièces auxiliaires (log/standings/participants) en un `ScrapedTournament` canonique unique. Le scraper et le crawler le ré-utilisent verbatim — aucune réimplémentation.
- `ChallongeScraper` accepte désormais un `Transport` injecté (défaut `BxcTransport`).

### P3 — Registry d'extracteurs + nouvelles routes publiques

- **`./extractors/registry`** : `STORE_EXTRACTORS` / `ROUTE_EXTRACTORS` + `registerRouteExtractor` / `getRouteExtractor` — table d'extracteurs purs, bundlables.
- Stores existants extraits en modules dédiés (`./extractors/stores/standings|log|participants`) et **nouveaux extracteurs** : `./extractors/stores/user-profile` (`parseUserProfile`), `./extractors/stores/org-landing` (`parseOrgLanding`), `./extractors/stores/games-catalog` (`parseGamesCatalog` / `findGameByName`).

### P4 — Crawler multi-page + recherche + FetchEngine/cache pluggables

- **`./clients/crawler`** : `crawlTournament` / `crawlOrg` — orchestration polie d'une frontière ordonnée (`/module` → `/log?page=N` → `/standings` → `/participants`) fusionnée par le mapper P2. Pacing same-host, dedup d'URL visitées, retry sur 403/429/5xx, `AbortSignal` honoré à chaque await, hook `onEvent` (`crawler.page` / `crawler.retry`).
- **`./clients/search`** : `searchTournaments` (endpoint JSON AJAX avec fallback scrape SSR), `listGames` / `findGame` (catalogue `/games.json`, cache disque P3, résolution de `game_id` stable).
- **`./core/fetch-engine`** : moteur HTTP pluggable derrière l'interface `FetchEngine` — `ImpersonatedClientEngine` (FFI bxc), `NativeFetchEngine` (`globalThis.fetch`, bundlable), `CdpEngine` (Chrome DevTools, **import dynamique lazy** : le CDP n'est chargé qu'au besoin réel).
- **`./core/cache`** : cache pluggable derrière l'interface `Cache` — `LruCache` (éviction par bytes + TTL, défauts 50 MB / 15 min).
- **Capture HAR** : `scripts/har-capture.ts` (dev-only) enregistre une session réelle et émet `data/challonge-endpoints.manifest.json` (endpoints XHR/API internes confirmés) — source de vérité versionnée des routes, rejouable.

### P5 — Client write v2.1 OAuth + attachments v1 + schémas Zod

- **`./write`** : client **write** v2.1 unifié (JSON:API, OAuth 2.0 `client_credentials`, header `Authorization-Type: v1|v2`, token bearer caché jusqu'à ~5 min de l'expiry) — extrait de `apps/bot` (mutations tournois/participants/matches). Le bot devient un **shim** (`apps/bot/src/lib/challonge.ts`) ré-exportant `getChallongeClient`. N'utilise que `globalThis.fetch` (pas de bxc) → reste bundlable. Exporté sous l'alias `ChallongeWriteClient` (collision avec le `ChallongeClient` orchestrateur de `./client`).
- **Attachments v1** sur `ChallongeApi` : `listAttachments` / `getAttachment` / `createAttachment` / `updateAttachment` / `deleteAttachment`.
- **`./schemas`** : schémas Zod partagés (`ChallongeTournamentSchema` & co), validateurs runtime alignés sur les interfaces `Scraped*` de `./types`, bundlables.

### Divers

- **tsconfig durci** : `lib: ESNext + DOM + DOM.Iterable`, `types: ["bun"]`, `strict`. La baseline `tsc --noEmit` passe de **52 à 0** erreur.
- **Tests** : 299 tests / 19 fichiers / 0 fail (les tests bxc se mettent en `skip` quand le `.so` libcurl-impersonate est absent).
- **Rétrocompat publique préservée** : aucun export retiré, aucun changement de signature ; uniquement des ajouts.

## v3.0.0 (2026-05-10) — Bxc migration

### Breaking changes (internals only, public API preserved)

- **Internals** : remplace toute la stack Puppeteer (`puppeteer 24.36`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer-core`) par `@aphrody-code/bxc` workspace dep. Le scraper utilise maintenant `BxcTransport` (curl-impersonate Chrome 131 via `bun:ffi`) au lieu de spawner Chromium.
- **Sub-paths exports** : 13 sub-paths legacy préservés (api, client, scraper, reverse, curl, htmlrewriter, react-props, types, scores, cookies, retry, proxy, transports/htmlrewriter). Nouveaux sub-paths ajoutés :
  - `./bxc-transport` — accès direct au `BxcTransport` class
  - `./bracket-svg` — parser bracket SVG standalone
  - `./observability` — JSON-structured event logger
  - `./shadow-mode` — dual-backend comparison helper
- **Class `ChallongeScraper`** : signature publique inchangée (`new ChallongeScraper(opts).scrape(slug, opts)` retourne `ScrapedTournament`). Options legacy (`headless`, `viewport`, `blockResources`, `useRebrowser`, `navigationTimeoutMs`) sont silencieusement ignorées avec un warn log — aucun browser n'est spawné.
- **`ChallongeScraper.openPage(url)`** : retourne maintenant un `FakePage` au lieu d'une `puppeteer.Page` réelle. `content()` et `evaluate(() => window._initialStoreState)` fonctionnent. Toute autre `evaluate(<JS>)` lance une erreur claire pointant vers `dumpChallongeRaw(slug, sub)`.

### Added

- **`dumpChallongeRaw(slug, sub, opts?)`** : fonction publique low-level qui retourne `{ html, store, parsed }` pour les call-sites qui faisaient du DOM evaluation arbitraire.
- **`BxcTransport`** : adapter `bun:ffi` libcurl-impersonate avec cache LRU 50 MB / 15 min, validation URL, http-to-https upgrade, same-origin redirect policy.
- **`bracket-svg.ts`** : parser standalone pour les `<g class="match">` SVG avec coords X/Y (non couvert par bxc `extractChallongeTournament`).
- **`observability.ts`** : event logger JSON stderr (opt-in via `RPB_CHALLONGE_OBSERVE=1`). Events : `transport.fetch`, `transport.cache.hit/miss`, `scraper.scrape.start/end`, `cookie.reload`, `cookie.expired`, `shadow.diff`.
- **`shadow-mode.ts`** : dual-backend comparison utility. `RPB_CHALLONGE_BACKEND=both` lance les deux backends en parallèle, log diffs via `shadow.diff` event.
- Tests : `tests/transports-bxc-smoke.test.ts`, `tests/reverse-smoke.test.ts`, `tests/htmlrewriter-regression.test.ts` (38 tests, golden vs `bts4_full.json`), `tests/scraper-fakepage.test.ts` (18 tests), `tests/proxy-smoke.test.ts`, `tests/observability.test.ts`. Total : 194 pass / 1 skip / 0 fail.

### Removed

- **Deps `puppeteer 24.36`**, **`puppeteer-extra 3.3.6`**, **`puppeteer-extra-plugin-stealth 2.11.2`**, **`rebrowser-puppeteer-core 23`**. ~300 MB de node_modules économisés.

### Performance

- **Cold start scraper** : ~150ms (vs ~3-5s Puppeteer Chromium boot). Pas de Chromium subprocess, pas de port CDP, pas de session V8.
- **RAM** : ~50-100 MB par scrape (vs ~250-400 MB Puppeteer). Le `.so` libcurl-impersonate est chargé une fois, partagé entre toutes les requests.
- **Latency `/log` paginé** : ~1-2s par page (curl-impersonate + parse stores inline) vs ~5-8s Puppeteer (boot + page.goto + waitForFunction + evaluate).

### Known limitations

- `scraped.stations = []` — le `/stations` endpoint n'est pas encore porté. Le `tournament.stations` Prisma write contient un array vide. Acceptable post-finalize (tournoi terminé) mais empêche le live-stations display si appelé pendant un tournoi en cours.
- `match.groupId = null` — non populé. Utilisé uniquement dans `finalize-tournament.ts` log breakdown (pools vs bracket). Pas d'impact DB.

### Migration guide

Voir [`MIGRATION.md`](./MIGRATION.md). En résumé :

- API publique inchangée, aucune modification de code consommateur requise.
- Pour les callers qui faisaient `scraper.openPage(url).evaluate(<JS>)` avec du JS arbitraire, switcher vers `dumpChallongeRaw(slug, sub)` qui retourne `{ html, store, parsed }`.
- Cookie jar attendu à `~/vps/storage/cookies/challonge_cookie.json` (path inchangé).
- Pour rollout progressif : `RPB_CHALLONGE_BACKEND=both pm2 restart rpb-bot`, monitor logs `shadow.diff`, puis flip à `bxc`.

## v2.0.0 (2026-04-26) — Initial canonical client

- ChallongeScraper avec puppeteer + puppeteer-extra-plugin-stealth + rebrowser-puppeteer-core.
- ChallongeApi v1 (REST officiel).
- ChallongeReverse (curl-impersonate Chrome 131 via subprocess spawn) + extractReactRoots.
- HTMLRewriter transport (Bun.HTMLRewriter pour /module group-standings).
- Bun.serve proxy local pour exposer challonge.com sans Cloudflare bypass côté caller.
- ChallongeClient unified facade.
