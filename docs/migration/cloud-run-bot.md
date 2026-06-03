---
title: "Migration Bot — apps/bot → Google Cloud Run"
description: "Plan + procédure pour héberger le bot Discord @rose-griffon/bot (discordx + discord.js gateway, build SWC) sur Google Cloud Run (projet rgfr-8927d, région EU) : Dockerfile Bun, min-instances=1 + no-cpu-throttling pour la gateway persistante, secrets via Secret Manager, et caveat voix/lavalink (UDP)."
scope:
  - apps/bot
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - Dockerfile
  - rpbey-bot
  - DATABASE_URL
  - DISCORD_TOKEN
---

# Migration Bot — apps/bot → Google Cloud Run

## Cible

| Élément | Avant (VPS) | Après (cloud) |
| --- | --- | --- |
| Hébergement | systemd `rpb-bot.service`, Bun, `dist/index.js` (build SWC) | **Cloud Run** service `rpbey-bot`, projet `rgfr-8927d`, région EU (`europe-west1`) |
| Modèle | process long-running | container **persistant** : `--min-instances 1 --no-cpu-throttling` (la gateway Discord est une connexion WS permanente, pas du request/response) |
| Build | SWC local → `dist/` | image Docker (base Bun) via Cloud Build (`--source`) |
| DB | socket local | `DATABASE_URL` (Neon pooled) via `--set-secrets` (Secret Manager) |
| API REST | `Bun.serve` :3001 (scrapers) | port `$PORT` exposé par Cloud Run (health + REST) |
| Secrets | `apps/bot/.env` | **GCP Secret Manager**, injectés via `--set-secrets` |

## Décisions

1. **Container persistant, pas scale-to-zero.** La gateway Discord exige une
   connexion ouverte 24/7 → `--min-instances 1`, `--max-instances 1` (singleton :
   le bot a un lock PID, double instance = exit 11), `--no-cpu-throttling` (CPU
   always-allocated, sinon la WS gèle entre requêtes HTTP).
2. **Build SWC conservé.** Le bot DOIT être compilé SWC (décorateurs legacy +
   `emitDecoratorMetadata` pour la DI tsyringe) → le Dockerfile lance
   `bun run build` puis `bun dist/index.js`. Pas de `bun src/index.ts` direct.
3. **Port HTTP.** Cloud Run impose d'écouter sur `$PORT`. Le bot expose déjà une
   API `Bun.serve` ; on la bind sur `process.env.PORT ?? 3001` pour le health
   check de la plateforme (sinon le déploiement échoue au "container failed to
   listen on PORT").
4. **Secrets via Secret Manager**, jamais `--set-env-vars` pour les tokens.
5. **CI** : `deploy-bot.yml` (`gcloud run deploy` sur push `apps/bot/**`).

## Caveat voix / lavalink (IMPORTANT)

Cloud Run **ne gère pas bien l'UDP** (et pas du tout l'UDP entrant) : le voice
gateway Discord utilise RTP/UDP. **La musique / le voice sera dégradé ou non
fonctionnel** sur Cloud Run. La gateway (events, slash commands, REST, gacha,
tournois) fonctionne normalement (tout est WS/HTTP sortant). Si le voice est
critique, garder ce sous-système sur le VPS ou une VM dédiée. Documenté ici ;
la migration vise gateway + slash commands en priorité.

## Secrets requis (Secret Manager)

`DISCORD_TOKEN`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CHALLONGE_*`,
`TWITCH_*`, `REDIS_*` (Redis managé requis — le bot dépend de Redis ; sur Cloud
Run pas de redis-server local → pointer vers Upstash/Memorystore), `BOT_API_KEY`.

## Vérification

- `gcloud run services describe rpbey-bot --region europe-west1` → `Ready=True`,
  URL servie.
- Logs Cloud Run : `Logged in as <bot>` (gateway connectée), pas de crash loop.

## État (Phase 4 — préparée 2026-06-04)

- `apps/bot/Dockerfile` (base `oven/bun:canary`, contexte = racine monorepo,
  multi-stage : deps → build SWC → runtime, `bun dist/index.js`).
- `apps/bot/cloudbuild.yaml` (build image AR depuis la racine, token GH Packages
  en substitution).
- Bot rendu Cloud-Run-ready (sans casser le VPS) : `src/lib/api-server.ts` bind
  `0.0.0.0` quand `K_SERVICE` est défini (Cloud Run), `127.0.0.1` sinon ;
  `src/index.ts` écoute `$PORT` (Cloud Run) sinon `BOT_API_PORT` (3001).
  `tsc --noEmit` = 0.
- `.github/workflows/deploy-bot.yml` : auth SA (`GCP_SA_KEY`), Cloud Build,
  `gcloud run deploy rpbey-bot` (`--min-instances 1 --max-instances 1
  --no-cpu-throttling --port 8080`), secrets via Secret Manager.
- Secret GitHub `GCP_SA_KEY` posé (SA `admin-sa@rgfr-8927d`).

## ⛔ BLOCKER (vérifié 2026-06-04) — facturation GCP désactivée

Le déploiement Cloud Run réel est **bloqué** : le projet `rgfr-8927d` n'a **pas
de facturation activée**. Toute opération Cloud Run / Cloud Build / Secret
Manager renvoie :

> `This API method requires billing to be enabled. Please enable billing on
> project #rgfr-8927d` (auth `admin-sa@rgfr-8927d`).

Les **APIs sont déjà activées** (`run`, `cloudbuild`, `secretmanager`,
`artifactregistry`) — il ne manque QUE le rattachement d'un compte de
facturation.

### L'unique étape humaine

1. Activer la facturation sur `rgfr-8927d` :
   https://console.cloud.google.com/billing/enable?project=rgfr-8927d

Une fois fait, tout le reste est **prêt et automatisable** :

```bash
# (a) Secret Manager (valeurs depuis apps/bot/.env, DATABASE_URL = Neon pooled)
for s in DISCORD_TOKEN DATABASE_URL BETTER_AUTH_SECRET CHALLONGE_API_KEY BOT_API_KEY; do
  printf '%s' "<valeur>" | gcloud secrets create "$s" --project rgfr-8927d \
    --replication-policy=automatic --data-file=- ; done
# (b) Artifact Registry
gcloud artifacts repositories create rpbey --project rgfr-8927d \
  --location europe-west1 --repository-format docker
# (c) Build + deploy (ou simplement push apps/bot/** → deploy-bot.yml le fait)
gcloud builds submit --project rgfr-8927d --region europe-west1 \
  --config apps/bot/cloudbuild.yaml \
  --substitutions=_IMAGE=europe-west1-docker.pkg.dev/rgfr-8927d/rpbey/rpbey-bot:manual,_GH_PACKAGES_TOKEN=<tok> .
gcloud run deploy rpbey-bot --project rgfr-8927d --region europe-west1 \
  --image europe-west1-docker.pkg.dev/rgfr-8927d/rpbey/rpbey-bot:manual \
  --min-instances 1 --max-instances 1 --no-cpu-throttling --port 8080 \
  --set-secrets=DISCORD_TOKEN=DISCORD_TOKEN:latest,DATABASE_URL=DATABASE_URL:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,CHALLONGE_API_KEY=CHALLONGE_API_KEY:latest,BOT_API_KEY=BOT_API_KEY:latest
```

Le workflow `deploy-bot.yml` exécute (b)+(c) automatiquement (secrets dans
Secret Manager). **Redis managé** reste aussi à provisionner (le bot ne démarre
pas sans Redis — `REDIS_*`).
- **Redis managé** : provisionner Upstash/Memorystore et fournir `REDIS_*`
  (le bot ne démarre pas sans Redis).
- Ne pas `systemctl disable rpb-bot.service` tant que Cloud Run n'est pas vérifié
  live (le service VPS est actuellement `failed` mais reste l'autorité jusqu'au
  cutover).
