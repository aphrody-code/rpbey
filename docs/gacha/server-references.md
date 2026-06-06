---
title: "Gacha server — références (Colyseus / Discord Activity)"
description: "Liens de référence Colyseus 0.17, Discord Activity template, PixiJS et notes d'intégration réseau."
scope:
  - apps/gacha-server
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - GachaRoom
  - BunWebSockets
  - configureCors
---

# Gacha server — références (Colyseus / Discord Activity)

Le serveur de jeu gacha (`apps/gacha-server`, REST + temps réel `:5050`) et son client Discord Activity sont bâtis sur **Colyseus 0.17** (transport **Bun**) + **PixiJS** (rendu client). Liens de référence rassemblés ci-dessous.

## Colyseus — framework serveur temps réel

| Lien | Sujet |
| --- | --- |
| https://github.com/colyseus/colyseus | Dépôt principal (monorepo Colyseus) |
| https://github.com/orgs/colyseus/repositories | Tous les paquets de l'org (transports, tools, schema, auth…) |
| https://github.com/colyseus/discord-activity | **Template officiel Discord Activity** (server Colyseus + client) — base de l'intégration |
| https://docs.colyseus.io/getting-started/typescript | Mise en route serveur TypeScript |
| https://docs.colyseus.io/getting-started/react | Client React (alternative au Pixi/Vite du template) |
| https://docs.colyseus.io/getting-started/discord-activity | Build d'une Discord Activity (OAuth, URL mappings, `/colyseus`) |
| https://docs.colyseus.io/server | Config serveur — `defineServer({ rooms, express, transport })`, routes REST custom |
| https://docs.colyseus.io/state | État synchronisé — `@colyseus/schema` (`Schema`, `@type`, `MapSchema`), 64 champs max |
| https://docs.colyseus.io/database | Intégration base de données |
| https://docs.colyseus.io/tools | `@colyseus/tools` — `listen`, playground, monitor, loadtest |
| https://docs.colyseus.io/3rd-party-packages | Paquets tiers (dont **`@colyseus/bun-websockets`** = transport Bun natif) |
| https://docs.colyseus.io/roadmap | Roadmap |

### Notes d'intégration (ce qui a été retenu)
- **Transport Bun** : `@colyseus/bun-websockets` (`BunWebSockets`) — Colyseus tourne nativement sur Bun (support marqué *experimental*).
- **API 0.17** : `defineServer({ transport, rooms: { gacha: defineRoom(GachaRoom).filterBy(["channelId"]) }, express })` ; routes REST via le callback `express` (express-compatible) ; `@colyseus/auth` `JWT` pour l'auth Room ; `@colyseus/monitor` + `@colyseus/playground` (hors prod).
- **`path-to-regexp`** (via `bun-serve-express`) **n'accepte pas le wildcard `*`** → utiliser des routes paramétrées (`/api/duel/:id/:action`), jamais `/api/duel/*`.
- **Discord token-exchange** : `POST /discord_token` (mock `mock_code` en dev + OAuth réel) — minte une session Bearer dans la table `sessions` partagée + signe un JWT Colyseus.
- Template = monorepo `apps/client` (Pixi/Vite) + `apps/server` (Colyseus) ; URL mappings Discord : racine → client, `/colyseus` → serveur.

## PixiJS — rendu du client Discord Activity

| Lien | Sujet |
| --- | --- |
| https://pixijs.com | PixiJS v8 (renderer WebGL/WebGPU/Canvas) — moteur de rendu du client gacha |
| (plugin) `pixijs/pixijs-skills` | Skills Claude PixiJS v8 ajoutées au workspace pour le client |

> Le serveur recréé vit dans `apps/gacha-server` (cf. [bot.md](./bot.md) et le code). Le client Discord Activity (Pixi/React) reste à intégrer dans `apps/gacha-client` à partir du template ci-dessus.

## Déploiement & exposition réseau (Cloud Run)

Le serveur gacha est hébergé en production sur **Google Cloud Run** en europe-west3.

### Service & Ports

- Le bot consomme le serveur gacha en résolvant l'URL configurée dans `GACHA_API_URL` (qui pointe vers l'adresse HTTPS de production Cloud Run). Le fallback local `http://127.0.0.1:5050` n'est conservé que pour le développement.
- En production, Colyseus écoute sur le port fourni par `$PORT` (8080 par défaut).

### Exposition publique (Discord Activity)

- L'adresse HTTPS de Cloud Run sert de point d'entrée pour la Discord Activity. Les routes de l'Activity mappent `/api` vers l'endpoint Cloud Run du gacha-server.

### CORS

- Colyseus pose un CORS **permissif par défaut** (reflète toute origine, `ACAO: *` + credentials) via un `prependListener` HTTP de `@colyseus/core`, **avant** express → un middleware express ne suffit pas.
- `src/cors.ts` **override `matchMaker.controller.getCorsHeaders` + `DEFAULT_CORS_HEADERS`** : reflet de l'origine **uniquement** si autorisée (`config.isAllowedOrigin` : `*.discordsays.com`, `rpbey-*.vercel.app` (previews du projet uniquement), `rpbey.fr`/`bot.rpbey.fr`/`play.rpbey.fr`, localhost:3002, + `GACHA_EXTRA_ORIGINS`), sinon origine canonique fixe `rpbey.fr` (bloque le cross-origin tiers). Couvert par `test/smoke.ts`.
