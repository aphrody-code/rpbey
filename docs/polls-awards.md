---
title: "Sondages, Tier Lists & Beyblade Awards"
description: "Système de vote communautaire de rpbey : sondages (choix unique/multiple/notation), tier lists S→F, et le concept phare Beyblade Awards France (éditions, nominés Discord/X, résultats réels 2025 importés du Google Form). Schéma DB, API, DAL, UI et invariants (enveloppe SWR, vote anonyme)."
scope:
  - packages/db
  - apps/web
status: "draft"
last_updated: "2026-06-02"
related_symbols:
  - polls
  - pollOptions
  - pollVotes
  - tierLists
  - tierListPlacements
  - awardsEditions
  - getPoll
  - votePoll
  - submitTierList
  - listPublishedEditions
---

# Sondages, Tier Lists & Beyblade Awards

Pilier « voix de la communauté » de rpbey (page `/sondages`). **API-first**, aucun
stub, invariant timestamp respecté (toutes les colonnes ici sont `mode:"string"` ISO).
Vote possible **sans compte** (cookie `anonId`) comme connecté (`userId`).

## 1. Schéma DB (migrations `0005_polls`, `0006_awards_editions`)

- **`polls`** — `id, slug (unique), question, description, category, kind
  (SINGLE|MULTIPLE|RATING), season (AnimeGeneration?), isClosed, isPublished,
  totalVotes (dénormalisé), createdById, createdAt, updatedAt`.
- **`poll_options`** — `id, pollId, label, imageUrl, displayOrder, voteCount
  (dénormalisé)`. Le pourcentage est calculé à la lecture (`voteCount / totalVotes`).
- **`poll_votes`** — `id, pollId, optionId, userId?, anonId?, createdAt`. Un votant
  (user **ou** anon) = un jeu de votes par sondage ; revoter **remplace** le précédent.
- **`tier_lists`** — `id, slug (unique), title, description, category, season,
  isPublished, …`.
- **`tier_list_subjects`** — `id, tierListId, label, imageUrl, …` (les éléments à classer).
- **`tier_list_placements`** — placement d'un votant : `subjectId → tier (S|A|B|C|D|F)`,
  scopé `userId`/`anonId` ; agrégat communautaire calculé à la lecture.
- **`awards_editions`** — `year (unique), title, description, isPublished, youtubeUrl, …`.
  Pilote l'affichage public d'une édition de Beyblade Awards.

Source : `packages/db/src/schema.ts` + `relations.ts`. Tables possédées par le rôle
`rpb`, grants à `ubuntu`. `isPublished` = visibilité publique (admin prépare en privé).

Compteurs dénormalisés (`polls.totalVotes`, `poll_options.voteCount`) recalculés par
`recomputePollCounts` après chaque vote — la lecture ne fait jamais d'agrégat live.

## 2. Surface API

### Lecture publique (`/api/v1`, enveloppe `{ ok, data }`, dans le SDK)
- `GET /api/v1/polls` — liste (filtre `category`, pagination).
- `GET /api/v1/polls/{slug}` — détail → **`{ poll }`** (option + voteCount + percent +
  `votedOptionIds` du votant courant).
- `GET /api/v1/tier-lists` — liste.
- `GET /api/v1/tier-lists/{slug}` — détail → **`{ tierList }`** (sujets + placements
  perso + agrégat).
- `GET /api/v1/awards` — éditions publiées (bandeau vidéo).

### Mutations (session better-auth **ou** cookie anonyme, hors v1)
- `POST /api/polls/{slug}/vote` — `{ optionIds }` → `{ poll }`.
- `POST /api/tier-lists/{slug}/submit` — `{ placements }` → `{ tierList }`.

### Admin (`/api/admin`, rôle admin/superadmin)
- `GET/POST /api/admin/polls` · `PATCH/DELETE /api/admin/polls/{slug}`.
- `GET/POST /api/admin/tier-lists` · `DELETE /api/admin/tier-lists/{slug}`.
- `GET /api/admin/awards` · `PATCH /api/admin/awards/{year}` (publier/cacher une édition,
  régler l'URL YouTube).

> ⚠️ **Invariant enveloppe SWR** (source de crash réel, corrigé le 2026-05-30) :
> `pollsFetcher` déballe déjà `{ ok, data }` et renvoie `data` = l'objet
> **`{ poll }`** / **`{ tierList }`**, *pas* le `PollDetail`/`TierListDetail` brut. Tout
> `useSWR` doit donc être typé `PollDetailResponse`/`TierListDetailResponse` et lire
> `data?.poll` / `data?.tierList`. Typer en `PollDetail` directement → `current.options`
> / `tierList.subjects` à `undefined` → `TypeError: …reading 'length'/'map'` → page blanche.

## 3. DAL & contrat
- DAL : `apps/web/src/server/dal/polls.ts` — `listPolls`, `getPoll`, `votePoll`,
  `listTierLists`, `getTierList`, `submitTierList`, admin (`listAdminContent`,
  `createPoll`, `updatePollAdmin`, `deletePoll`, `createTierList`, `deleteTierList`),
  éditions (`listPublishedEditions`, `listAllEditions`, `updateEdition`), et l'**annuaire
  des nominés** (`listDiscordMembers`, `listXMembers`).
- Votant : `apps/web/src/server/api/voter.ts` (`readVoter` → `{ userId? , anonId? }`,
  cookie anonyme signé).
- Contrat Zod : `packages/api-contract/src/polls.ts` (`PollDetailResponseSchema =
  { poll: PollDetail | null }`, `TierListDetailResponseSchema = { tierList: … | null }`).

### Annuaire des nominés (admin)
`listDiscordMembers` lit les membres du serveur Discord ; `listXMembers` lit la table
`community_members` du x-store (communauté « Beyblade France » `1809671339109658814`),
fallback sur l'index global. Sert l'UI `/admin/membres` (composition des nominés).
Voir **[crawl communauté X](crawling-rag-x.md)**.

## 4. Beyblade Awards France — concept phare

20 catégories rapatriées du Google Form officiel en sondages `SINGLE` natifs (catégorie
commune `"Beyblade Awards France 2025"`).

- **Édition 2025 : publique, résultats RÉELS.** Les votes du Google Form (export CSV du
  spreadsheet officiel, 64 réponses) sont agrégés par `apps/web/scripts/seed-awards-results.ts`
  (parseur CSV RFC4180, tally par réponse, top 10, `voteCount` + `totalVotes`, sondage
  **clôturé**). Ex. *Meilleur Blader* → Xymore 55 % (35 votes). Les sondages clôturés
  affichent directement les résultats (barres + trophée au gagnant).
- **Édition 2026 : cachée** (`awards_editions.isPublished = false`) — l'admin la prépare,
  compose les nominés via l'annuaire Discord/X, puis publie.

## 5. UI
- Hub : `apps/web/src/app/(marketing)/sondages` → `components/polls/SondagesHub.tsx`
  (bandeau Awards + onglets Sondages / Tier Lists + `AwardsEditionBanner` vidéo).
- Vote : `sondages/[slug]` → `PollVote.tsx` (formulaire Radio/Checkbox ou résultats).
- Tier list : `sondages/tier-list/[slug]` → `TierListBuilder.tsx` (drag/click → S→F,
  vue perso vs communauté).
- Cartes : `AwardCard`, `PollCard`, `TierListCard`.
- Admin : `/admin/sondages` (`AdminPollsManager`, `AdminPollForm`, `AdminTierListForm`,
  `AdminAwardsEditions`) ; `/admin/membres` (`MemberDirectory`).
- Navigation : « Sondages » présent dans le rail principal (`IconNav`), le groupe
  « Communauté & Site » du `DashboardShell` et « Site public » de l'`AdminShell`.

## 6. Seeds
- `seed-polls.ts` — sondages communautaires + tier lists pré-faites (saisons, types…).
- `seed-awards.ts` — les 20 catégories Awards (nominés initiaux du formulaire).
- `seed-awards-editions.ts` — éditions 2025 (publique) / 2026 (cachée) + URL YouTube.
- `seed-awards-results.ts` — **résultats réels 2025** depuis le CSV du Google Form.

## 7. SEO
Pages SSR avec métadonnées dédiées (voir **[Stratégie SEO](seo-strategy.md)**) et le
concept Awards comme contenu evergreen indexable.
