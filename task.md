# task.md — Migration API-first `apps/web` (dette DAL transitive 157 → 0)

> Tableau de bord d'exécution **multi-agents parallèle**. Pilotage : [`agents.json`](./agents.json).
> Protocole de collaboration + mailbox : [`.agents/README.md`](./.agents/README.md).
> Plan de référence : `/home/ubuntu/.claude/plans/tingly-wondering-river.md`.
> Garde-fou ownership : `bun .agents/verify-ownership.ts` (disjonction + couverture).
> Dernière maj : **2026-05-29**.

## Comment l'utiliser

1. Une **lane** = un sub-agent = un domaine = un ensemble de chemins **disjoint** (`agents.json`).
2. Avant de spawn : `bun .agents/verify-ownership.ts` doit être **vert**.
3. Chaque lane suit le **gabarit en 7 étapes** (ci-dessous), coche ses cases ici, met à jour `status` dans `agents.json`.
4. Fichier d'agrégation à toucher (`index.ts`, `openapi.ts`, `check-dal-boundary.ts`, `package.json`…) → **ne pas l'éditer** : envoyer `request-wire` à la lane `integration` (cf. mailbox).
5. Gate scopé **au vert** avant chaque commit ; `git add` **uniquement** ses `owns[]`.

## Légende

`[ ]` à faire · `[~]` en cours · `[x]` fait · `[!]` bloqué
Statuts lane : `todo · active · blocked · review · done`

## Gabarit verrouillé (7 étapes par domaine)

1. **Contrat** — `packages/api-contract/src/<domaine>.ts` (Zod Select+Query+Response, réutiliser `IsoDateSchema`/`paginated()`/`okEnvelope`). → `request-wire` à `integration` pour `index.ts` + `ROUTES[]` (openapi).
2. **DAL** — `apps/web/src/server/dal/<domaine>.ts` (`import "server-only"` ; **seul** importeur `@rpbey/db` du domaine ; invariant timestamp : auth `Date`, reste string ISO).
3. **Service** (si orchestration) — `services/<domaine>.ts` : DAL + `loadJsonSafe` + métier → forme contrat. **Y placer le seam** `if (isRemote) return unwrap(await sdkFn())`.
4. **Routes** — `app/api/v1/<domaine>/route.ts` via `getRoute`/`mutationRoute` ; `export const dynamic="force-dynamic"; runtime="nodejs"`.
5. **GraphQL** (si lecture relationnelle) — resolver → DAL (déféré Phase 3 si lourd).
6. **Consommateurs** — client interactif → SDK + TanStack Query ; RSC → service ; mutation → action → DAL/SDK. `'use cache'` + `cacheTag('<domaine>:…')`, `revalidateTag` sur écriture.
7. **Gate** — `request-wire` à `integration` pour ajouter le préfixe à `ENFORCED` ; vérifier transitif vert ; déployer + smoke.

---

## Burndown de la dette

| Jalon | Dette directe | Dette transitive | Gate |
| --- | --- | --- | --- |
| Aujourd'hui (2026-05-29) | **88** | **157** | transitif activé, ENFORCED propre |
| Fin vague 1 (rankings + tournaments) | ~78 | <150 | transitif |
| Fin vague 2-3 (decks + users + gacha) | ~60 | <120 | transitif |
| Fin vague 4-5 (anime, stream, cms, analytics) | ~50 | <90 | transitif |
| Fin moderation + infra + discord-bridge | ~44 | <80 | transitif |
| Fin graphql (Phase 3) | ~43 | <70 | + `app/api/graphql/` dans ENFORCED |
| Fin auth (DERNIER) | **0** | **0** | **hard-fail global** (`ENFORCED = ["src/"]`) |

Métrique de fin : `grep -rlE "@rpbey/db|@/lib/db" apps/web/src | grep -v server/dal` → **vide** ET `bun scripts/check-dal-boundary.ts` transitif → vide.

---

## Phase 0 — Fondations & garde-fous — [x] FAIT (`3a5b787`)

- [x] gate `check-dal-boundary.ts` branché dans `bun run lint` (no-regression)
- [x] `mutationRoute`/`postRoute`(201)/`patchRoute`/`putRoute`/`deleteRoute` dans `handler.ts`
- [x] `emit-openapi.ts` + scripts `gen:api`/`dal-check`
- [x] contrat/types durcis (`b819060`) : `SearchQuerySchema`, `IsoDateSchema`, `paginated()`, +24 `*Input`

## Phase 1 — SDK + seam — [~] EN COURS

- [x] **(1)** SDK `@rpbey/api-client` généré hey-api (client-fetch + types + zod) (`578b4b2`)
- [x] **(1c)** seam `src/server/data-source.ts` (`isRemote` + `unwrap`) ; services `meta` + `global-search` branchés (`0bcd0f4`)
- [x] **gate transitif** réécrit en fermeture du graphe d'imports (157 révélés) (`0bcd0f4`)
- [x] **(1.5 stats)** `lib/stats` → `dal/stats.ts` + façade (`0bcd0f4`)
- [x] **lint oxc-only + build strict** (`dbaf22d`/`74c76ce`/`9b62f0c`/`0785287`) — ESLint retiré, `ignoreBuildErrors: false`
- [ ] **(1a)** GraphQL codegen (`@graphql-codegen` typed documents) — `apps/web/codegen.ts` _(integration)_
- [ ] **(1b)** recâbler le pilote front sur le SDK : `ComparateurClient` → `globalSearch`, bey-library → `listParts` _(search/parts)_
- [ ] **harness** : `scripts/contract-smoke.ts` (frappe chaque route migrée, valide vs Zod) _(integration)_
- [ ] **snapshot OpenAPI** figé (diff = CI rouge) _(integration)_

---

## Lanes / domaines

> Chaque section = une lane d'`agents.json`. Ordre = vagues d'exécution (dépendances).

### integration — conducteur _(lane: `integration`, status: active, dette: 0)_

Possède les **fichiers d'agrégation** ; répond aux `request-wire`.

- [~] répondre aux `request-wire` (câbler `index.ts` exports, `openapi.ts` `ROUTES[]`, `ENFORCED` prefix) en lot
- [ ] (1a) `codegen.ts` GraphQL typed documents
- [ ] `scripts/contract-smoke.ts` + snapshot `openapi.json`
- [ ] régénérer SDK (`bun run gen:api`) après chaque lot de contrats, commit sans diff non commité
- [ ] Phase 6 : flip `ENFORCED = ["src/"]` quand dette = 0 ; promouvoir `external/v1` au contrat OpenAPI

### search — recherche / comparateur _(lane: `search`, status: review, dette: 0)_

- [x] DAL `search.ts` + `recommendations.ts` ; service `global-search.ts` + seam
- [x] routes `/api/v1/{search,recommend}`
- [ ] (1b) `ComparateurClient` (client) → SDK `globalSearch` + TanStack Query
- [ ] `'use cache'` + `cacheTag('search:*')`
- [ ] confirmer préfixe dans `ENFORCED`

### parts — pièces / bey-library _(lane: `parts`, status: review, dette: 0→2)_

- [x] DAL `parts.ts` + contrat + route `/api/v1/parts[/[id]]`
- [ ] finir bey-library : sortir le `process.cwd()` (piège P2), route offset
- [ ] (1b) bey-library client → SDK `listParts`
- [ ] `actions/parts.ts` → DAL ; `(public-parts)` RSC → service
- [ ] préfixe `ENFORCED`

### rankings — classements _(lane: `rankings`, status: todo, dette: 3, vague 1)_

Réutilise `external/v1/leaderboard`. Helpers `lib/{ranking-service,auto-sync-ranking}.ts` → DAL.

- [ ] **Contrat** `rankings.ts` (SATR/WB/Stardust/global + history) → `request-wire`
- [ ] **DAL** `dal/rankings.ts` (migrer `lib/ranking-service` + `lib/auto-sync-ranking`)
- [ ] **Service** `services/rankings.ts` + seam
- [ ] **Routes** `/api/v1/rankings`, `app/api/admin/ranking`, `app/api/admin/export/rankings`
- [ ] **Actions** `ranking.ts`/`satr.ts`/`wb.ts` → DAL
- [ ] **RSC** `(marketing)/tournaments/{satr,wb,stardust}` + `(admin)/admin/{satr,wb,stardust}` → service
- [ ] `'use cache'`/`revalidateTag` + préfixe `ENFORCED`

### tournaments — tournois _(lane: `tournaments`, status: todo, dette: 7, vague 1)_

Réutilise challonge-core + `lib/discord-data` (migré ici).

- [ ] **Contrat** `tournaments.ts` (tournaments/matches/pools/participants/registrations) → `request-wire`
- [ ] **DAL** `dal/tournaments.ts` (+ migrer `lib/discord-data`)
- [ ] **Service** `services/tournaments.ts` + seam
- [ ] **Routes** `/api/v1/tournaments[/[id]/{matches,pools,participants,live,register}]` (mutations = `postRoute`)
- [ ] **Legacy** `app/api/tournaments/**`, `app/api/brackets/**`, `app/api/admin/export/tournament/**` → DAL
- [ ] **Action** `brackets.ts` (sortir `unstable_cache` → `'use cache'`)
- [ ] **RSC** `(marketing)/tournaments/[id]` + `(admin)/admin/tournaments` → service
- [ ] préfixe `ENFORCED`

### decks — decks / combos _(lane: `decks`, status: todo, dette: 4, vague 2)_

- [ ] **Contrat** `decks.ts` → `request-wire`
- [ ] **DAL** `dal/decks.ts`
- [ ] **Routes** `/api/v1/decks`, `app/api/decks/**`, `app/api/combo/**` → DAL (builder déjà sur actions)
- [ ] préfixe `ENFORCED`

### users — profils / utilisateurs _(lane: `users`, status: todo, dette: 3, vague 2)_

`stats` déjà migré (`dal/stats.ts`). Débloque `gacha` + `auth`.

- [ ] **Contrat** `users.ts` (Profile + User select public) → `request-wire`
- [ ] **DAL** `dal/users.ts`
- [ ] **Routes** `/api/v1/users/[id]/{,matches,card}`, `app/api/users/**`, `app/api/profile/**`
- [ ] **Action** `claim-profile.ts` → DAL
- [ ] **RSC** `(marketing)/profile/[id]` → service
- [ ] préfixe `ENFORCED`

### gacha — gacha + économie _(lane: `gacha`, status: todo, dette: 11, vague 3 — LE GROS)_

Helper `lib/stardust-sync-bts` → DAL. Dépend de `users`.

- [ ] **Contrat** `gacha.ts` (gacha_*, inventory, wishlist, stardust, friendships, announcements, audit) → `request-wire`
- [ ] **DAL** `dal/gacha.ts` (+ migrer `lib/stardust-sync-bts`)
- [ ] **Service** `services/gacha.ts` + seam
- [ ] **Routes** `/api/v1/gacha` + legacy `app/api/gacha/{pull,multi,duel,daily,drops,inventory,wishlist,profile,card}`, `app/api/game/inventory` (mutations = `postRoute`)
- [ ] **Actions** `gacha.ts`/`stardust.ts`/`bts.ts` → DAL
- [ ] **RSC** `dashboard/gacha/{,inventory,history,leaderboard}` → service ; `app/api/og/stardust`, `app/api/leaderboard/card`
- [ ] préfixe `ENFORCED`

### anime — anime _(lane: `anime`, status: todo, dette: 2, vague 4)_

DAL `search` a déjà `listAnimeSeries`.

- [ ] **Contrat** `anime.ts` (series/episodes/sources/progress) → `request-wire`
- [ ] **DAL** `dal/anime.ts`
- [ ] **Routes** `/api/v1/anime`, `app/api/anime/progress`
- [ ] **Actions** `anime.ts`/`anime-progress.ts` → DAL ; `(marketing)/anime` → service
- [ ] préfixe `ENFORCED`

### stream — stream / média _(lane: `stream`, status: todo, dette: 2, vague 4)_

Helper `lib/beytube` → DAL ; `lib/twitch`/`lib/tiktok` `unstable_cache` → `'use cache'`.

- [ ] **Contrat** `stream.ts` → `request-wire`
- [ ] **DAL** `dal/stream.ts` (+ migrer `lib/beytube`)
- [ ] **Service** `services/stream.ts` + seam (yt/tiktok/twitch)
- [ ] **Routes** `/api/v1/stream[/[id]]`, `app/api/stream/**`
- [ ] **Action** `stream.ts` → DAL ; `(marketing)/tv` → service ; `lib/{twitch,tiktok}` → `'use cache'`
- [ ] préfixe `ENFORCED`

### cms — contenu / staff / landing / meta _(lane: `cms`, status: todo, dette: 2, vague 5)_

- [ ] **Contrat** `cms.ts` + `meta.ts` (meta déjà servi) → `request-wire`
- [ ] **DAL** `dal/cms.ts` ; service `meta.ts` déjà branché
- [ ] **Actions** `cms.ts`/`season.ts`/`admin-meta.ts`/`admin-link.ts` → DAL
- [ ] **RSC** `(admin)/admin/{content,staff}`, `(marketing)/{notre-equipe,page.tsx}` → service
- [ ] préfixe `ENFORCED`

### analytics — analytics _(lane: `analytics`, status: todo, dette: 2, vague 5)_

Helper `lib/analytics` → DAL.

- [ ] **Contrat** `analytics.ts` (events) → `request-wire`
- [ ] **DAL** `dal/analytics.ts` (+ migrer `lib/analytics`)
- [ ] **Route** `/api/v1/analytics` (ingestion = mutation) ; `app/api/og/*` (hors stardust)
- [ ] **Action** `analytics.ts` → DAL
- [ ] préfixe `ENFORCED`

### moderation — warnings / tickets / reminders _(lane: `moderation`, status: todo, dette: 2)_

- [ ] **Contrat** `moderation.ts` → `request-wire`
- [ ] **DAL** `dal/moderation.ts`
- [ ] **Routes** `/api/v1/moderation/*`
- [ ] préfixe `ENFORCED`

### infra — health / maintenance / admin / app racine _(lane: `infra`, status: todo, dette: 2)_

- [ ] `app/api/health` → DAL léger ; `actions/maintenance.ts` → DAL
- [ ] `(admin)/admin/users`, `(admin)/admin/page.tsx` → service
- [ ] `sitemap.ts`/`robots.ts` : retirer tout accès `db` direct (passer par service)
- [ ] préfixe `ENFORCED`

### discord-bridge — BFF bot _(lane: `discord-bridge`, status: todo, dette: 2)_

`lib/bot.ts` déjà isolé (appels `:3001`).

- [ ] encapsuler les appels `:3001` derrière `/api/v1/bot/*`
- [ ] `lib/bot.ts` : typer le client, ne pas tirer `@rpbey/db`
- [ ] préfixe `ENFORCED`

### graphql — Phase 3 _(lane: `graphql`, status: blocked → après domaines, dette: 1)_

- [ ] refactorer `app/api/graphql/schema.ts` resolvers → DAL (mêmes fns que REST), **SDL inchangé**
- [ ] régénérer documents typés (codegen)
- [ ] ajouter `app/api/graphql/` à `ENFORCED` _(request-wire)_

### auth — DERNIER _(lane: `auth`, status: blocked → en dernier, dette: 4)_

⚠ Colonnes `users/accounts/sessions/verifications/twoFactors` = **`mode:"date"`** (objets `Date`). Ne pas casser better-auth.

- [ ] **Contrat** `auth.ts` (wrap `Date` ↔ ISO) → `request-wire`
- [ ] **DAL** `dal/auth.ts` (respecter `mode:"date"`)
- [ ] `lib/auth.ts` : better-auth via DAL ; `app/api/auth/**` → DAL
- [ ] préfixe `ENFORCED` → puis **dette = 0**

---

## Phase 4 — Cache Components _(après dette 0)_

- [ ] 3 `unstable_cache` (`lib/twitch`, `lib/tiktok`, `actions/brackets`) → `'use cache'`/`cacheLife`/`cacheTag`
- [ ] 2 `export const revalidate` (`(marketing)/page.tsx`, `external/v1/leaderboard`) → tags
- [ ] activer `cacheComponents` **par périmètre** validé (conserver dualité standalone-FS / Vercel-CDN)

## Phase 6 — Cutover indépendance (Vercel) _(integration)_

- [ ] `API_BASE`/`NEXT_PUBLIC_API_BASE` + endpoint GraphQL configurables (seam + data-cache CDN)
- [ ] gate **hard-fail global** : `ENFORCED = ["src/"]`, transitif → vide
- [ ] build prod front contre API distante → déployable seul Vercel

---

## Gates (référence)

| Gate | Commande |
| --- | --- |
| Type-check | `cd apps/web && bunx tsc --noEmit` |
| Lint | `cd apps/web && oxlint .` |
| Format | `bunx oxfmt <fichiers>` puis `bunx oxfmt --check` |
| Frontière DAL (transitif) | `cd apps/web && bun scripts/check-dal-boundary.ts` |
| Ownership agents | `bun .agents/verify-ownership.ts` |
| Build | `bun run build:web` |
| Tests bot | `cd apps/bot && bun test` |
| Déploiement | `bash apps/web/scripts/deploy-web.sh && sudo systemctl restart rpbey-web.service` |

## Definition of Done (par domaine)

- [ ] `tsc --noEmit` vert · `oxlint .` 0 · `oxfmt --check` clean
- [ ] `check-dal-boundary.ts` : préfixe ajouté à `ENFORCED`, **aucune régression transitive**
- [ ] `bun run gen:api` régénère SDK sans diff non commité ; `contract-smoke.ts` vert
- [ ] build + déploiement + smoke live (`/api/v1/openapi.json` valide, pages migrées 200, `curl` forme identique avant/après)
- [ ] `status: done` dans `agents.json` + envelope `done` en broadcast
