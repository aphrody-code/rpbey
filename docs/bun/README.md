---
title: "Bun — doc vendorée (knowledge base monorepo rpbey)"
description: "Documentation vendorée du runtime Bun 1.3.x utilisé par tout le monorepo rpbey."
scope:
  - bunfig.toml
status: "stable"
last_updated: "2026-06-01"
related_symbols:
  - Bun.serve
  - Bun.RedisClient
  - Bun.Glob
  - bun:ffi
---

# Bun — doc vendorée (knowledge base monorepo rpbey)

Doc complète Bun récupérée le **2026-06-01**. Cible runtime : **Bun 1.3.x** (upgrade depuis 1.2.20).

## Fichiers

- `llms-full.txt` — doc complète (2,0 Mo / 54 473 lignes). **Ne pas lire en entier** : `grep -n`/`sed -n`.
- `llms-bun.txt` — index officiel (324 entrées, liens `bun.com/docs/*`).

## Watchlist upgrade 1.2.20 → 1.3.x (à vérifier après bump)

- **`tsconfig` défaut `"module": "Preserve"`** en 1.3 — sans incidence ici (nos tsconfig définissent `module`/`moduleResolution` explicitement).
- **`Bun.serve()` WebSocket : types réécrits** (breaking) — concerne `apps/bot` (`api-server.ts` WS) + `apps/cdn` + shenron. Vérifier le type-check après bump.
- **`Bun.SQL` : throw si appelé en fonction** au lieu de tagged-template — on n'utilise pas Bun.SQL (driver = postgres.js), donc non concerné.
- **Fuite mémoire process long (72h+)** — watchpoint connu : surveiller le RSS de `rpb-bot`/`shenron`/`rpbey-web` après bascule.
- **`bun install` 17× moins de RAM**, mémoire JS Next −10-30%, `bun test --parallel/--isolate/--shard/--changed` (1.3.13+).

## Sections clés (liens `bun.com/docs/`, voir `llms-bun.txt`)

- Runtime : `runtime/*`, `api/*` (`Bun.serve`, `Bun.RedisClient`, `Bun.Glob`, FFI `bun:ffi`).
- Bundler/build : `bundler/*` (executables, plugins, macros) — NB : le bot build via **SWC**, pas `bun build`.
- Package manager : `pm/*` (workspaces, catalogs, `trustedDependencies`, linker hoisted vs isolated).
- Test : `test/*` (`bun test` vs vitest — on garde vitest).

## Rappels rpbey

- `bunfig.toml` racine : `linker = "hoisted"` (obligatoire pour builder Next), scopes GitHub Packages (`@aphrody-code`/`@rpbey` via `$GITHUB_TOKEN`), cache dir absolu.
- `bun` global VPS partagé avec rpb-bot/cdn/shenron → un `bun upgrade` impacte tout au prochain restart de service.
