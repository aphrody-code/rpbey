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

## Déploiement & exposition réseau

### Service

- systemd **`rpbey-gacha.service`** (`apps/gacha-server/deploy/rpbey-gacha.service`) — `bun src/index.ts`, bind **`127.0.0.1:5050`** (loopback), partage `apps/bot/.env` (AUTH_SECRET pour le JWT Colyseus). DB via le socket local (défauts `@rpbey/db`, aucune var requise). Durcissement JIT-safe (cf. unité). `enable --now`.
- Le bot consomme le serveur en **loopback** (`GACHA_API_URL` défaut `http://127.0.0.1:5050`) — aucun port public requis pour ce chemin.

### Ports / proxy public (Discord Activity)

- `5050` reste **loopback** (jamais exposé brut ; pas d'entrée ufw).
- Exposition HTTPS/WSS via **nginx `api.rpbey.fr`** → `location /gacha/` (snippet `apps/gacha-server/deploy/nginx-gacha.location.conf`, upstream `gacha_rt`). Préfixe `/gacha/` retiré, upgrade WebSocket (`$connection_upgrade`), placé avant le `location /` du bot (:3001).
  - REST : `https://api.rpbey.fr/gacha/api/gacha/*` · Token : `…/gacha/discord_token` · WS : `wss://api.rpbey.fr/gacha/...`

### CORS

- Colyseus pose un CORS **permissif par défaut** (reflète toute origine, `ACAO: *` + credentials) via un `prependListener` HTTP de `@colyseus/core`, **avant** express → un middleware express ne suffit pas.
- `src/cors.ts` **override `matchMaker.controller.getCorsHeaders` + `DEFAULT_CORS_HEADERS`** : reflet de l'origine **uniquement** si autorisée (`config.isAllowedOrigin` : `*.discordsays.com`, `*.vercel.app`, `rpbey.fr`/`bot.rpbey.fr`/`play.rpbey.fr`, localhost:3002, + `GACHA_EXTRA_ORIGINS`), sinon origine canonique fixe `rpbey.fr` (bloque le cross-origin tiers). Couvert par `test/smoke.ts`.
