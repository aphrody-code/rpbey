# RPBEY Monorepo

Monorepo de la communauté Beyblade **République Populaire du Beyblade** (tournois, classements, gacha TCG, économie, duels).

## Stack Technique

- **Web (apps/web)** : Next.js 16 (App Router, Turbopack, standalone mode), Tailwind CSS, better-auth, Drizzle ORM.
- **Bot (apps/bot)** : Bot Discord (discordx + tsyringe + discord.js v14, Skia rendering).
- **Gacha Server (apps/gacha-server)** : Serveur Colyseus 0.17 (BunWebSockets) pour l'économie TCG.
- **CDN (apps/cdn)** : Serveur d'images Bun minimaliste.
- **Base de données** : **Neon Postgres** (serverless, région `eu-central-1` Frankfurt), pooled via `@rpbey/db` (`DATABASE_URL`, `prepare:false`) — fallback socket local en dev.

## Déploiement (serverless)

- **Web** → **Vercel** (`fra1`, runtime Bun) via GitHub Actions ; images servies en direct (`images.unoptimized` — l'optimiseur Vercel est plan-capé).
- **Bot** → **Google Cloud Run** (`europe-west3`, image Docker).
- CORS ouvert cross-origin partout ; tous les serveurs bind `0.0.0.0:$PORT`.
- Conventions DB (tournois clés sur le slug `B_TS{n}`/`T_SS{n}`, contrainte unique participants), pipeline tournois + calcul de classement (BTS/global + Stardust) et skill `tournament-import` : voir **[`docs/ops-serverless-db-ranking.md`](docs/ops-serverless-db-ranking.md)**.
- Le déploiement local propre (`scripts/reactivate-local.ts`, ci-dessous) reste disponible.

## Réactivation Propre et Complète (Local)

Pour réactiver proprement l'ensemble des services RPBEY en environnement local (nettoyage complet des caches, installation des dépendances, compilation du bot et du site Next.js) :

```bash
bun scripts/reactivate-local.ts
```

Ce script effectue les actions suivantes :
1. Nettoie les dossiers `node_modules` et les caches de build (.next, .turbo, .bun-cache).
2. Installe proprement toutes les dépendances via `bun install`.
3. Génère les entrées statiques du bot et le compile via SWC.
4. Compile l'application Web Next.js locale (en configurant temporairement `ignoreBuildErrors: true` pour éviter les plantages JIT).
