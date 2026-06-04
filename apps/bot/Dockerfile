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
#
# BASE = ubuntu:26.04 (glibc 2.43), PAS oven/bun (Debian, glibc 2.36/2.41) :
# le binaire natif Skia de @aphrody/canvas-linux-x64-gnu@0.1.99 est compilé contre
# GLIBC_2.43 (host de build = VPS Ubuntu 26.04). Sur une base trop ancienne il
# échoue au runtime avec « libm.so.6: version GLIBC_2.43 not found » → Fatal Startup.
# Bun est installé via le script officiel, épinglé pour matcher le lockfile (canary,
# cf. mémoire VPS « Bun 1.4.0-canary.1 »).

FROM ubuntu:26.04 AS base
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive

# Bun + libs runtime pour @aphrody/canvas (Skia) et sharp.
#   - unzip/curl/ca-certificates : requis par le script d'install Bun.
#   - libstdc++6/libgcc-s1 : ABI C++ du binaire Skia.
#   - libfontconfig1/libfreetype6 : rendu texte canvas.
# BUN_TAG : tag de release Bun (1er arg du script d'install). "canary" = dernière
# canary (matche le bun VPS) ; ou un tag figé "bun-v1.4.0" pour reproductibilité.
ARG BUN_TAG=canary
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates \
      libstdc++6 libgcc-s1 libfontconfig1 libfreetype6 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash -s "${BUN_TAG}" \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
ENV PATH="/root/.bun/bin:${PATH}"

# ── install (monorepo) ──
FROM base AS deps
ARG GH_PACKAGES_TOKEN
# bunfig.toml [install.scopes] résout les scopes GitHub Packages via $GITHUB_TOKEN.
ENV GITHUB_TOKEN=${GH_PACKAGES_TOKEN}
# Le postinstall de puppeteer (dep d'apps/web, PAS du bot) télécharge Chrome et
# échoue (inutile pour un bot Discord). On skip.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json bun.lock bunfig.toml ./
# patches/ est référencé par package.json#patchedDependencies (kysely) — requis par
# bun install, sinon « Couldn't find patch file ».
COPY patches ./patches
COPY apps ./apps
COPY packages ./packages
# On NE crée PAS de .npmrc redirigeant @rpbey vers le registre : @rpbey/* sont des
# paquets *workspace* (résolus localement) ; un redirect registre ferait diverger le
# lockfile. PAS de --frozen-lockfile : delta mineur stable↔canary réconcilié via bun.lock.
RUN bun install

# ── build SWC du bot ──
FROM deps AS build
WORKDIR /app/apps/bot
RUN bun run build
# Runtime tsconfig SANS l'alias `paths` "@aphrody/x" → ./types/aphrody-x/index.d.ts.
# Cet alias n'existe que pour le TYPECHECK (le paquet @aphrody/x ship du TS brut sans
# déclarations propres ; le .d.ts généré lisse les types). Mais Bun applique les
# `paths` du tsconfig le plus proche AUSSI à l'exécution → il chargerait le .d.ts
# (qui `import "./core/session"` sans .js) → « Cannot find module './core/session' ».
# On retire donc `paths` du tsconfig de l'image : Bun résout @aphrody/x depuis
# node_modules/@aphrody/x (exports "." → ./src/index.ts, exécutable par Bun).
RUN bun -e "const f='tsconfig.json';const c=await Bun.file(f).json();if(c.compilerOptions)delete c.compilerOptions.paths;await Bun.write(f,JSON.stringify(c,null,2))"

# ── image runtime ──
FROM base AS runtime
ENV NODE_ENV=production
# Copie l'app installée + buildée (node_modules workspace inclus, symlinks préservés).
COPY --from=build /app /app
WORKDIR /app/apps/bot
# Cloud Run injecte $PORT ; le bot bind 0.0.0.0:$PORT quand K_SERVICE est défini
# (cf. src/lib/api-server.ts).
EXPOSE 8080
CMD ["bun", "dist/index.js"]
