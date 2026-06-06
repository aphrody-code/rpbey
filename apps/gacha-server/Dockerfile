# syntax=docker/dockerfile:1
#
# RPBey Gacha Server (apps/gacha-server) -> Google Cloud Run.
#
# IMPORTANT : ce Dockerfile attend le CONTEXTE = RACINE DU MONOREPO (pas
# apps/gacha-server/), car le serveur dépend des workspaces Bun (@rpbey/db,
# @rpbey/api-contract). Build depuis la racine :
#
#   docker build -f apps/gacha-server/Dockerfile -t rpbey-gacha .

FROM ubuntu:26.04 AS base
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive

# Bun installation
ARG BUN_TAG=canary
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip ca-certificates \
      libstdc++6 libgcc-s1 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash -s "${BUN_TAG}" \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
ENV PATH="/root/.bun/bin:${PATH}"

# ── install (monorepo) ──
FROM base AS deps
ARG GH_PACKAGES_TOKEN
ENV GITHUB_TOKEN=${GH_PACKAGES_TOKEN}
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
COPY apps ./apps
COPY packages ./packages
RUN bun install

# ── image runtime ──
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app /app
WORKDIR /app/apps/gacha-server
EXPOSE 8080
CMD ["bun", "src/index.ts"]
