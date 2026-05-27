# Changelog

All notable changes to the **discordy** monorepo.

## 0.1.0 — 2026-04-23

First release under the `@rpbey/*` npm scope. Initial Bun-first fork of [`discordx-ts/discordx`](https://github.com/discordx-ts/discordx).

### Added

- All 12 packages ship under `@rpbey/*` (plus `create-discordx` unscoped):
  - `@rpbey/discordx` — core framework
  - `@rpbey/di` — DI adapters (tsyringe, typedi)
  - `@rpbey/internal` — shared internal types
  - `@rpbey/importer` — Bun-native module auto-loader
  - `@rpbey/utilities` — guards + decorators
  - `@rpbey/pagination` — button + select-menu pagination
  - `@rpbey/music` — worker_threads YTDL player
  - `@rpbey/lava-player` — Lavalink client
  - `@rpbey/lava-queue` — queue manager
  - `@rpbey/plugin-lava-player` — ready Lavalink plugin
  - `@rpbey/plugin-ytdl-player` — ready YTDL plugin
  - `create-discordx` — Bun-first scaffolder with `--with-di`, `--with-music`, `--with-lava`, `--with-ytdl`, `--with-pagination` flags

### Changed (vs. upstream discordx)

- **Bun-native replacements**: `Bun.Glob`, `Bun.color`, `Bun.spawnSync`, global `fetch` (no `axios`/`undici` for HTTP).
- **Dropped**: `lodash`, `backoff`, `chalk`, `rimraf`, `ws`, `node-fetch`.
- **`engines.bun >= 1.2.0`** on every package.
- **`@rpbey/importer`** is Bun-only (uses `Bun.Glob` + `import.meta.dir`).
- **Build**: `plugin-lava-player` and `plugin-ytdl-player` switched to `bunx tsc` to preserve granular `exports` map.
- **create-discordx**: fully rewritten — local-bundled templates (no network round-trip), CLI flags for feature composition, Bun as first-class installer.

### Fixed

- **119 occurrences of deprecated `ephemeral: true`** migrated to `flags: MessageFlags.Ephemeral` (discord.js 14.26+). Affected: `plugin-lava-player`, `plugin-ytdl-player`, `utilities`.
- DTS generation for `plugin-lava-player` now works by adding `"types": ["bun"]` to its `tsconfig.json`.
- DTS generation for `@rpbey/music` was failing because `@types/node` wasn't resolvable; root monorepo now provides it.

### Known

- Legacy stage-2 decorators (`experimentalDecorators: true`) — **not** TC39 stage 3. Consumers must match.
- `@rpbey/importer` does not run on Node.js — use `Bun.Glob` directly or a build-time manifest if you need Node compat.

### Upstream

Fork of [discordx-ts/discordx](https://github.com/discordx-ts/discordx). Core feature parity tracked with upstream; the only intentional divergence is the Bun-native rewrites and the `@rpbey/*` namespace.

## 0.1.1 — 2026-04-23

### Fixed

- **discord.js deduplication** — bumped `discord.js` devDep from `^14.25.1` to `^14.26.3` across `discordx`, `lava-queue`, `music`, `pagination`, `plugin-lava-player`, `plugin-ytdl-player`, `utilities`. Fixes an `InvalidClientInstance` warning from `discord-player` when a parent monorepo pinned a different 14.x version, which forced two discord.js copies into the resolver.
- **peer dependency ranges** — aligned `@rpbey/*` peer deps to `>=0.1.0` in `lava-queue`, `music`, `plugin-lava-player`, `utilities`. Previous pins (`>=2.2.0` etc.) pointed at pre-fork versions that never existed on the @rpbey scope and caused `bun install` to query npmjs.com with a 404.
- **pre-commit hook** — scoped `turbo run build` to `--filter=!./docs` so the docusaurus workspace doesn't break local commits when its CLI is absent.

### Chore

- Dropped the nested `packages/discordy/bun.lock` — regenerated on demand for standalone dev, but absent when consumed as a sub-workspace of a parent monorepo so outer resolution drives.

### Note

`@rpbey/create-discordx` publishes as `0.1.2` (already had `0.1.1` from the earlier scope rebrand).

## 0.1.2 — 2026-04-23

### Fixed

- **`create-discordx` template bugfix** — the `basic` template shipped without an `Events.InteractionCreate` handler, so `/ping` (and any slash command) never routed to `client.executeInteraction`. Scaffolded bots appeared "online" but silently ignored interactions. Added the handler + switched to `Events.ClientReady` / `Bun.env` for Bun-first idiomaticity.
- **`create-discordx/template.ts`** — replaced `fileURLToPath(import.meta.url)` + `fs.readFile/writeFile` with `import.meta.dir` and `Bun.file` / `Bun.write`. Removes the `node:url` import entirely.
- **Preinstall guard** — running `bun install` inside `packages/discordy/` while it's consumed as a sub-workspace of a parent monorepo created a second isolated store (`packages/discordy/node_modules/.bun/discord.js@14.26.3`) distinct from the outer one. `instanceof` checks across package boundaries then failed (discord-player → `InvalidClientInstance`). Added `scripts/preinstall-guard.ts` that detects an outer `bun.lock` referencing `@rpbey/discordx` and aborts with a clear error. Bypass with `DISCORDY_STANDALONE=1` for CI publish flows.

### Chore

- CI workflows (`build.yml`, `publish-changeset.yml`, `build-documentation.yml`, `publish-documentation.yml`) — dropped residual `pnpm/action-setup@master` steps and replaced `pnpm publish -r --no-git-checks` with `bunx changeset publish`. Pipeline is now 100 % Bun-native.
- `templates/basic/tsconfig.json` — added `moduleDetection: "force"` + `verbatimModuleSyntax: true` for stricter ESM semantics.
