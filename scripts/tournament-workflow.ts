#!/usr/bin/env bun
/**
 * tournament-workflow.ts — import/announce ANY RPB tournament cleanly into the
 * Neon DB from a parsed Discord announcement (+ optional bracket results).
 *
 * Backs the `tournament-import` skill. Two phases, both idempotent:
 *   --meta <metadata.json>          → upsert the `tournaments` row (announce).
 *   --meta + --scraped <results.json> → also import participants + matches
 *                                       (dup-safe) and stamp finalPlacement/W/L.
 *
 * metadata.json (produced by the skill from the announcement):
 * { id, challongeId, challongeUrl, name, date(ISO), location, format,
 *   maxPlayers, status, challongeState, categoryName, posterUrl, description }
 *
 * results.json = the processed ScrapedTournament shape (same as
 * apps/web/data/exports/B_TS{n}.json): { metadata, participants:[{id,name,
 * seed,finalRank}], matches:[{id,round,player1Id,player2Id,winnerId,loserId,
 * scores,state}], standings:[{name,rank}] }.
 *
 * Anti-doublon: upserts on UNIQUE(tournamentId, challongeParticipantId) and
 * UNIQUE(tournamentId, challongeMatchId). Never creates users (soft-links by
 * name to existing users/profiles, like import-bts-tournaments.ts).
 *
 * Run from repo root:
 *   bun --env-file apps/web/.env scripts/tournament-workflow.ts --meta /tmp/t.json [--scraped /tmp/r.json]
 *
 * Ranking recompute is a SEPARATE step (see the skill): STARDUST →
 * `bun apps/web/scripts/sync-stardust-canon.ts`; global/BTS →
 * `bun apps/web/scripts/recompute-rankings.ts`.
 */
import { db, schema } from "@rpbey/db";
import { and, eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";

const VALID_STATUS = new Set([
  "UPCOMING",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "CHECKIN",
  "UNDERWAY",
  "COMPLETE",
  "CANCELLED",
  "ARCHIVED",
]);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function normalizeName(raw: string): string {
  return (raw ?? "").split("/")[0]!.trim();
}

interface Meta {
  id: string;
  challongeId: string;
  challongeUrl?: string;
  name: string;
  date?: string;
  location?: string;
  format?: string;
  maxPlayers?: number;
  status?: string;
  challongeState?: string;
  categoryName?: string;
  posterUrl?: string;
  description?: string;
}

async function upsertTournament(m: Meta): Promise<string> {
  if (!m.id || !m.challongeId || !m.name) throw new Error("meta requires id, challongeId, name");
  const status = (
    m.status && VALID_STATUS.has(m.status) ? m.status : "UPCOMING"
  ) as (typeof schema.tournaments.$inferInsert)["status"];
  const now = new Date().toISOString();

  // Resolve category by name (substring, case-insensitive) → drives ranking classification.
  let categoryId: string | null = null;
  if (m.categoryName) {
    const cats = await db
      .select({ id: schema.tournamentCategories.id, name: schema.tournamentCategories.name })
      .from(schema.tournamentCategories);
    categoryId =
      cats.find((c) => c.name?.toLowerCase().includes(m.categoryName!.toLowerCase()))?.id ?? null;
    if (!categoryId)
      console.warn(
        `[warn] no tournament_category matching "${m.categoryName}" — categoryId left null`,
      );
  }

  const fields = {
    name: m.name,
    challongeUrl: m.challongeUrl ?? `https://challonge.com/fr/${m.challongeId}`,
    challongeState: m.challongeState ?? null,
    status,
    format: m.format ?? null,
    location: m.location ?? null,
    maxPlayers: m.maxPlayers ?? null,
    posterUrl: m.posterUrl ?? null,
    description: m.description ?? null,
    categoryId,
    // `date` is `timestamp WITHOUT time zone` = the event's wall-clock (Paris).
    // Store the literal value; do NOT round-trip through `new Date().toISOString()`
    // (that shifts by the VPS local TZ — e.g. UTC+8 turned 13:00 into 05:00).
    ...(m.date ? { date: m.date.replace("T", " ") } : {}),
    updatedAt: now,
  };

  const [existing] = await db
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.challongeId, m.challongeId));
  if (existing) {
    await db.update(schema.tournaments).set(fields).where(eq(schema.tournaments.id, existing.id));
    return existing.id;
  }
  await db.insert(schema.tournaments).values({
    id: m.id,
    challongeId: m.challongeId,
    ...fields,
    date: m.date ? m.date.replace("T", " ") : now,
  });
  return m.id;
}

interface ScrapedP {
  id: number;
  name: string;
  seed?: number | null;
  finalRank?: number | null;
  challongeUsername?: string | null;
  challongeProfileUrl?: string | null;
}
interface ScrapedM {
  id: number;
  round: number;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  loserId: number | null;
  scores?: string | null;
  state: string;
}

async function importResults(tid: string, scrapedPath: string): Promise<{ p: number; m: number }> {
  const data = JSON.parse(await readFile(scrapedPath, "utf-8")) as {
    participants?: ScrapedP[];
    matches?: ScrapedM[];
    standings?: { name: string; rank: number }[];
  };
  const participants = data.participants ?? [];
  const matches = data.matches ?? [];
  const standings = data.standings ?? [];
  const now = new Date().toISOString();

  // Soft-link participant names to existing user accounts (never create users).
  const users = await db
    .select({ id: schema.users.id, name: schema.users.name, username: schema.users.username })
    .from(schema.users);
  const profiles = await db
    .select({ userId: schema.profiles.userId, bladerName: schema.profiles.bladerName })
    .from(schema.profiles);
  const userByKey = new Map<string, string>();
  for (const u of users)
    for (const c of [u.name, u.username])
      if (c) userByKey.set(normalizeName(c).toLowerCase(), u.id);
  for (const p of profiles)
    if (p.bladerName && p.userId)
      userByKey.set(normalizeName(p.bladerName).toLowerCase(), p.userId);

  // W/L from completed matches (by challonge participant id).
  const wins = new Map<number, number>();
  const losses = new Map<number, number>();
  for (const mt of matches) {
    if (mt.state !== "complete") continue;
    if (mt.winnerId != null) wins.set(mt.winnerId, (wins.get(mt.winnerId) ?? 0) + 1);
    if (mt.loserId != null) losses.set(mt.loserId, (losses.get(mt.loserId) ?? 0) + 1);
  }
  const idToName = new Map<number, string>();
  for (const p of participants) idToName.set(p.id, p.name);
  const standingByName = new Map<string, number>();
  for (const s of standings) standingByName.set(normalizeName(s.name).toLowerCase(), s.rank);

  if (participants.length) {
    await db
      .insert(schema.tournamentParticipants)
      .values(
        participants.map((p) => ({
          id: `tp-${tid}-${p.id}`,
          tournamentId: tid,
          challongeParticipantId: String(p.id),
          userId: userByKey.get(normalizeName(p.name).toLowerCase()) ?? null,
          playerName: p.name,
          seed: p.seed ?? null,
          finalPlacement:
            standingByName.get(normalizeName(p.name).toLowerCase()) ?? p.finalRank ?? null,
          wins: wins.get(p.id) ?? 0,
          losses: losses.get(p.id) ?? 0,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }
  if (matches.length) {
    await db
      .insert(schema.tournamentMatches)
      .values(
        matches.map((mt) => ({
          id: `tm-${tid}-${mt.id}`,
          tournamentId: tid,
          challongeMatchId: String(mt.id),
          round: mt.round,
          player1Name: mt.player1Id != null ? (idToName.get(mt.player1Id) ?? null) : null,
          player2Name: mt.player2Id != null ? (idToName.get(mt.player2Id) ?? null) : null,
          winnerName: mt.winnerId != null ? (idToName.get(mt.winnerId) ?? null) : null,
          score: mt.scores ?? null,
          state: mt.state,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }

  // Construct and persist standings to the tournaments table
  const dbStandings = participants
    .map((p) => {
      const finalPlacement =
        standingByName.get(normalizeName(p.name).toLowerCase()) ?? p.finalRank ?? null;
      return {
        rank: finalPlacement,
        name: p.name,
        wins: wins.get(p.id) ?? 0,
        losses: losses.get(p.id) ?? 0,
        challongeUsername: p.challongeUsername ?? null,
        challongeProfileUrl: p.challongeProfileUrl ?? null,
        stats: {
          wins: wins.get(p.id) ?? 0,
          losses: losses.get(p.id) ?? 0,
        },
      };
    })
    .filter((s) => s.rank !== null && s.rank > 0)
    .sort((a, b) => a.rank! - b.rank!);

  if (dbStandings.length) {
    await db
      .update(schema.tournaments)
      .set({ standings: dbStandings as any })
      .where(eq(schema.tournaments.id, tid));
  }

  return { p: participants.length, m: matches.length };
}

async function main() {
  const metaPath = arg("--meta");
  if (!metaPath) throw new Error("--meta <metadata.json> is required");
  const meta = JSON.parse(await readFile(metaPath, "utf-8")) as Meta;
  const tid = await upsertTournament(meta);
  console.log(
    `✓ tournament upserted: id=${tid} challongeId=${meta.challongeId} status=${meta.status ?? "UPCOMING"}`,
  );

  const scrapedPath = arg("--scraped");
  if (scrapedPath) {
    const r = await importResults(tid, scrapedPath);
    console.log(`✓ results imported (dup-safe): ${r.p} participants, ${r.m} matches`);
    console.log(
      `→ next: recompute ranking — STARDUST: bun apps/web/scripts/sync-stardust-canon.ts ; else: bun apps/web/scripts/recompute-rankings.ts`,
    );
  } else {
    console.log(`(announce-only: no --scraped → no participants/matches imported)`);
  }
}

main()
  .then(() => db.$client.end())
  .catch(async (e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    await db.$client.end().catch(() => {});
    process.exit(1);
  });
