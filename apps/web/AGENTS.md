# AGENTS.md — rpbey web (dashboard Next.js)

Guide pour un agent IA / dev qui modifie le site. Lis-le **avant** d'éditer. La
section « Règle timestamp » est l'invariant #1 — la violer compile mais crashe au
runtime (c'est la cause de la majorité des bugs de la migration Prisma→Drizzle).

## 1. Stack

Next.js 16 (App Router, **Turbopack**, `output: "standalone"` hors Vercel) · **Bun**
runtime (`bun .next/standalone/apps/web/server.js`) · **Drizzle** (`@rpbey/db`) sur
**Postgres LOCAL** (socket `/var/run/postgresql`, base `rpb_neon`, user `ubuntu`) ·
**MUI v9** + Emotion · **better-auth** (Discord OAuth + email) · servi par nginx
(`rpbey.fr` → `127.0.0.1:3002`). Types partagés : `@rpbey/types` (type-only).

## 2. 🔑 Règle timestamp (invariant #1)

La migration a laissé un **split de mode assumé** entre les colonnes timestamp :

| Tables                                                                        | Mode Drizzle    | `columnType`        | Type JS attendu/retourné |
| ----------------------------------------------------------------------------- | --------------- | ------------------- | ------------------------ |
| **auth** : `users`, `accounts`, `sessions`, `verifications`, `twoFactors`     | `mode:"date"`   | `PgTimestamp`       | **objet `Date`**         |
| **toutes les autres** (tournaments, profiles, decks, rankings, gacha, anime…) | `mode:"string"` | `PgTimestampString` | **string ISO**           |

Pourquoi : **better-auth écrit des `Date`** (→ ses tables doivent être date-mode,
sinon `insert` 500 « Received an instance of Date »). Le reste du code applicatif,
migré, manipule des **strings ISO**.

**Conséquences pratiques :**

- **Query / write une colonne auth** (`users.createdAt`, `sessions.expiresAt`, …) :
  passe un **`Date`**. Passer une string ISO → `TypeError: x.toISOString is not a function`
  (Drizzle date-mode appelle `.toISOString()` sur ta valeur).
- **Query / write une colonne non-auth** : passe une **string ISO** (`new Date().toISOString()`).
  Passer un `Date` → `Received an instance of Date`.
- **Lire un timestamp pour l'afficher** (peut être `Date` OU string selon la table) :
  wrappe toujours `new Date(x)` avant `.toLocaleDateString()`/`.getTime()`. Helpers
  `formatDateTime`/`safeIso` tolèrent déjà `Date | string`.
- En cas de doute : `bun -e "import{schema}from'@rpbey/db';console.log(schema.<table>.<col>.columnType)"`.

## 3. Déploiement — `scripts/deploy-web.sh` (OBLIGATOIRE après chaque build)

`next build` régénère `.next/standalone/` et **n'y inclut PAS** `public/` ni les
`data/*` exclus du tracing (`outputFileTracingExcludes`, anti-250 MB Vercel). Sans
`deploy-web.sh` → **JS chunks 404 (site mort), images 404, rankings/tournois vides**.
Le script (idempotent) :

1. copie `.next/static` → standalone (chunks hash-matchés au `server.js` du build) + pré-crée `.next/cache` (sinon le runtime ISR `mkdir` est bloqué par systemd `ProtectSystem=strict` → `EROFS` en boucle + `InvariantError` manifest en cascade) ;
2. symlink `public/` → `apps/cdn/assets/rpb-dashboard` (logos, parts, partners) ;
3. copie `data/exports/B_TS*.json` (depuis le CDN — **pas** un symlink hors-racine, Turbopack le rejette au build) + `data/bey-library/` ;
4. `rm -rf $SA/data && ln -s apps/web/data` (sinon nested symlink dans le dir réel du build) ;
5. copie le helper `@tobyg74/tiktok-api-dl/helper` dans le standalone (non tracé, lu via `__dirname`).

**Déploiement en UNE commande** (recommandé) :

```bash
bash ~/rpbey/scripts/ship-web.sh   # build turbopack → deploy-web.sh → restart → healthcheck
```

Ou les étapes manuelles :

```bash
cd ~/rpbey/apps/web && bun run build          # = next build --turbopack (cf. §3bis)
bash ~/rpbey/scripts/deploy-web.sh            # ← ne JAMAIS oublier
sudo systemctl restart rpbey-web.service
```

Le serveur standalone fait `chdir` vers `.next/standalone/apps/web` → tout `readFile("data/…")`
résout là (couvert par le symlink `data`).

## 3bis. Build Turbopack + Next canary (perf)

- **Next est pinné en canary** (`16.3.0-canary.32` dans le catalog racine) — politique « canary/nightly partout ». Le canary corrige le panic JSX radix `<SlotClone>` qui bloquait le FS cache Turbopack en 16.2.6.
- **Build = `next build --turbopack`** (script `build`) + `experimental.turbopackFileSystemCacheForBuild: true`. Mesuré : compile **cold ~25 s, warm ~1.1 s** (vs ~41 s webpack). Ne pas revenir à webpack sans raison.
- Libs server-only lourdes dans `serverExternalPackages` (googleapis, puppeteer, xlsx, cheerio, sharp…) → pas bundlées = compile plus rapide.
- **`.next/cache` Turbopack peut devenir STALE** : un build _warm_ échoue sur un import fantôme d'une version revertée d'un fichier, gelée dans le cache (vécu : `import { getPartsRandom }` supprimé sur disque mais toujours dans le cache). Signature = **`bunx tsc --noEmit` = 0 mais `next build` casse** sur un export « doesn't exist » (Turbopack bundle le `src`, `tsc` lit les `.d.ts`). Fix : `rm -rf apps/web/.next/cache` puis rebuild cold. À soupçonner après un fichier édité/reverté par une session parallèle.

## 3ter. Standalone sur VPS — nginx & systemd

- **`/_next/static/` servi DIRECTEMENT par nginx** (location `alias` vers `.next/standalone/apps/web/.next/static/`, `Cache-Control: public, max-age=31536000, immutable`, `try_files … @bunproxy`) → offload Bun, cache 1 an. `/home/ubuntu` est en 755 donc le worker nginx (`nobody`) peut lire. Conf : `/etc/nginx/conf.d/rpbey.fr.conf` (backups `.bak-*`). Toujours `sudo nginx -t` avant `reload`.
- Le reste (`location /`) proxie vers `127.0.0.1:3002` avec `proxy_buffering off` (requis pour les SSE `/api/bot/events`, `/api/admin/analytics/stream`).
- systemd `rpbey-web.service` : `Restart=always`, `User=ubuntu`. **Ne pas** mettre `NoNewPrivileges` (casse le `sudo systemctl` du route handler admin `/api/admin/bot/restart`).

## 4. Pièges build (cf. `~/rpbey/docs/nextjs/README.md`)

- **Fuite postgres → bundle client** : ne jamais importer en _runtime_ `@rpbey/db`/`@/lib/db`
  depuis un module atteint par un client component. Les types se dérivent via
  `type Schema = typeof import("@rpbey/db").schema` (effacé). `lib/types.ts` = ré-export `@rpbey/types`.
- **`@vidstack/react`** ship du JSX non-transpilé → `transpilePackages: ["@vidstack/react"]`.
- **`challonge-vendor`** : le barrel (`@/lib/challonge-vendor`) NE tire PAS puppeteer ; le
  scraper s'importe via `@/lib/challonge-vendor/scraper` (sinon crash eval `utils.isObject` Turbopack → 500).
- `experimental.turbopackFileSystemCacheForBuild: true` (cache Turbopack persistant, Next 16.3 canary).
  `typescript.ignoreBuildErrors: false` (drift MUI X v9 résorbé → le build type-check) ;
  `bunx tsc --noEmit` reste le gate type principal (doit être 0).
- Builtin `bun` non importable dans une route (build « collect page data ») → `globalThis.Bun` lazy.
- **Charger un JSON de `data/`** : toujours `loadJsonSafe("data/X.json")` de `@/lib/data-cache`
  (FS en dev/standalone, fetch CDN sur Vercel). **Jamais** `path.join(process.cwd(), "apps/web/data/X.json")`
  — en dev `cwd=apps/web` → chemin doublé inexistant, et le `fs` direct casse sur Vercel (FS absent).
- **`component={Link}` depuis un SERVER component** (Next 16) : passer `next/link` directement → erreur RSC « Functions cannot be passed directly to Client Components ». Utiliser le wrapper `@/components/ui/NextLink` (re-export `"use client"` de `next/link`). Dans un client component (`"use client"`), `next/link` direct reste OK. **`tsc` ne voit PAS cette erreur** — seul `next build` la révèle (frontière server/client du bundler, pas un type).

## 5. Auth (better-auth)

Discord OAuth + email/password (Twitch retiré). `BETTER_AUTH_URL=https://rpbey.fr`,
`useSecureCookies`, `cookiePrefix "rpb-auth"`. **`account.accountLinking.trustedProviders: ["discord","google"]`**
(les users migrés ont `discordId` sans account discord → linking par email au 1er login).
`callback` → `/api/auth/callback/discord` (redirect_uri whitelisté côté app Discord).

- **Derrière nginx** : `advanced.ipAddress.ipAddressHeaders: ["x-real-ip","x-forwarded-for"]` OBLIGATOIRE — sinon better-auth voit `127.0.0.1` pour tous → bucket rate-limit partagé → 429 globaux. `rateLimit` 60s/200 par IP, `customRules: { "/get-session": false }` (pollé par `useSession`, read-only via cookieCache).

## 6. Validation & QA

```bash
bunx tsc --noEmit                       # 0 erreur (le build ignore les types)
# QA visuel + erreurs console de toutes les pages :
CHROME=/usr/local/bin/chromium bun ~/rpbey/scripts/shoot.ts   # → .shots/*.png + rapport
```

QA : un 500 sur une page = bug ; les `failedReq` externes (avatars discord/challonge ORB,
prefetch `_rsc`, 429 get-session sous martèlement) sont du bruit headless, pas des erreurs serveur.
Vérifier le serveur : `journalctl -u rpbey-web.service | grep -iE "⨯|digest|toISOString|instance of Date"`.

## 7. Rollback

Vercel (`rpb-dashboard`) + Neon sont **gardés intacts** : re-pointer le DNS apex
`rpbey.fr` → `76.76.21.21` restaure l'ancienne prod en cas de besoin.

## 8. Sécurité — server actions

Toute `"use server"` de **mutation** (create/update/delete/sync/merge/import) DOIT débuter par
`if (!(await requireAdmin())) throw new Error("Forbidden");` (`requireAdmin` de `@/lib/auth-utils`,
retourne `null` si non-admin). Sans ça l'action est invocable par n'importe quel client connecté
(privesc). Exceptions explicites : `claimProfile` (auth-gated différemment) et les getters read-only.

## 9. Moteur de Recommandation & Recherche Globale Google-Style

- **Recommandation Modulaire** :
  - Les coefficients de pondération (Intérêt Méta, Facteur Hype, Rapport Qualité/Prix) sont ajustables via des curseurs Material-UI et réévalués en temps réel côté client.
  - Les détails de chaque produit affichent une analyse des pièces avec leur **Tier WBO** (S, A, B, C) et leur **usage en tournoi** réel (issu de la table `deck_items`).
- **Recherche Globale type Google** :
  - Une route d'API `/api/search/global` fusionne et indexe les produits du catalogue, les pièces de la base de données, les tournois à venir/passés et le classement de tous les Bladers.
  - Le champ de recherche filtre cet index en temps réel (via `Fuse.js`) et affiche les résultats groupés par type de contenu sous forme de dropdown overlay.
- **Optimisations du Scraper** :
  - Les places de marché (`amazon.*`, `ebay.*`, `aliexpress.*`, etc.) sont étiquetées `link-only` et court-circuitées pour éviter des ralentissements inutiles.
  - Les plateformes WooCommerce / Shopify ne sont interrogées que pour les boutiques indépendantes (`isIndependent`), accélérant significativement le run.
  - Bypasses spécifiques (ex: queue-it sur `takaratomymall.jp`, timeouts HTTP/1.1 Akamai sur `bigw.com.au`).
- **Optimisations Récentes (UI & SEO)** :
  - **Résolution des URLs d'images pour le SEO** : Ajout du helper `getAbsoluteImageUrl` dans `seo-utils.ts` pour s'assurer que toutes les balises meta Open Graph (`og:image` / `twitter:image`) utilisent des URLs absolues complètes avec protocole et hôte.
  - **CTA Flottant Discord** : Masquage automatique du CTA flottant sur toutes les pages `/comparateur*` (via `usePathname`) pour maximiser l'espace visuel et ne pas encombrer l'interface analytique et la comparaison des prix.
  - **Améliorations de la Page de Comparaison** : Ajout de badges "MEILLEUR PRIX" sur l'offre la moins chère, d'une barre de spread visuelle pour situer les prix, de l'affichage des devises d'origine, et d'un style de boutons plus dynamique et épuré avec dégradés.

## 10. Anime — frames / galerie (captures CDN, façon « Google Images »)

Captures HQ frame-par-frame réutilisées par le **gacha** (cartes des persos non dessinés, backgrounds) et indexées par la **recherche globale** (résultats visuels).

- **Table** `anime_frames` (`@rpbey/db`, `mode:"string"`) — `uniqueIndex(source, sourceId)`. Source actuelle : `fancaps` (n'a QUE **Beyblade X** ; les autres saisons exigent des sources alternatives / wikis Fandom).
- **Contrat** `@rpbey/api-contract` : `anime.ts` (`AnimeFrame*`), `scrapers.ts` (`AnimeFrameImport*`). **DAL** server-only `server/dal/anime.ts` (`listAnimeFrames` filtre `series/episode/character` jsonb `@>`/`q`/`notable` + curseur ; `listAnimeFramesForIndex`). **Route** `/api/v1/anime/frames` (OpenAPI → SDK hey-api). **GraphQL** `animeFrames`. **Recherche** : catégorie `"frame"` + champ `thumbnail`, §12 de `global-search.ts` (frames `isNotable`).
- **Page** `/anime/[slug]/galerie` (RSC ; grille + lightbox = `GalerieClient` client, MUI v9 `styled()` + `sx`). CTA « Galerie » depuis `SeriesDetail`.
- **Import** : `apps/web/scripts/import-anime-frames.ts` lit `apps/web/data/anime-frames/<slug>.json` (**gitignored, régénérable — la DB + le CDN sont la vérité**), fetch → **sharp PNG + oxipng lossless** → CDN `/var/www/cdn/static/rpb-dashboard/anime/<slug>/epNN/frame-<id>.png` (dir **`ubuntu:ubuntu`** — sinon `sudo chown`, le reste de `/var/www/cdn/static` est `www-data`) → upsert idempotent/resumable (`onConflictDoUpdate` sur `[source,sourceId]`). Scrapers amont : `scrape-anime-frames.ts` (fancaps, via **bxc** profil `static` — IP VPS blacklistée), `map-character-episodes.ts` + `merge-frames-characters.ts` (Fandom api.php, épisodes marquants → `isNotable=true`).
