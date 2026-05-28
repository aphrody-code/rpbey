# CLAUDE.md — rpbey Discord bot

> **Ce fichier était périmé** (il décrivait Prisma + Neon, base `rpb`, codegen
> `src/generated/prisma/`, submodule `~/vps`). Tout ça est **faux depuis la
> migration Drizzle du 2026-05-27.** Ne t'y fie plus.

## Source de vérité

- **`apps/bot/AGENTS.md`** — le guide canonique et à jour (stack, démarrage DI,
  façade `lib/prisma.ts` sur Drizzle, sous-systèmes consolidés, UI V2, cron, API,
  pièges runtime, build/validation). **Lis-le avant d'éditer.**
- **`../../CLAUDE.md`** (racine monorepo) — contexte transverse : DB partagée
  `@rpbey/db` (Postgres LOCAL, socket `/var/run/postgresql`, base `rpb_neon`),
  invariant timestamp, packages partagés, commandes turbo.

## Rappels denses (détaillés dans AGENTS.md)

- DB = **Drizzle** (`@rpbey/db`) interrogée via la **façade Prisma émulée**
  (`src/lib/prisma.ts`) — utilise `prisma`/`this.prisma`, jamais Drizzle inline.
- **Bun only** (jamais node/npm/tsx). Bun **1.3+** requis (`Bun.cron`).
- **Build = SWC** (`bun run build`), pas `bun build` (décorateurs legacy + DI).
  Donc pas de `Bun.$` ni de rewrites TS-direct dans `src/**`.
- **`import { Class }`** (jamais `import type`) pour toute classe injectée tsyringe.
- `src/_entry-imports.generated.ts` = généré, gitignored, ne pas éditer.
- Type-check : `bunx tsc --noEmit` (0 erreur). Tests : `bun test`.
