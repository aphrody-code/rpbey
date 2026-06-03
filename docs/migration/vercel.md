---
title: "Migration Site — apps/web (Next.js 16) → Vercel"
description: "Plan + procédure pour héberger le dashboard @rose-griffon/dashboard sur Vercel (team aphrody) : projet lié à apps/web, env (DATABASE_URL Neon + auth/discord/twitch), workflow deploy-vercel.yml (setup-bun canary), et découplage des exports JSON locaux (B_TS*.json, /var/www, data/)."
scope:
  - apps/web
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - DATABASE_URL
  - deploy-vercel.yml
  - next.config.ts
---

# Migration Site — apps/web (Next.js 16) → Vercel

## Cible

| Élément | Avant (VPS) | Après (cloud) |
| --- | --- | --- |
| Hébergement | systemd `rpbey-web.service` :3002, nginx `rpbey.fr`, `output: standalone` + `scripts/deploy-web.sh` | **Vercel** (team `aphrody` = `team_guWQJZI4ZmSLj2K3RWuU4VqM`), framework Next.js, root dir `apps/web` |
| DB | socket local | `DATABASE_URL` = Neon pooled (env Vercel, prod + preview) |
| Build | `bun run build:web` (Bun canary, flip `ignoreBuildErrors` cosmétique) | Vercel build (`bunVersion`/`installCommand` depuis `vercel.json`) |
| Données dashboard | exports JSON locaux (`apps/web/data/`, `B_TS*.json`), symlinks `/var/www` posés par `deploy-web.sh` | servis depuis Neon (import en DB) ou bundlés au build — voir §Découplage |
| Déploiement | manuel (`ship-web.sh`) | GitHub Action `deploy-vercel.yml` (push `main`) + `vercel deploy --prod` |

## Décisions

1. **Monorepo Vercel** : la racine du repo reste la racine du build (bun
   workspaces + turbo), `apps/web` est le **Root Directory** du projet Vercel.
   Le `Build Command` cible le filtre turbo `@rose-griffon/dashboard`.
2. **Bun canary** : lockfile bun v2 → CI et Vercel doivent utiliser Bun
   **canary** (`setup-bun` avec `bun-version: canary`). `vercel.json` épingle
   l'install/build via Bun.
3. **CI déploiement** : un workflow GitHub Actions miroir de celui de shenron —
   `setup-bun` canary + `vercel pull/build/deploy --prebuilt --prod` avec
   `$VERCEL_TOKEN`, `$VERCEL_ORG_ID`, `$VERCEL_PROJECT_ID` en secrets repo.
4. **Découplage des exports locaux** (le point dur) : le dashboard lit
   aujourd'hui des fichiers présents seulement sur le VPS (`apps/web/data/**`,
   `B_TS*.json`, symlinks `/var/www`). Sur Vercel ces chemins n'existent pas en
   FS writable. Stratégie : (a) les exports **versionnés** dans `apps/web/data/`
   sont déjà inclus dans le bundle (tracing Next) → OK en lecture ; (b) les
   données dynamiques (rankings, BTS) doivent venir de **Neon** (déjà le cas pour
   l'essentiel via `@rpbey/db`) ; (c) tout chemin `/var/www` en écriture est
   remplacé par **Vercel Blob** (`@vercel/blob`, `BLOB_READ_WRITE_TOKEN`).

## Découplage des données — détail

`B_TS*.json` (Beyblade TS series exports) vivent dans `apps/web/data/exports/`
et sont **committés** dans le repo → ils partent dans le build Vercel sans action
(lecture seule via `import`/`fs.readFile` sur le bundle). Les actions qui
**écrivent** des fichiers (`upload-store.ts`, uploads CMS) doivent cibler Vercel
Blob au lieu de `/var/www`. Les lectures de rankings passent déjà par Neon.

## Vérification

- `vercel deploy --prebuilt --prod` → URL prod renvoie **HTTP 200** sur `/`.
- Une page data-driven (`/tournaments`, `/classement`) rend sans 500 (DB Neon
  joignable depuis Vercel).

## État (Phase 2 — exécutée 2026-06-04)

- Projet Vercel **`rpbey`** créé/lié (team `aphrody`), `project_id =
  prj_1cPVtLnfepBeZSej76QkslROYnSP`, **Root Directory = `apps/web`**, framework
  Next.js, région `cdg1` (Paris).
- `apps/web/vercel.json` : `bunVersion: 1.x`, `installCommand` = install monorepo
  depuis la racine, `buildCommand` = `bun run build:vercel`
  (`next build --turbopack`, **sans** `--env-file=../../.env` qui n'existe pas
  sur Vercel — un script `build:vercel` dédié a été ajouté à `apps/web`).
- **36 env** poussées en production + preview via l'API REST Vercel (le CLI
  54.7.1 stocke des valeurs vides en pipe stdin — bug contourné).
  `DATABASE_URL` = Neon pooled, `DIRECT_DATABASE_URL` = Neon direct. Skips :
  `GOOGLE_APPLICATION_CREDENTIALS`/`REDIS_*`/`BOT_API_PORT` (local-only).
- Secrets GitHub repo : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Workflow `.github/workflows/deploy-vercel.yml` (setup-bun canary + `vercel
  pull/build/deploy --prebuilt --prod`, migrate Drizzle conditionnel sur Neon).
- **Découplage data** : déjà en place — `apps/web/src/lib/data-cache.ts` fetch
  `cdn.rpbey.fr/static/rpb-dashboard/data/*` (ISR 1h) quand `VERCEL === "1"`,
  lecture FS sinon. `B_TS*.json` & co servis par le CDN, pas le FS Vercel.
  `next.config.ts` exclut déjà `data/*` du tracing (branche `IS_VERCEL`).
- **`@rose-griffon/challonge-core/dist`** (gitignored, pas de build script) :
  prebuilt force-commité (`index.js`/`viewer.js`/scss) pour que le checkout
  Vercel résolve l'export `./viewer` (sinon MODULE_NOT_FOUND au build).

## Reste human-gated

- **Domaine `rpbey.fr`** : ajout du domaine + bascule DNS vers Vercel = étape
  manuelle (ne pas couper nginx tant que non vérifié).
- Valeurs secrètes réelles (Discord/Twitch/Auth) : déjà dans `apps/web/.env`,
  poussées via `vercel env add` (jamais commitées).
