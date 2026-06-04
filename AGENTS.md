<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- Project note (outside the managed block): the Next.js app is `apps/web`.
     `next` is hoisted to the repo-root `node_modules/`, so the docs path above is
     correct when working from the repo root. See `apps/web/AGENTS.md` for the
     web-app conventions and `CLAUDE.md` for the operator spec. -->

## Ops essentials (read before touching DB / deploy / tournaments)

- **Serverless**: web → Vercel (`fra1`, Bun runtime), bot → Cloud Run (`europe-west3`). CORS open everywhere; servers bind `0.0.0.0:$PORT`; only `os.tmpdir()` is writable on Vercel. Images use `images.unoptimized` (Vercel optimizer is plan-capped → 402).
- **DB = Neon Postgres, Frankfurt (`eu-central-1`)**, pooled via `@rpbey/db` (`DATABASE_URL`, `prepare:false`); migrations use `DIRECT_DATABASE_URL`. Not local Postgres in prod.
- **Tournaments are keyed on the slug** (`challongeId` = `B_TS{n}` / `T_SS{n}`, row id = `bts{n}` / `tss{n}`) — never the numeric Challonge id (that legacy set was a duplicate, deleted). `tournament_participants` has `UNIQUE(tournamentId, challongeParticipantId)` — imports rely on it for dup-safety.
- **Import a tournament**: use the **`tournament-import` skill** (`.claude/skills/tournament-import/`) → `scripts/tournament-workflow.ts` (`--meta` to announce, `--scraped` for results). Recompute ranking: `apps/web/scripts/sync-stardust-canon.ts` (Stardust) or `apps/web/scripts/recompute-rankings.ts` (BTS/global). Full ranking formulas + import pipeline: **[`docs/ops-serverless-db-ranking.md`](docs/ops-serverless-db-ranking.md)**.
- **Challonge** SPA is Cloudflare-gated (cf_clearance is IP-bound → curl 403); the `/module` embed endpoint is reachable via the bxc real browser.
- **Concurrency**: a peer agent refactors the Challonge code — `git status` before editing `docs/`, `CLAUDE.md`, `challonge*`; commit only your own paths, never sweep peer WIP.
