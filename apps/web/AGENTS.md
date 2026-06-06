# AGENTS.md — rpbey web (dashboard Next.js)

Guide pour un agent IA / dev qui modifie le site. Lis-le **avant** d'éditer. La
section « Règle timestamp » est l'invariant #1 — la violer compile mais crashe au
runtime (c'est la cause de la majorité des bugs de la migration Prisma→Drizzle).

## 1. Stack

Next.js 16 (App Router, **Turbopack**) hébergé sur **Vercel** (`rpbey.vercel.app` / `rpbey.fr`) · **Drizzle** (`@rpbey/db`) connecté à la base managée **Neon Postgres** (connexion `DATABASE_URL` avec pooler PgBouncer pour le runtime, et `DIRECT_DATABASE_URL` pour les migrations) · **MUI v9** + Emotion · **better-auth** (Discord OAuth + email) · Stockage des uploads médias sur **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`). Types partagés : `@rpbey/types` (type-only). Le runtime local utilise Bun, tandis que la production sur Vercel s'exécute sous Node.js.

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

## 3. Déploiement — Vercel (Production)

Le site est hébergé en production sur **Vercel** via le projet lié `rpbey`. Le déploiement est entièrement automatisé via la GitHub Action `.github/workflows/deploy-vercel.yml` lors d'un push sur `main`.

### Déploiement manuel :
```bash
# Lancer le build et déployer en production
vercel deploy --prod
```

### Notes de build & configuration :
1. **Root Directory** : Configuré sur `apps/web` dans l'interface Vercel.
2. **Build Command** : Défini sur `bun run build:vercel` (qui lance `next build --turbopack` sans utiliser de fichiers `.env` locaux).
3. **Découplage des données locales** :
   - `B_TS*.json` et le catalogue de pièces sont directement importés ou versionnés dans `apps/web/data/` pour être inclus statiquement par Next.js.
   - Les médias dynamiques ou téléversés (avatars, deckboxes, etc.) utilisent **Vercel Blob** (`@vercel/blob` via le token `BLOB_READ_WRITE_TOKEN`).
   - Le middleware/DAL lit les données de classement et les tournois en direct depuis la base managée **Neon Postgres**.
4. **Vercel Cache** : Le dossier `.next/cache` est géré de façon transparente par Vercel.

## 3bis. Build local et Dev

Pour le développement local :
- Lancer le serveur local avec `bun run dev` (ou `bun run dev:web` depuis la racine du monorepo).
- Pour simuler un build de production en standalone (identique à l'ancienne configuration VPS), utiliser `bun run build` suivi de `bash scripts/deploy-web.sh` pour copier les assets statiques, puis démarrer le serveur via `bun .next/standalone/apps/web/server.js`. *Note : Cette étape n'est requise que pour des tests locaux de conformité, elle n'est plus déployée en production sur le VPS.*

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
Vérifier les logs : Consulter la console Vercel (Runtime Logs) ou la console GCP Cloud Run pour identifier les erreurs.

## 7. Rollback

Le rollback se fait directement depuis le tableau de bord Vercel en réactivant une version de déploiement précédente stable.

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

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- Monorepo note: `next` is hoisted to the repo root, so from this app dir the
     bundled docs are at `../../node_modules/next/dist/docs/` (the root
     `AGENTS.md` references them with the resolved `node_modules/...` path). -->
