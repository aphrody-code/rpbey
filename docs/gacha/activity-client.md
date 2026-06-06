---
title: "Client Discord Activity gacha — `apps/gacha-client` (PixiJS v8)"
description: "Client de jeu gacha embarqué dans Discord (Activity) : rendu PixiJS pixel-perfect des frames d'anime, scène de pull/reveal, Colyseus temps réel, auth Embedded App SDK, build Vite/Bun, déploiement play.rpbey.fr."
scope:
  - apps/gacha-client
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - GachaApp
  - RevealScene
  - CardView
  - GachaRoomClient
  - fitCover
  - snapDevice
  - proxifyUrl
---

# Client Discord Activity gacha — `apps/gacha-client` (PixiJS v8)

App web autonome (Vite + PixiJS v8) servie sur **`play.rpbey.fr`**, embarquée dans Discord comme **Activity** (Embedded App). Rendu canvas WebGL des frames d'anime + scène de tirage/révélation. Consomme le **serveur gacha** (`apps/gacha-server` `:5050`, REST + Colyseus) et le **web** (`rpbey.fr`, frames anime + image carte OG). Bun-only (`bun run dev` / `bun run build`).

> Le serveur, l'auth `/discord_token` et la room Colyseus existent déjà — voir [server.md](./server.md). Ce client est leur consommateur côté navigateur.

## Arborescence

| Fichier | Rôle |
| --- | --- |
| `index.html` | Shell minimal : `#app` (canvas) + splash `#boot`. Assets en chemins **relatifs** (`<script src="/src/main.ts">`, `base: "./"`) pour le proxy Discord |
| `vite.config.ts` | Build Vite (`base: "./"`, `outDir: dist`, manualChunks pixi/colyseus/discord) |
| `src/main.ts` | Entrypoint : monte `GachaApp` dans `#app` |
| `src/app.ts` | `GachaApp` — init Application pixel-perfect, monte les scènes, auth + room, câble les pulls |
| `src/env.ts` | Config build-time (`import.meta.env`), détection Discord (`IS_DISCORD`), `proxifyUrl()` |
| `src/types.ts` | Miroir du contrat serveur (`PullResult`, `MultiPullResult`, `DailyResult`, `GachaBalance`, `AnimeFrame`…) — **dupliqué** pour ne pas tirer Drizzle/Zod dans le bundle |
| `src/theme.ts` | Thème par rareté (couleur/halo/étoiles/intensité FX) + couleurs de marque (aurore rouge↔bleu) |
| `src/net/auth.ts` | Auth Discord (`DiscordSDK.authorize` → `/discord_token`) + fallback navigateur (`mock_code`) |
| `src/net/api.ts` | Client REST économie (Bearer) + frames anime + URL image carte |
| `src/net/room.ts` | `GachaRoomClient` — join Colyseus `gacha`, écoute `players` (HUD), relaie `pull:result`/`daily:result` |
| `src/render/fit.ts` | **Cœur pixel-perfect** : `dpr()`, `snapDevice()`, `fitCover()`, `fitContain()`, `rect16x9()` |
| `src/render/assets.ts` | `loadFrameTexture` (linear+mipmaps), `loadPixelTexture` (nearest), via `Assets.load` |
| `src/render/tween.ts` | `Tweener` ticker-based (aucune lib externe) + easings |
| `src/scenes/Background.ts` | Aurore de marque + frame d'anime notable (fitCover plein écran) |
| `src/scenes/CardView.ts` | Carte révélée : art (fitContain 2:3), bordure rareté, étoiles, halo, shine holo |
| `src/scenes/Particles.ts` | Burst de paillettes SR+ (`ParticleContainer`, 1 draw call) |
| `src/scenes/RevealScene.ts` | Orchestration reveal : carte unique OU grille ×10, FX par rareté |
| `src/scenes/Hud.ts` | Bandeau (nom/solde/pity) + boutons pull ×1 / ×10 / daily |

## Rendu pixel-perfect (DPR / scaleMode / mipmap)

Quatre garanties combinées, toutes vérifiables dans le code :

1. **Application haute densité** (`app.ts` `start()`) :
   ```ts
   await app.init({
     resizeTo: window,
     resolution: dpr(),        // = devicePixelRatio (clampé 1..4)
     autoDensity: true,        // canvas dimensionné en px CSS, backing-store en px device
     antialias: true,
     backgroundAlpha: 1,
     preference: "webgl",
     roundPixels: true,        // alignement entier global des quads
   });
   ```
   Mesuré headless : viewport 900×600 @ DPR=2 → `canvas.width/height = 1800×1200`, `clientWidth/Height = 900×600`. Le renderer dessine donc en pixels physiques → image nette en HD.

2. **Fit sans déformation + snap device** (`render/fit.ts`) : `fitCover`/`fitContain` appliquent un **scale uniforme** (même facteur X/Y) → ratio natif strictement préservé, jamais d'étirement. La position finale est arrondie sur la grille de pixels device par `snapDevice(css, dpr) = round(css·dpr)/dpr` → le sprite tombe sur un pixel physique entier (pas de filtrage bilinéaire flou induit par un offset fractionnaire de DPR). `roundPixels = true` est posé sur chaque sprite cadré.

3. **scaleMode des frames** (`render/assets.ts`) : les frames d'anime (photographiques) sont chargées via `Assets.load({ parser: "texture", data: { scaleMode: "linear", autoGenerateMipmaps: true } })`. Le downscale d'une frame HD (1280×720) vers la taille viewport passe par les **mip-levels** → zéro scintillement/aliasing. Option `loadPixelTexture` (scaleMode `nearest`, sans mipmaps) pour un rendu rétro net si pixel-art. `TextureStyle.defaultOptions.scaleMode = "linear"` est posé au boot comme défaut cohérent.

4. **Aspect 16:9** (`rect16x9`) : helper renvoyant le plus grand rectangle 16:9 (1280×720) centré dans un viewport quelconque (carré/portrait Discord), coins snappés device.

## Flux d'auth

```
IS_DISCORD ? authViaDiscord() : authMock()

authViaDiscord (dans Discord) :
  new DiscordSDK(VITE_DISCORD_CLIENT_ID) → ready()
  → commands.authorize({ scope: [identify, rpc.activities.write] }) → { code }
  → POST /discord_token { code }                         (serveur gacha)
  → { token (JWT Colyseus), gacha_token (Bearer), gacha_user_id, access_token, user }
  → commands.authenticate({ access_token })

authMock (navigateur, dev/QA) :
  POST /discord_token { code: "mock_code" } → session anonyme de test
```

Aucun secret en dur : seul le **Client ID public** (`VITE_DISCORD_CLIENT_ID`) est embarqué. Le `client_secret` reste côté serveur (`/discord_token`). Le `gacha_token` (Bearer) sert les appels REST économie ; le `token` (JWT) authentifie la room Colyseus.

### Proxy Discord (CSP)

Dans le client Discord, tout le réseau passe par `/.proxy/<mapping>/...`. `env.ts` détecte le contexte (`frame_id` en query ou hôte `*.discordsays.com`) et `proxifyUrl(absolute, mapping)` réécrit les URL absolues : `api` → serveur gacha (`api.rpbey.fr`), `web` → `rpbey.fr`. Hors Discord, les URL absolues sont utilisées telles quelles.

## Variables d'environnement (build-time, préfixe `VITE_`)

| Var | Défaut | Rôle |
| --- | --- | --- |
| `VITE_DISCORD_CLIENT_ID` | `""` | Application (Client) ID du Dev Portal — requis dans Discord |
| `VITE_GACHA_WS_URL` | `wss://api.rpbey.fr/gacha` | Endpoint Colyseus |
| `VITE_GACHA_REST_URL` | `https://api.rpbey.fr/gacha` | Base REST économie + `/discord_token` |
| `VITE_WEB_BASE` | `https://rpbey.fr` | Frames anime (`/api/v1/anime/frames`) + image carte (`/api/gacha/card`) |

Les défauts pointent prod → le build marche sans `.env`. Un `.env.local` (gitignoré par Vite) surcharge pour le dev local (p. ex. `VITE_GACHA_WS_URL=ws://127.0.0.1:5050`).

## Scène de pull / reveal

- **Pull ×1** : bouton → `GachaRoomClient.pull()` (message Colyseus `pull`) si la room est connectée, sinon REST `POST /api/gacha/pull` en fallback. La réponse (`PullResult`) déclenche `RevealScene.showSingle()` : carte centrée, flip-in + pop (`Ease.outBack`), shine holo (SR+), burst de particules teintées (SUPER_RARE+).
- **Pull ×10** : REST `POST /api/gacha/pull10` (`MultiPullResult`) → `RevealScene.showGrid()` : grille 5×N, révélations en cascade (stagger 90 ms), burst sur chaque SR+.
- **Daily** : message `daily` (room) ou REST `/api/gacha/daily` → statut HUD.
- FX par rareté (`theme.ts`) : halo radial (anneaux), bordure simple/double, étoiles 1→5, intensité 0.15→1.

## Connexion Colyseus

`GachaRoomClient.join(jwt, userId, channelId?)` → `client.joinOrCreate("gacha", { token: jwt, channelId })`. Écoute `state.players` (`onAdd`/`onChange`/balayage initial), filtre le `PlayerState` dont `userId == le nôtre`, pousse `{ currency, pity, name }` au HUD. Relaie `pull:result` / `daily:result` / `error`.

## Build (Bun-only)

```bash
cd apps/gacha-client
bun run dev      # vite dev server :5173 (HMR)
bun run build    # vite build → dist/  (index.html + assets/*.js)
bun run preview  # sert dist/ :4173
bunx tsc --noEmit   # gate type (0 erreur)
bunx oxfmt apps/gacha-client   # indent 2 espaces
```

`bun run build` produit `dist/index.html` + chunks `dist/assets/` (pixi ~565 kB, colyseus ~127 kB, discord ~150 kB, app ~20 kB). Vite tourne sous Bun (acceptable, cf. CLAUDE.md racine). `base: "./"` → assets relatifs, compatibles proxy Discord.

### Vérif headless (réalisée)

`bunx vite preview` + Chromium (`/usr/local/bin/chromium`) via puppeteer : la page charge, le **canvas Pixi monte** (`#app canvas` présent, 1800×1200 @ DPR=2), **0 erreur de page JS**, le splash se masque. Hors VPS (pas d'accès aux API depuis le sandbox), l'auth/frames échouent **proprement** (catch → statut HUD, pas de crash) — comportement attendu et géré. En prod (origine `play.rpbey.fr` autorisée par le CORS du serveur gacha), l'auth aboutit.

## Déploiement — `play.rpbey.fr` (LIVE)

> Le client est un **statique** (`dist/`) servi par nginx sur `play.rpbey.fr` (TLS Let's Encrypt), déployé en prod le 2026-05-30. DNS `play.rpbey.fr` → VPS.

1. **Build + déploiement (un seul script, reproductible)** :
   ```bash
   bash scripts/deploy-gacha-client.sh
   # type-check → vite build (VITE_DISCORD_CLIENT_ID lu depuis apps/bot/.env, public)
   # → rsync dist/ vers /var/www/play.rpbey.fr → reload nginx
   ```
2. **nginx** — nouveau server TLS `play.rpbey.fr` :
   ```nginx
   server {
     listen 443 ssl http2;
     server_name play.rpbey.fr;
     ssl_certificate     /etc/letsencrypt/live/play.rpbey.fr/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/play.rpbey.fr/privkey.pem;
     root /var/www/play.rpbey.fr;
     index index.html;
     location / { try_files $uri $uri/ /index.html; }   # SPA fallback
     location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
   }
   ```
3. **Discord Dev Portal** (Application → Activities) :
   - **Activity URL** → `https://play.rpbey.fr`.
   - **URL Mappings** (proxy `/.proxy/`) :
     - `/api` → `api.rpbey.fr` (REST gacha + `/discord_token` + WSS Colyseus via `/gacha/`)
     - `/web` → `rpbey.fr` (frames anime + image carte OG)
   - OAuth2 scopes : `identify`, `rpc.activities.write`. Renseigner `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` côté **serveur gacha** (déjà attendu par `discord-token.ts`).
   - Renseigner `VITE_DISCORD_CLIENT_ID` au build du client.
4. **CORS** : `play.rpbey.fr` est déjà dans l'allowlist du serveur gacha (`isAllowedOrigin`, cf. server.md §CORS). Les origines `*.discordsays.com` (iframe Activity) le sont aussi.

## Pièges

- **`Texture.from(url)` ne charge pas** en PixiJS v8 (lit le cache) → toujours `Assets.load`. Les URL de frames/cartes proxifiées n'ont pas d'extension fiable → `parser: "texture"` forcé.
- **Ne pas importer `@rpbey/*`** (db/api-contract) dans ce bundle : ça tirerait Drizzle/postgres dans le navigateur. Les types sont **dupliqués** dans `src/types.ts` (garder synchro avec `packages/api-contract/src/gacha-game.ts`).
- **`label` est réservé** sur `Container` (PixiJS v8) — ne pas l'utiliser comme nom de champ pour un sous-objet (collision de type).
- Le pull ×10 n'a **pas** de message Colyseus (la room ne gère que `pull`/`daily`/`balance`) → il passe toujours par REST.
- **WS Colyseus proxifié dans Discord** : `net/room.ts` connecte via `proxifyUrl(GACHA_WS_URL, "api")` (→ `/.proxy/api/gacha`), JAMAIS en `wss://api.rpbey.fr` direct (la CSP de l'Activity bloque le réseau hors `/.proxy/`). Hors Discord, l'URL absolue est conservée. Sans ça, la room temps réel est muette dans Discord (seul le fallback REST tirerait).
- **`mock_code` désactivé en production** (`apps/gacha-server/src/discord-token.ts`) : en prod (`NODE_ENV=production`) le code mock renvoie **403** — sinon n'importe quel navigateur minterait une session gacha réelle hors Discord (pollution `users` + abus éco). Seul le vrai flux OAuth Discord est accepté.
