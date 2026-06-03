# syntax=docker/dockerfile:1
#
# Bot Discord @rose-griffon/bot → Google Cloud Run.
#
# IMPORTANT : ce Dockerfile attend le CONTEXTE = RACINE DU MONOREPO (pas
# apps/bot/), car le bot dépend des workspaces Bun (@rpbey/db, @rpbey/discordx,
# @rose-griffon/challonge, …). Build depuis la racine :
#
#   docker build -f apps/bot/Dockerfile -t rpbey-bot .
#
# ou via le workflow .github/workflows/deploy-bot.yml (gcloud builds submit).
#
# Le bot est compilé SWC (décorateurs legacy + emitDecoratorMetadata pour la DI
# tsyringe) → on lance `bun run build` puis `bun dist/index.js`. Pas de
# `bun src/index.ts` direct (cf. apps/bot/AGENTS.md).

FROM oven/bun:canary AS base
WORKDIR /app

# ── deps système pour @aphrody/canvas (Skia) + sharp ──
RUN apt-get update && apt-get install -y --no-install-recommends \
      libstdc++6 libgcc-s1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── install (monorepo, frozen lockfile) ──
# Auth GitHub Packages pour @aphrody-code/* et @rpbey/* (token build-arg, non
# persisté dans l'image finale grâce au multi-stage).
FROM base AS deps
ARG GH_PACKAGES_TOKEN
COPY package.json bun.lock bunfig.toml ./
COPY apps ./apps
COPY packages ./packages
RUN printf "@rpbey:registry=https://npm.pkg.github.com\n@aphrody-code:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n" "$GH_PACKAGES_TOKEN" > .npmrc \
    && bun install --frozen-lockfile \
    && rm -f .npmrc

# ── build SWC du bot ──
FROM deps AS build
WORKDIR /app/apps/bot
RUN bun run build

# ── image runtime ──
FROM base AS runtime
ENV NODE_ENV=production
# Copie l'app installée + buildée (node_modules workspace inclus).
COPY --from=build /app /app
WORKDIR /app/apps/bot
# Cloud Run injecte $PORT ; le bot bind 0.0.0.0:$PORT (cf. src/lib/api-server.ts).
EXPOSE 8080
CMD ["bun", "dist/index.js"]
