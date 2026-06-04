# Ops — Serverless, DB, Tournaments & Ranking (2026-06)

Operational reference for the serverless migration, the Neon DB conventions, and the tournament + ranking pipeline. Companion to `CLAUDE.md` / `AGENTS.md`.

## Serverless topology
- **Web** (`apps/web`) → **Vercel**, region `fra1` (Frankfurt), **Bun runtime** (`vercel.json` `bunVersion`). Deploy = GitHub Actions "Deploy site to Vercel" (token `VERCEL_TOKEN`) — *no* Vercel Git integration.
- **Bot** (`apps/bot`) → **Google Cloud Run**, `europe-west3` (project `aphrody`), Docker image, min-instances 1.
- **Images**: Vercel's optimizer is plan-capped → it returned `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` on every `/_next/image`. Fixed with `images.unoptimized: true` in `next.config.ts` — local assets are pre-optimized `.webp` served directly by the edge CDN.
- **CORS** is **open cross-origin everywhere** (LLM/tool friendly): web sends `Access-Control-Allow-Origin: *` (next.config headers) + better-auth `trustedOrigins: ["*", …]`; bot API / gacha-server (Colyseus) / embed-sidecar reflect the request Origin (+ `Allow-Credentials` where cookies flow). All HTTP servers bind `0.0.0.0:$PORT`; scratch writes go to `os.tmpdir()` (`/tmp` is the only writable path on Vercel lambdas).
- A legacy VPS/systemd deploy (`scripts/reactivate.sh`, `cdn.service`, `rpbey-web.service`…) still exists; the serverless path above is the current target.

## Database (Neon)
- **Canonical DB = Neon Postgres, project `rpbey-eu`, region `eu-central-1` (Frankfurt)**, pooled endpoint `ep-summer-fog-a2p1ldnd-pooler` (`prepare:false`, PgBouncer). Migrations use the **direct** endpoint (`DIRECT_DATABASE_URL`). `@rpbey/db` reads `DATABASE_URL`; the local socket is a dev-only fallback. The old **Oregon (us-west-2) project was an orphan and was deleted** 2026-06-04 (was a split-brain doublon).
- **Tournament rows are keyed on the human slug** (`challongeId` = `B_TS1..B_TS6`, `T_SS1`, `T_SS2`; row `id` = `bts1..`, `tss2`, …). The old **legacy numeric-`challongeId` rows** (`17261774`…, cuid ids) were a duplicate set and **were deleted** 2026-06-04 (backup `~/rpbey-legacy-bts-backup-*.json`). **Never key a new tournament on the numeric Challonge id** — always the slug.
- **`tournament_participants` has `UNIQUE(tournamentId, challongeParticipantId)`** (added 2026-06-04 — it was missing; only `tournament_matches` had its equivalent). Its absence let `createMany(skipDuplicates)` re-insert `userId:null` copies = the B_TS4 36-row corruption. All imports rely on this constraint for dup-safety.

## Tournament import & ranking
- **Skill `tournament-import`** (`.claude/skills/tournament-import/SKILL.md`) — parses a Discord announcement + Challonge link, self-hosts the poster, displays the card, and imports cleanly (announce phase = upsert row; results phase = participants/matches + ranking recompute).
- **Helper `scripts/tournament-workflow.ts`** — idempotent: `--meta <json>` upserts the `tournaments` row; `--scraped <json>` imports participants/matches dup-safe (soft-links names to existing users, never creates users; `finalPlacement = standings.rank ?? finalRank`; W/L from completed matches). Stores `date` as the literal Paris wall-clock (the column is `timestamp WITHOUT time zone` — do **not** round-trip through `new Date().toISOString()`, the VPS is UTC+8).
- **Canonical results importer** for BTS: `apps/web/scripts/import-bts-tournaments.ts` (slug ids, user-linked). The legacy `import-bts-to-db.ts` (Prisma, removed `../src/lib/prisma`) is broken/superseded.
- **Source data**: `apps/web/data/exports/B_TS{n}.json` (processed `{metadata, participants, matches, standings}`), produced by `ChallongeScraper.scrape()` via `finalize-tournament.ts`. The Challonge SPA page is Cloudflare-gated (`cf_clearance` is IP-bound → curl/curl-impersonate get 403); the **`/module` embed endpoint is reachable via the bxc real browser** (stealth solves CF) — read `window._initialStoreState.TournamentStore`.
- **Ranking calculation** is documented in full (formulas, constants, triggers) in the Claude project memory `rpbey-ranking-and-import`. Summary: **global/BTS** = `participation(500) + placement bonus(1st 10000 / 2nd 7000 / 3rd 5000 / top8 500) + matchWinsWon×1000, ×category multiplier`; deduped by normalized name then consolidated by `userId`; recompute via `apps/web/scripts/recompute-rankings.ts` (no cron — admin/auto-sync/CLI). **Stardust** = bracket-phase-weighted match points (pool 250 / winner-bracket 1000 / loser-bracket 500) + placement (firstPlace **15000**); recompute via `apps/web/scripts/sync-stardust-canon.ts`. **SATR/WB are separate external imports** (Google Sheets / local Challonge JSON), not the same system.

## Maintenance scripts
- `scripts/refresh-discord-avatars.ts` — reloads stale Discord profile avatars (hash rotates → 404) by `discordId` for users + staff, re-syncs `global_rankings.avatarUrl`, and recovers no-`discordId` rows by parsing the id from the avatar URL. Run: `bun --env-file apps/bot/.env scripts/refresh-discord-avatars.ts`.

## Peer-coordination warning
A peer agent has been refactoring the Challonge code (`apps/web/src/lib/challonge-vendor` removal, DAL/scraper, `docs/`). **Always `git status` before editing `docs/`, `CLAUDE.md`, or any `challonge*` file**, and never commit while large uncommitted peer changes are in the tree (commit only your own paths selectively).
