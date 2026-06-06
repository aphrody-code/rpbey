---
title: "Système communautaire — profils enrichis, équipes & onboarding"
description: "Architecture API-first de la transformation communautaire de rpbey : personnalisation complète du profil, système d'équipes (clans) avec membres/invitations/chat, et flow d'inscription + onboarding. Tables DB, surface API, DAL et UI."
scope:
  - packages/db
  - apps/web
status: "draft"
last_updated: "2026-06-04"
related_symbols:
  - teams
  - teamMembers
  - teamInvites
  - teamMessages
  - completeOnboarding
  - createTeam
  - upsertOwnProfile
---

# Système communautaire — profils enrichis, équipes & onboarding

Transformation de rpbey en site communautaire complet (2026-05-30). Tout est
**API-first** : schémas Zod (`@rpbey/api-contract`) → routes → DAL server-only →
SDK généré. Aucun stub. Invariant timestamp respecté (toutes les colonnes
communautaires sont `mode:"string"` ISO ; `users.*` reste `mode:"date"`).

## 1. Schéma DB (migration `0004_community`)

### Enrichissement de `profiles`
Colonnes ajoutées (toutes éditables par le propriétaire) : `displayName`,
`pronouns`, `bannerImage`, `country`, `region`, `city`, `postalCode`, `addressLine`,
`favoriteSeason` (enum `AnimeGeneration`), `favoriteBeybladeId` (FK `beyblades`,
on delete set null), `favoriteDeckId` (FK `decks`, on delete set null),
`instagramHandle`, `youtubeHandle`, `twitchHandle`, `discordHandle`, `websiteUrl`,
`accentColor`, `themePreference` (`system|light|dark`), `profileVisibility`
(`PUBLIC|MEMBERS|PRIVATE`), `showLocation`, `showSocials`, `onboardedAt`.

### Nouvelles tables (équipes / clans)
- **`teams`** — `id, slug (unique), tag (unique), name, logoUrl, bannerUrl,
  description, accentColor, region, captainId (FK users), socials (twitter/instagram/
  youtube/twitch/discordInvite/websiteUrl), isPublic, isVerified, isRecruiting,
  memberCount, totalPoints, totalWins, totalLosses, totalTournamentWins, foundedAt`.
- **`team_members`** — `id, teamId, userId (UNIQUE — un blader = une seule équipe),
  role (CAPTAIN|CO_CAPTAIN|MEMBER), jerseyNumber, position, joinedAt`.
- **`team_invites`** — `id, teamId, userId, invitedById, status
  (PENDING|ACCEPTED|DECLINED|CANCELLED), message, createdAt, respondedAt` ; unique
  `(teamId, userId)`.
- **`team_messages`** — `id, teamId, userId, content, kind
  (TEXT|SHARE_DECK|SHARE_BEY|SYSTEM), refId, attachments (jsonb), createdAt, editedAt,
  deletedAt` ; index `(teamId, createdAt)`.

Schéma source : `packages/db/src/schema.ts` + `relations.ts`. Migration SQL :
`packages/db/drizzle/0004_community.sql` (idempotente). Tables possédées par le rôle
`rpb`, grants accordés à `ubuntu` (l'app).

### Règles métier
- Un blader n'appartient qu'à **une** équipe (unicité `team_members.userId`).
- Une équipe devient **publique / listée à partir de 3 membres** (`isPublic`),
  recalculé à chaque changement de composition.
- Stats d'équipe (`totalPoints/Wins/Losses/TournamentWins`) = **agrégat des profils
  des membres**, recalculé par `recomputeTeamStats`.
- Départ du capitaine → transfert au plus ancien membre, ou dissolution si dernier.
- Localisation / réseaux d'un profil exposés **seulement** si `showLocation` /
  `showSocials` (et jamais si `profileVisibility = PRIVATE`).

## 2. Surface API

### Lecture publique (`/api/v1`, enveloppe `{ ok, data }`, dans le SDK)
- `GET /api/v1/teams` — annuaire (recherche, région, recrutement, tri, pagination).
- `GET /api/v1/teams/leaderboard` — classement par points cumulés.
- `GET /api/v1/teams/{slug}` — détail (profil + membres + stats).
- `GET /api/v1/teams/{slug}/members` — roster.
- `GET /api/v1/users/{id}` — profil public enrichi (favoris résolus, mini-équipe,
  localisation/réseaux filtrés par visibilité).

### Mutations authentifiées (session better-auth, hors v1)
- `GET/POST /api/teams` — mon équipe + invitations / créer une équipe.
- `PATCH/DELETE /api/teams/{id}` — éditer / dissoudre.
- `POST /api/teams/{id}/invite` — inviter un joueur.
- `PATCH /api/teams/{id}/members` · `DELETE …/members?userId=` — rôle/numéro/poste · exclure.
- `GET/POST /api/teams/{id}/messages` — chat d'équipe (curseur `before`).
- `POST /api/teams/leave` — quitter.
- `POST /api/teams/invites/{inviteId}` — répondre (`{ accept }`).
- `GET /api/teams/search-users?q=` — joueurs sans équipe (sélecteur d'invitation).
- `PATCH /api/profile` — patch partiel du profil (validé par `ProfileUpdateInputSchema`).
- `GET/POST /api/onboarding` — statut / finalisation de l'onboarding.

## 3. DAL & contrat
- DAL : `apps/web/src/server/dal/teams.ts` (CRUD, membres, invites, chat, agrégats) ;
  `apps/web/src/server/dal/users.ts` (`upsertOwnProfile`, `getPublicUser` enrichi,
  `completeOnboarding`).
- Contrat Zod : `packages/api-contract/src/teams.ts` + extensions de `users.ts`
  (`ProfileUpdateInputSchema`, `OnboardingInputSchema`). Routes publiques enregistrées
  dans `openapi.ts` (`ROUTES`). Régénération SDK : `bun run gen:api` (apps/web).
- Helpers HTTP : `apps/web/src/server/api/teams-http.ts` (session, mapping `TeamError`).
- Smoke runtime : `apps/web/scripts/smoke-teams.ts`
  (`bun --preload ./scripts/_preload-server-only.ts scripts/smoke-teams.ts`).

## 4. Auth & onboarding
- Page d'inscription dédiée : `apps/web/src/app/sign-up/page.tsx` (email/password +
  Discord), redirige vers l'onboarding.
- Onboarding (stepper) : `apps/web/src/app/onboarding/page.tsx` — identité (bladerName,
  username, avatar), profil de jeu (type/saison/expérience), localisation. Gate via
  `onboardedAt` (déjà onboardé → dashboard ; non connecté → connexion).

## 5. UI
- Profil éditable : `apps/web/src/app/dashboard/profile/edit/page.tsx` (identité,
  favoris, localisation, réseaux, préférences/confidentialité) + composants
  `apps/web/src/components/profile/` (BannerUpload, ProfileBanner, ProfileIdentityCard,
  ProfileSocialsRow, ProfileTeamBadge).
- Profil public : `apps/web/src/app/(marketing)/profile/[id]` (consomme
  `/api/v1/users/[id]`).
- Équipes : `apps/web/src/app/(marketing)/equipes` (annuaire + détail public, SEO) et
  `apps/web/src/app/dashboard/team` (création, membres, recrutement, chat, paramètres) +
  `apps/web/src/components/teams/`. L'annuaire porte un CTA **« Créer mon équipe »**
  (en-tête + état vide), session-aware (connecté → `/dashboard/team` où vit
  `CreateTeamForm`, sinon → `/sign-in`).
- Navigation : « Équipes » et « Sondages » sont présents dans le rail principal
  (`IconNav`), le groupe **« Communauté & Site »** du `DashboardShell` (le dashboard
  n'est plus un cul-de-sac) et **« Site public »** de l'`AdminShell`. « Mon équipe »
  reste dans le menu perso du dashboard.

## 6. SEO
Voir **[Stratégie SEO](seo-strategy.md)** — les pages équipes/profils sont rendues SSR
avec métadonnées et données structurées, à l'inverse des concurrents (CSR sans sitemap).

## 7. Sondages, Tier Lists & Awards
Pilier de vote communautaire (page `/sondages`) traité dans son propre document :
**[Sondages, Tier Lists & Beyblade Awards](polls-awards.md)**.
