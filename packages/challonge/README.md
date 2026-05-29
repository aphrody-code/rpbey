# @rose-griffon/challonge

Client Challonge canonique du monorepo RPB (v4) : transports HTTP pluggables (curl-impersonate via bxc, API v1 REST, pages publiques reverse), client write v2.1 OAuth, crawler multi-page, client de recherche et schémas Zod partagés — le tout sans navigateur headless.

| Transport                                  | Quand l'utiliser                                                  | Réseau                               |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------ |
| **`ChallongeApi`** (v1 REST + clé Basic)   | Tournoi visible par la clé. Source de vérité typée.               | `fetch` natif, API non gardée par CF |
| **`ChallongeReverse`** (pages publiques)   | `/log`, `/standings`, `<slug>.json` hors API, sans clé            | `BxcTransport` (curl-impersonate)    |
| **`ChallongeScraper`** (snapshot one-shot) | Snapshot complet d'un tournoi en une passe (module + auxiliaires) | `BxcTransport` (curl-impersonate)    |
| **`ChallongeClient`** (orchestrateur)      | Façade unifiée API v1 + reverse/scraper                           | mixte                                |
| **`ChallongeWriteClient`** (v2.1 OAuth)    | Mutations (create/state/participants/matches/attachments)         | `fetch` natif (JSON:API, bundlable)  |

Tous les transports curl-impersonate passent par `BxcTransport` (`@aphrody-code/bxc`, libcurl-impersonate via `bun:ffi`, profil `chrome131`) : cache LRU, cookie jar, retry, validation d'URL et politique de redirection same-origin. **Aucun Puppeteer / Chromium n'est lancé** — la stack `puppeteer`/`puppeteer-extra`/`rebrowser` a été entièrement retirée. Le `Transport` est une interface (`./transport`) : tout transport conforme (`fetch(url, opts?)` + `close?()`) est injectable dans le scraper, le crawler et le client de recherche.

Renommé `@rpb/challonge` → `@rose-griffon/challonge` le 2026-04-26 lors de l'optimisation pré-BTS4.

## Usage rapide

### API v1 — typé, idiomatique

```ts
import { ChallongeApi } from "@rose-griffon/challonge";

const api = new ChallongeApi({ apiKey: process.env.CHALLONGE_API_KEY! });

const t = await api.get("B_TS4", {
  includeParticipants: true,
  includeMatches: true,
});

// Canonicalise (camelCase, log synthétisé depuis started_at/completed_at)
const canonical = api.toCanonical(t, { synthesizeLog: true });
console.log(canonical.participants.length, canonical.matches.length, canonical.log.length);

// Attachments v1 (read + write)
const attachments = await api.listAttachments("B_TS4", matchId);
```

### Reverse — pages publiques sans clé

```ts
import { ChallongeReverse } from "@rose-griffon/challonge";

const reverse = new ChallongeReverse();

// Store complet : tournament, matches_by_round, rounds, third_place_match…
const store = await reverse.getStore("B_TS4");

// Activity log structuré (le seul transport à exposer /log)
const entries = await reverse.getLog("B_TS4");

// Standings live
const standings = await reverse.getStandings("B_TS4");
```

### Write v2.1 — OAuth client_credentials (mutations)

```ts
import { getChallongeClient } from "@rose-griffon/challonge/write";

// Lit CHALLONGE_CLIENT_ID + CHALLONGE_CLIENT_SECRET (OAuth v2),
// sinon CHALLONGE_API_KEY (fallback v1). Header Authorization-Type: v1|v2.
const write = getChallongeClient();

await write.changeTournamentState(tournamentId, "start_underway");
await write.bulkCreateParticipants(tournamentId, participants);
await write.updateMatch(tournamentId, matchId, { scoresCsv: "3-1", winnerId });
```

Le module write n'utilise que `globalThis.fetch` (pas de bxc) : il reste bundlable. Le bot le ré-exporte via un shim (`apps/bot/src/lib/challonge.ts`).

### Crawler multi-page

```ts
import { crawlTournament, crawlOrg } from "@rose-griffon/challonge/clients/crawler";

// Frontière ordonnée : /module → /log?page=N → /standings → /participants,
// fusionnée par le mapper unifié snapshotToScrapedTournament.
const scraped = await crawlTournament("B_TS4", {
  pacingMs: 4000, // politesse entre requêtes same-host
  signal: controller.signal, // AbortSignal honoré à chaque await
  onEvent: (e) => console.log(e.kind), // crawler.page / crawler.retry
});
```

Pacing, dedup d'URL visitées, retry sur 403/429/5xx et `AbortSignal` sont gérés par le crawler ; toute la logique d'extraction est déléguée aux extracteurs P3 (aucune réimplémentation).

### Recherche + catalogue de jeux

```ts
import { searchTournaments, listGames, findGame } from "@rose-griffon/challonge/clients/search";

const { results } = await searchTournaments({ q: "beyblade x", gameId: 337197 });
const games = await listGames();
const game = await findGame("Beyblade X"); // résout un game_id stable (337197)
```

### Proxy local Bun.serve

```ts
import { startChallongeProxy } from "@rose-griffon/challonge/proxy";

await startChallongeProxy({ port: 4500, bearerToken: "xxx" });
// GET /B_TS4/store, /B_TS4/log, /B_TS4/standings, /B_TS4/participants
// LRU cache partagé, cold ~550ms, hit ~3ms
```

## Subpath exports

33 entrées (incluant la surface `.`), regroupées par thème :

```
# Surface principale
.                                  → tout le surface (rétrocompat)

# Clients API / write
./api                              → ChallongeApi (v1 REST, clé Basic) + attachments v1
./client                           → ChallongeClient (orchestrateur API + reverse/scraper)
./write                            → ChallongeWriteClient / getChallongeClient (v2.1 OAuth)
./reverse                          → ChallongeReverse (pages publiques sans clé)

# Transports
./transport                        → interface Transport (injection)
./bxc-transport                    → BxcTransport (curl-impersonate via bxc)
./curl                             → curlImpersonateGet, profils chrome131…safari260
./htmlrewriter                     → fetchAndParseModule (HTMLRewriter zero-dep)

# Cœur pluggable
./core/fetch-engine                → ImpersonatedClientEngine / NativeFetchEngine / CdpEngine
./core/cache                       → LruCache (éviction bytes + TTL)

# Scraper / mappers
./scraper                          → ChallongeScraper, dumpChallongeRaw (snapshot bxc)
./bracket-svg                      → parser bracket SVG standalone
./mappers/snapshot                 → snapshotToScrapedTournament (mapper pur, sans bxc)

# Extracteurs (purs, bundlables)
./extractors/registry              → STORE_EXTRACTORS / ROUTE_EXTRACTORS
./extractors/stores/standings      → parseStandingsTable / storeToStandings
./extractors/stores/log            → storeToLogEntries
./extractors/stores/participants   → storeToParticipants
./extractors/stores/user-profile   → parseUserProfile
./extractors/stores/org-landing    → parseOrgLanding
./extractors/stores/games-catalog  → parseGamesCatalog / findGameByName
./react-props                      → extractReactRoots, getReactRoot, readDataAttrs
./store-state                      → parseInitialStoreState

# Clients crawl / recherche
./clients/crawler                  → crawlTournament / crawlOrg
./clients/search                   → searchTournaments / listGames / findGame

# Schémas
./schemas                          → ChallongeTournamentSchema & co (validateurs Zod)

# Utilitaires
./types                            → ScrapedTournament, ScrapedMatch, …
./scores                           → normalizeSets, sumSetWinsForPlayer, …
./cookies                          → loadCookieJar, isSessionCookieValid, hasCfClearance
./retry                            → retry(), sleep(), isTransientHttpError, AbortError
./proxy                            → startChallongeProxy
./observability                    → recordEvent / withObserve (RPB_CHALLONGE_OBSERVE=1)
./shadow-mode                      → withShadowMode / deepDiff (comparaison dual-backend)
```

## Types canoniques (`./types`)

```ts
interface ScrapedMatch {
  id: number;
  identifier: string;
  round: number;
  bracketSide: "WB" | "LB" | "GF" | null; // déduit du signe du round
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  loserId: number | null;
  scores: string; // legacy "3-1,2-3,3-0"
  sets: Array<[number, number]>; // canonique
  state: string;
  forfeited: boolean | null;
  startedAt: string | null; // ISO 8601
  completedAt: string | null;
  // …
}

interface ScrapedParticipant {
  id: number;
  name: string;
  seed: number;
  ordinalSeed?: number;
  challongeUsername: string | null;
  challongeProfileUrl: string | null;
  challongeUserId: number | null;
  emailHash: string | null;
  portraitUrl: string | null;
  finalRank: number | null;
  clinched: boolean;
  metadata: Record<string, unknown> | null;
}
```

Helper `bracketSideFromRound(round, type)` : `null` si type elimination simple, sinon `'WB' | 'LB' | 'GF'`.

## Schémas Zod (`./schemas`)

Validateurs runtime alignés sur les interfaces `Scraped*` de `./types`, n'utilisant que `globalThis.fetch`/zod (aucun bxc, universellement bundlables) :

- `ChallongeTournamentSchema` (agrège `metadata` + `participants` + `matches` + `standings` + `stations` + `log`).
- `ChallongeParticipantSchema`, `ChallongeMatchSchema`, `ChallongeStandingSchema`, `ChallongeStationSchema`, `ChallongeLogEntrySchema`, `ChallongeTournamentMetadataSchema`, `ChallongeBracketSideSchema`.

Chaque schéma expose son type `z.infer<…>` correspondant (`ChallongeTournament`, `ChallongeMatch`, …).

## Helpers scores (`./scores`)

- `normalizeSets(raw)` — coerce un `scores` Challonge variable en `Array<[number, number]>`, drops les entrées malformées.
- `setsToLegacyString(sets)` — sérialise en `"3-1,2-3,3-0"` pour compat.
- `sumSetWinsForPlayer1(sets)` — W/L du point de vue du joueur 1.
- `sumSetWinsForPlayer(sets, p1Id, p2Id, targetId)` — W/L d'un joueur précis.
- `isRealMatch(sets)` — `false` pour un walkover (tous scores à 0).

## Contrat de non-régression

1. `m.loserId` non-null pour toute match `state === 'complete'` avec `winnerId`.
2. `m.sets` en 2-D — jamais aplati.
3. `result.participants[i].id` cohérent avec `m.player1Id` / `m.player2Id`.
4. `metadata.startedAt` / `metadata.completedAt` en ISO ou `null` (jamais `new Date()` fallback).
5. `synthesizeLogFromMatches` veut du **canonical** (`ScrapedMatch[]`, camelCase) — pas du `ChallongeApiMatch[]` brut. Toujours passer par `api.toCanonical(t, { synthesizeLog: true })`.

## Pièges connus

- **`api.toCanonical` obligatoire pour les timestamps** : les matches bruts API v1 sont en `snake_case` (`started_at`, `completed_at`, `player1_id`). `synthesizeLogFromMatches` lit `m.startedAt` (camelCase) — sans canonicalisation, le log est silencieusement vide.
- **`import type` ne casse rien ici** : aucune DI tsyringe / `emitDecoratorMetadata` dans ce package (contrairement au bot). `import type` est sans danger.
- **bxc = `bun:ffi` runtime-only → non bundlable** : `@aphrody-code/bxc` (libcurl-impersonate via `bun:ffi`) ne peut être ni bundlé ni externalisé par Next.js. Les chemins bxc (scraper, crawler, recherche, reverse) ne tournent que sous Bun. C'est pourquoi `apps/web` ne consomme **pas** ce package pour le scraping : il garde une copie vendorée HTMLRewriter (`apps/web/src/lib/challonge-vendor/`). Les surfaces sans bxc (`./write`, `./schemas`, `./mappers/snapshot`, `./extractors/*`, `./core/cache`) restent, elles, bundlables.
- **Cookie jar pour Reverse/Scraper** : `storage/cookies/challonge_cookie.json` doit rester valide. Refresh via le navigateur de l'admin tous les ~30 jours.
- **Profile curl-impersonate** : `chrome131` actuel. À bumper tous les ~6 mois quand Cloudflare rotate le fingerprint detection.
- **`/standings` retourne du vide en cours de tournoi double-elim** : Challonge ne calcule les ranks finaux qu'à la complétion. Comportement normal, pas un bug.
- **Champ typo Challonge** : `attached_participatable_portrait_url` (oui, "participatable"). Le mapper accepte aussi le legacy `attached_participant_portrait_url`.
- **Route module fiable** : `/{lang}/{slug}/module` (le `_initialStoreState['TournamentStore']` y est exploitable par `extractChallongeTournament`). `game_id` Beyblade X = `337197`.

## Tests

```bash
cd packages/challonge
bun test            # 299 tests / 19 fichiers / 0 fail
bunx tsc --noEmit   # baseline 0 (tsconfig durci : lib ESNext + DOM, types bun)
```

Les tests bxc (`transports-bxc-smoke`, etc.) se mettent en `skip` si le `.so` libcurl-impersonate n'est pas présent dans l'environnement. Fixtures BTS4 réelles dans `tests/fixtures/` (HTML + JSON capturés le 2026-04-26).

## Consommateurs

Le package n'est consommé que par `apps/bot` (runtime Bun → `bun:ffi` disponible). `apps/web` n'importe **pas** ce package : il utilise le package distinct `@rose-griffon/challonge-core` (viewer/modèle de brackets) plus une copie vendorée pour le scraping (`apps/web/src/lib/challonge-vendor/`).

| Fichier                                          | Surface utilisée                                   |
| ------------------------------------------------ | -------------------------------------------------- |
| `apps/bot/src/api/routes/maintenance.ts`         | `ChallongeScraper`                                 |
| `apps/bot/src/api/routes/tournaments.ts`         | API v1 + scraper/reverse (sync live)               |
| `apps/bot/src/api/routes/scrape.ts`              | `ChallongeScraper`, `dumpChallongeRaw`             |
| `apps/bot/src/lib/scrapers/challonge-scraper.ts` | ré-export du scraper canonique                     |
| `apps/bot/src/lib/challonge.ts`                  | shim ré-exportant le client write v2.1 (`./write`) |
