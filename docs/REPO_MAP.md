---
title: "Cartographie du monorepo (REPO_MAP)"
description: "Rôle, point d'entrée, stack et dépendances internes de chaque app/package — généré depuis les package.json."
scope:
  - apps
  - packages
status: "generated"
last_updated: "2026-05-30"
---
# Cartographie du monorepo (REPO_MAP)

> Généré par `bun scripts/docs.ts map --write`. Ne pas éditer à la main : régénéré par le script ci-dessous.
> Source de vérité : les `package.json` de `apps/*` et `packages/*`.

Index de la doc : [README.md](README.md). Total : 6 apps, 6 packages.

## Apps

| Package | Rôle | Entrée | Stack | Deps internes |
| --- | --- | --- | --- | --- |
| `@rose-griffon/bot`<br/>`apps/bot` | Discord bot for RPB community | src/index.ts | discord.js, Drizzle, tsyringe | `@rose-griffon/challonge` `@rpbey/api-contract` `@rpbey/db` `@rpbey/di` `@rpbey/discordx` `@rpbey/pagination` `@rpbey/types` |
| `cdn`<br/>`apps/cdn` | — | server.ts | — | — |
| `@rose-griffon/embed-sidecar`<br/>`apps/embed-sidecar` | — | server.ts | — | — |
| `@rose-griffon/gacha-client`<br/>`apps/gacha-client` | — | — | — | — |
| `@rose-griffon/gacha-server`<br/>`apps/gacha-server` | Serveur de jeu gacha (REST :5050) — recréé depuis le contrat client apps/bot/src/lib/gacha-api.ts. Backé par la DB partagée @rpbey/db. | — | Colyseus, Drizzle | `@rpbey/api-contract` `@rpbey/db` |
| `@rose-griffon/dashboard`<br/>`apps/web` | Dashboard officiel de la République Populaire du Beyblade | — | Next.js, React, Drizzle, better-auth, MUI, postgres-js, Zod | `@rose-griffon/challonge-core` `@rpbey/api-client` `@rpbey/api-contract` `@rpbey/db` `@rpbey/types` |

## Packages

| Package | Rôle | Entrée | Exports | Deps internes |
| --- | --- | --- | --- | --- |
| `@rpbey/api-client`<br/>`packages/api-client` | SDK TypeScript généré de l'API rpbey.fr (/api/v1) — fetch + types + validation Zod, depuis le contrat @rpbey/api-contract via @hey-api/openapi-ts. | src/index.ts | `.` `./client` | — |
| `@rpbey/api-contract`<br/>`packages/api-contract` | — | src/index.ts | `.` `./openapi` | — |
| `@rose-griffon/challonge`<br/>`packages/challonge` | Challonge client canonique (API v1 + scraper bxc curl-impersonate Chrome 131 via bun:ffi) | ./src/index.ts | 33 subpaths | — |
| `@rose-griffon/challonge-core`<br/>`packages/challonge-core` | Logique de brackets (modèle, manager, viewer) sans dépendances système | ./dist/index.js | `.` `./viewer` `./brackets-model` `./brackets-manager` `./brackets-viewer` | — |
| `@rpbey/db`<br/>`packages/db` | — | — | `.` `./schema` `./relations` `./client` | — |
| `@rpbey/types`<br/>`packages/types` | — | src/index.ts | `.` | `@rpbey/db` |

## Graphe des dépendances internes

- `@rose-griffon/bot` → `@rose-griffon/challonge`, `@rpbey/api-contract`, `@rpbey/db`, `@rpbey/di`, `@rpbey/discordx`, `@rpbey/pagination`, `@rpbey/types`
- `@rose-griffon/gacha-server` → `@rpbey/api-contract`, `@rpbey/db`
- `@rose-griffon/dashboard` → `@rose-griffon/challonge-core`, `@rpbey/api-client`, `@rpbey/api-contract`, `@rpbey/db`, `@rpbey/types`
- `@rpbey/types` → `@rpbey/db`
