# task.md — Migration API-first `apps/web` — TERMINÉE (dette DAL transitive 0) — historique

> **État terminal** : la migration 157 → 0 est **faite**. `ENFORCED = ["src/"]` (flip global commité, wave-6-final `777df53`), gate transitif vert (`bun scripts/check-dal-boundary.ts` → « dette transitive : 0 » + exit 0). Ce document est conservé comme **archive d'exécution** — les seuls reliquats ouverts sont cosmétiques/outillage (codegen GraphQL, contract-smoke, recâblage SDK-client), pas de la dette DAL.
> Tableau de bord d'exécution **multi-agents parallèle**. Pilotage : [`agents.json`](./agents.json).
> Protocole de collaboration + mailbox : .agents/README.md (supprimé).
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
| Départ (2026-05-29) | 88 | 157 | transitif activé, ENFORCED propre |
| Fin vague 1 (rankings + tournaments) | ~78 | <150 | transitif |
| Fin vague 2-3 (decks + users + gacha) | ~60 | <120 | transitif |
| Fin vague 4-5 (anime, stream, cms, analytics) | ~50 | <90 | transitif |
| Fin moderation + infra + discord-bridge | ~44 | <80 | transitif |
| Fin graphql (Phase 3) | ~43 | <70 | + `app/api/graphql/` dans ENFORCED |
| **Aujourd'hui (état courant)** | **~2** (puits framework `lib/db.ts` + `lib/auth.ts`, exemptés `isSink`) | **0** | **hard-fail global** (`ENFORCED = ["src/"]`) |

Métrique de fin (celle qui fait foi) : `bun scripts/check-dal-boundary.ts` → « dette transitive : 0 » + exit 0. **Atteinte.**
(Ne pas s'appuyer sur un `grep -rlE "@rpbey/db|@/lib/db" apps/web/src | grep -v server/dal` brut : il matche encore 7 fichiers dont 5 sont des occurrences en commentaires/docstrings et 2 sont les puits framework `lib/db.ts`+`lib/auth.ts` — faux positifs, alors que le gate transitif fait foi à 0.)

---

## Phase 0 — Fondations & garde-fous — [x] FAIT (`3a5b787`)

- [x] gate `check-dal-boundary.ts` branché dans `bun run lint` (no-regression)
- [x] `mutationRoute`/`postRoute`(201)/`patchRoute`/`putRoute`/`deleteRoute` dans `handler.ts`
- [x] `emit-openapi.ts` + scripts `gen:api`/`dal-check`
- [x] contrat/types durcis (`b819060`) : `SearchQuerySchema`, `IsoDateSchema`, `paginated()`, +24 `*Input`

## Phase 1 — SDK + seam — [x] FAIT (dette DAL bouclée ; reliquats = outillage/cosmétique)

- [x] **(1)** SDK `@rpbey/api-client` généré hey-api (client-fetch + types + zod) (`578b4b2`)
- [x] **(1c)** seam `src/server/data-source.ts` (`isRemote` + `unwrap`) ; services `meta` + `global-search` branchés (`0bcd0f4`)
- [x] **gate transitif** réécrit en fermeture du graphe d'imports (157 révélés) (`0bcd0f4`)
- [x] **(1.5 stats)** `lib/stats` → `dal/stats.ts` + façade (`0bcd0f4`)
- [x] **lint oxc-only + build strict** (`dbaf22d`/`74c76ce`/`9b62f0c`/`0785287`) — ESLint retiré, `ignoreBuildErrors: false`
- [ ] **(1a)** GraphQL codegen (`@graphql-codegen` typed documents) — `apps/web/codegen.ts` **(fichier `codegen.ts` toujours manquant)** _(integration)_
- [ ] **(1b)** recâbler le pilote front sur le SDK : `ComparateurClient` → `globalSearch`, bey-library → `listParts` — **reliquat cosmétique** : les actions parts/search sont migrées (wave-6 `777df53`), dette DAL = 0 ; reste à vérifier si ces clients tapent encore un `fetch` relatif vs le SDK (seam dormant, distinct de l'objectif Vercel-standalone) _(search/parts)_
- [ ] **harness** : `scripts/contract-smoke.ts` (frappe chaque route migrée, valide vs Zod) **(fichier toujours manquant)** _(integration)_
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
- [x] Phase 6 : flip `ENFORCED = ["src/"]` (fait, wave-6-final `777df53`, dette = 0) ; [ ] promouvoir `external/v1` au contrat OpenAPI

### search — recherche / comparateur _(lane: `search`, status: review, dette: 0)_

- [x] DAL `search.ts` + `recommendations.ts` ; service `global-search.ts` + seam
- [x] routes `/api/v1/{search,recommend}`
- [ ] (1b) `ComparateurClient` (client) → SDK `globalSearch` + TanStack Query — reliquat cosmétique (dette DAL = 0)
- [ ] `'use cache'` + `cacheTag('search:*')`
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### parts — pièces / bey-library _(lane: `parts`, status: review, dette: 0→2)_

- [x] DAL `parts.ts` + contrat + route `/api/v1/parts[/[id]]`
- [ ] finir bey-library : sortir le `process.cwd()` (piège P2), route offset
- [ ] (1b) bey-library client → SDK `listParts` — reliquat cosmétique (dette DAL = 0)
- [x] `actions/parts.ts` → DAL (wave-6 `777df53`) ; `(public-parts)` RSC → service
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### rankings — classements _(lane: `rankings`, status: done, dette: 0, vague 1 `270e0dc`)_

Réutilise `external/v1/leaderboard`. Helpers `lib/{ranking-service,auto-sync-ranking}.ts` → DAL.

- [x] **Contrat** `rankings.ts` (SATR/WB/Stardust/global + history) → `request-wire`
- [x] **DAL** `dal/rankings.ts` (migrer `lib/ranking-service` + `lib/auto-sync-ranking`)
- [x] **Service** `services/rankings.ts` + seam
- [x] **Routes** `/api/v1/rankings`, `app/api/admin/ranking`, `app/api/admin/export/rankings`
- [x] **Actions** `ranking.ts`/`satr.ts`/`wb.ts` → DAL
- [x] **RSC** `(marketing)/tournaments/{satr,wb,stardust}` + `(admin)/admin/{satr,wb,stardust}` → service
- [x] `'use cache'`/`revalidateTag` + préfixe couvert par `ENFORCED = ["src/"]` (global)

### tournaments — tournois _(lane: `tournaments`, status: done, dette: 0, vague 2 `99c15f2`)_

Réutilise challonge-core + `lib/discord-data` (migré ici).

- [x] **Contrat** `tournaments.ts` (tournaments/matches/pools/participants/registrations) → `request-wire`
- [x] **DAL** `dal/tournaments.ts` (+ migrer `lib/discord-data`)
- [x] **Service** `services/tournaments.ts` + seam
- [x] **Routes** `/api/v1/tournaments[/[id]/{matches,pools,participants,live,register}]` (mutations = `postRoute`)
- [x] **Legacy** `app/api/tournaments/**`, `app/api/brackets/**`, `app/api/admin/export/tournament/**` → DAL
- [x] **Action** `brackets.ts` (sortir `unstable_cache` → `'use cache'`)
- [x] **RSC** `(marketing)/tournaments/[id]` + `(admin)/admin/tournaments` → service
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### decks — decks / combos _(lane: `decks`, status: done, dette: 0, vague 3 `1e72b51`)_

- [x] **Contrat** `decks.ts` → `request-wire`
- [x] **DAL** `dal/decks.ts`
- [x] **Routes** `/api/v1/decks`, `app/api/decks/**`, `app/api/combo/**` → DAL (builder déjà sur actions)
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### users — profils / utilisateurs _(lane: `users`, status: done, dette: 0, vague 1 `270e0dc`)_

`stats` déjà migré (`dal/stats.ts`). Débloque `gacha` + `auth`.

- [x] **Contrat** `users.ts` (Profile + User select public) → `request-wire`
- [x] **DAL** `dal/users.ts`
- [x] **Routes** `/api/v1/users/[id]/{,matches,card}`, `app/api/users/**`, `app/api/profile/**`
- [x] **Action** `claim-profile.ts` → DAL
- [x] **RSC** `(marketing)/profile/[id]` → service
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### gacha — gacha + économie _(lane: `gacha`, status: done, dette: 0, vague 4 `ee9646e` — LE GROS)_

Helper `lib/stardust-sync-bts` → DAL. Dépend de `users`.

- [x] **Contrat** `gacha.ts` (gacha_*, inventory, wishlist, stardust, friendships, announcements, audit) → `request-wire`
- [x] **DAL** `dal/gacha.ts` (+ migrer `lib/stardust-sync-bts`)
- [x] **Service** `services/gacha.ts` + seam
- [x] **Routes** `/api/v1/gacha` + legacy `app/api/gacha/{pull,multi,duel,daily,drops,inventory,wishlist,profile,card}`, `app/api/game/inventory` (mutations = `postRoute`)
- [x] **Actions** `gacha.ts`/`stardust.ts`/`bts.ts` → DAL
- [x] **RSC** `dashboard/gacha/{,inventory,history,leaderboard}` → service ; `app/api/og/stardust`, `app/api/leaderboard/card`
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### anime — anime _(lane: `anime`, status: done, dette: 0, vague 3 `1e72b51`)_

DAL `search` a déjà `listAnimeSeries`.

- [x] **Contrat** `anime.ts` (series/episodes/sources/progress) → `request-wire`
- [x] **DAL** `dal/anime.ts`
- [x] **Routes** `/api/v1/anime`, `app/api/anime/progress`
- [x] **Actions** `anime.ts`/`anime-progress.ts` → DAL ; `(marketing)/anime` → service
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### stream — stream / média _(lane: `stream`, status: done, dette: 0, vague 2 `99c15f2`)_

Helper `lib/beytube` → DAL ; `lib/twitch`/`lib/tiktok` `unstable_cache` → `'use cache'`.

- [x] **Contrat** `stream.ts` → `request-wire`
- [x] **DAL** `dal/stream.ts` (+ migrer `lib/beytube`)
- [x] **Service** `services/stream.ts` + seam (yt/tiktok/twitch)
- [x] **Routes** `/api/v1/stream[/[id]]`, `app/api/stream/**`
- [x] **Action** `stream.ts` → DAL ; `(marketing)/tv` → service ; `lib/{twitch,tiktok}` → `'use cache'`
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### cms — contenu / staff / landing / meta _(lane: `cms`, status: done, dette: 0, vague 3 `1e72b51`)_

- [x] **Contrat** `cms.ts` + `meta.ts` (meta déjà servi) → `request-wire`
- [x] **DAL** `dal/cms.ts` ; service `meta.ts` déjà branché
- [x] **Actions** `cms.ts`/`season.ts`/`admin-meta.ts`/`admin-link.ts` → DAL
- [x] **RSC** `(admin)/admin/{content,staff}`, `(marketing)/{notre-equipe,page.tsx}` → service
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### analytics — analytics _(lane: `analytics`, status: done, dette: 0, vague 3 `1e72b51`)_

Helper `lib/analytics` → DAL.

- [x] **Contrat** `analytics.ts` (events) → `request-wire`
- [x] **DAL** `dal/analytics.ts` (+ migrer `lib/analytics`)
- [x] **Route** `/api/v1/analytics` (ingestion = mutation) ; `app/api/og/*` (hors stardust)
- [x] **Action** `analytics.ts` → DAL
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### moderation — warnings / tickets / reminders _(lane: `moderation`, status: done, dette: 0, vague 4 `ee9646e`)_

- [x] **Contrat** `moderation.ts` → `request-wire`
- [x] **DAL** `dal/moderation.ts`
- [x] **Routes** `/api/v1/moderation/*`
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### infra — health / maintenance / admin / app racine _(lane: `infra`, status: done, dette: 0, vague 1 `270e0dc`)_

- [x] `app/api/health` → DAL léger ; `actions/maintenance.ts` → DAL
- [x] `(admin)/admin/users`, `(admin)/admin/page.tsx` → service
- [x] `sitemap.ts`/`robots.ts` : retirer tout accès `db` direct (passer par service)
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### discord-bridge — BFF bot _(lane: `discord-bridge`, status: done, dette: 0, vague 4 `ee9646e`)_

`lib/bot.ts` déjà isolé (appels `:3001`).

- [x] encapsuler les appels `:3001` derrière `/api/v1/bot/*`
- [x] `lib/bot.ts` : typer le client, ne pas tirer `@rpbey/db` (confirmé : `bot.ts` ne tire jamais `@rpbey/db`)
- [x] préfixe couvert par `ENFORCED = ["src/"]` (global)

### graphql — Phase 3 _(lane: `graphql`, status: done, dette: 0, vague 5-graphql `2c29606`)_

- [x] refactorer `app/api/graphql/schema.ts` resolvers → DAL (`@/server/dal/graphql`, mêmes fns que REST), **SDL inchangé**
- [ ] régénérer documents typés (codegen) — dépend de `codegen.ts` (toujours manquant)
- [x] `app/api/graphql/` couvert par `ENFORCED = ["src/"]` (global)

### auth — DERNIER _(lane: `auth`, status: done, dette: 0, vague 6-final `777df53`)_

⚠ Colonnes `users/accounts/sessions/verifications/twoFactors` = **`mode:"date"`** (objets `Date`). Ne pas casser better-auth.

- [x] **Contrat** `auth.ts` (wrap `Date` ↔ ISO) → `request-wire`
- [x] **DAL** `dal/auth.ts` (respecter `mode:"date"`), consommée par `app/api/auth/{callback/challonge,mobile/callback,magic-link}/route.ts`
- [x] `lib/auth.ts` : désormais **puits framework reconnu** (`isSink`, better-auth) — n'est plus une dette à résorber ; `app/api/auth/**` → DAL
- [x] `ENFORCED = ["src/"]` global → **dette transitive = 0**

---

## Phase 4 — Cache Components _(après dette 0)_

- [ ] 3 `unstable_cache` (`lib/twitch`, `lib/tiktok`, `actions/brackets`) → `'use cache'`/`cacheLife`/`cacheTag`
- [ ] 2 `export const revalidate` (`(marketing)/page.tsx`, `external/v1/leaderboard`) → tags
- [ ] activer `cacheComponents` **par périmètre** validé (conserver dualité standalone-FS / Vercel-CDN)

## Phase 6 — Cutover indépendance (Vercel) _(integration)_

- [ ] `API_BASE`/`NEXT_PUBLIC_API_BASE` + endpoint GraphQL configurables (seam + data-cache CDN) — seam dormant (jamais smoke-testé en standalone)
- [x] gate **hard-fail global** : `ENFORCED = ["src/"]`, transitif → vide (wave-6-final `777df53`)
- [ ] build prod front contre API distante → déployable seul Vercel _(objectif non atteint)_

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
