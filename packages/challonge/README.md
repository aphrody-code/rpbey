> ⚠️ **INFRASTRUCTURE GÉRÉE PAR ANTIGRAVITY (GOD MODE)**
> Ce projet opère sous la **Directive Omega**. L'architecture, les dépendances, et le code sont gérés et refactorisés de manière 100% autonome. Aucune sécurité conservative n'est appliquée. La performance brute est l'unique métrique.
> \n# @rose-griffon/challonge

Client Challonge canonique du monorepo RPB. Trois transports complémentaires :

| Transport                                                | Quand l'utiliser                                               | Latence | CF-bypass             |
| -------------------------------------------------------- | -------------------------------------------------------------- | ------- | --------------------- |
| **`ChallongeApi`** (v1 REST + clé)                       | Tournoi visible par la clé. Source de vérité typée.            | ~150 ms | n/a (API non gardée)  |
| **`ChallongeReverse`** (curl-impersonate + HTMLRewriter) | Pages publiques (`/log`, `/standings`, `<slug>.json`) hors API | ~50 ms  | chrome131 fingerprint |
| **`ChallongeScraper`** (Puppeteer + stealth)             | **Fallback uniquement** — laissé pour scripts legacy           | ~3 s    | rebrowser-patches     |

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

### Proxy local Bun.serve

```ts
import { startChallongeProxy } from "@rose-griffon/challonge/proxy";

await startChallongeProxy({ port: 4500, bearerToken: "xxx" });
// GET /B_TS4/store, /B_TS4/log, /B_TS4/standings, /B_TS4/participants
// LRU cache partagé, cold ~550ms, hit ~3ms
```

### Scraper legacy (Puppeteer)

```ts
import { ChallongeScraper, sumSetWinsForPlayer, normalizeSets } from "@rose-griffon/challonge";

const scraper = new ChallongeScraper();
try {
  const result = await scraper.scrape("fr/B_TS2");
  // …
} finally {
  await scraper.close();
}
```

## Subpath exports

```
.            → tout le surface (rétrocompat)
./api        → ChallongeApi seul
./client     → ChallongeClient (orchestrateur API + scraper)
./scraper    → ChallongeScraper (Puppeteer)
./reverse    → ChallongeReverse (curl-impersonate)
./curl       → curlImpersonateGet, profiles chrome131…safari260
./react-props → extractReactRoots, getReactRoot, readDataAttrs
./types      → ScrapedTournament, ScrapedMatch, …
./scores     → normalizeSets, sumSetWinsForPlayer, …
./cookies    → loadCookieJar, isSessionCookieValid, hasCfClearance
./retry      → retry(), sleep(), isTransientHttpError, AbortError
./proxy      → startChallongeProxy
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
- **Cookie jar pour Reverse** : `storage/cookies/challonge_cookie.json` doit rester valide. Refresh via le navigateur de l'admin tous les ~30 jours.
- **Profile curl-impersonate** : `chrome131` actuel. À bumper tous les ~6 mois quand Cloudflare rotate le fingerprint detection.
- **`/standings` retourne du vide en cours de tournoi double-elim** : Challonge ne calcule les ranks finaux qu'à la complétion. Comportement normal, pas un bug.
- **Champ typo Challonge** : `attached_participatable_portrait_url` (oui, "participatable"). Le mapper accepte aussi le legacy `attached_participant_portrait_url`.

## Performance

| Op                                                               | Cold                                     | Cache hit                  |
| ---------------------------------------------------------------- | ---------------------------------------- | -------------------------- |
| `api.get(slug, {includeParticipants:true, includeMatches:true})` | ~150 ms                                  | n/a                        |
| `reverse.getStore(slug)`                                         | ~550 ms                                  | ~3 ms (LRU 15 min / 50 MB) |
| `reverse.getStandings(slug)`                                     | ~600 ms                                  | ~3 ms                      |
| `extractReactRoots(html)` (HTMLRewriter natif)                   | 8–20× plus rapide que `node-html-parser` |

## Tests

```bash
cd packages/rpb-challonge
bun test            # 100 tests / 1 451 expects / ~50 ms
bunx tsc --noEmit
```

Fixtures BTS4 réelles dans `tests/fixtures/` (HTML + JSON capturés le 2026-04-26).

## Consommateurs

| Fichier                                                 | Transport utilisé                              |
| ------------------------------------------------------- | ---------------------------------------------- |
| `apps/rpbey/src/app/api/tournaments/[id]/live/route.ts` | API v1 + Reverse                               |
| `apps/rpbey/src/server/actions/maintenance.ts`          | API v1                                         |
| `apps/rpb-bot/src/lib/challonge-sync.ts`                | API v1                                         |
| `scripts/rpb/live-tournament-sync.ts`                   | API v1 + Reverse (BTS4 live)                   |
| `scripts/rpb/scrape-bts4.ts`                            | `ChallongeClient` (API + scraper conditionnel) |
| `scripts/rpb/sync-participants-only.ts`                 | Scraper legacy (à migrer)                      |
| `scripts/rpb/import-bts3.ts`, `rescrape-bts2.ts`, etc.  | Scraper legacy (à migrer)                      |
