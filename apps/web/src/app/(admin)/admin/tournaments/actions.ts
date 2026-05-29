"use server";

import { revalidatePath } from "next/cache";
import { type TournamentStatus } from "@/lib/types";
import { getChallongeService } from "@/lib/challonge";
import { db, schema, and, count, desc, eq, ilike, inArray, or } from "@/lib/db";

export type TournamentInput = {
  name: string;
  description?: string | null;
  date: string | Date;
  location?: string | null;
  format: string;
  maxPlayers: number;
  status: TournamentStatus;
  challongeUrl?: string | null;
  categoryId?: string | null;
  weight?: number;
};

export async function syncCommunityTournaments() {
  const communityId = process.env.CHALLONGE_COMMUNITY_ID;
  if (!communityId) {
    throw new Error("CHALLONGE_COMMUNITY_ID is not configured");
  }

  const service = getChallongeService();

  // Fetch ALL tournaments from Challonge using the new pagination method
  // We don't filter by state to get everything available (including past ones we might have missed)
  const challongeTournaments = await service.fetchAllCommunityTournaments(communityId);

  // Get existing tournaments to avoid duplicates
  const existingTournaments = await db.query.tournaments.findMany({
    where: inArray(
      schema.tournaments.challongeId,
      challongeTournaments.map((t) => t.id),
    ),
    columns: { challongeId: true },
  });

  const existingIds = new Set(existingTournaments.map((t) => t.challongeId));

  // Filter out existing tournaments
  const newTournaments = challongeTournaments.filter((t) => !existingIds.has(t.id));

  return newTournaments;
}

export async function importTournamentFromChallonge(challongeId: string) {
  const service = getChallongeService();
  const tournament = await service.getTournament(challongeId);
  const t = tournament.attributes;

  // Map Challonge state to our status
  let status: TournamentStatus = "UPCOMING";
  if (t.state === "pending") status = "REGISTRATION_OPEN";
  if (t.state === "in_progress" || t.state === "underway") status = "UNDERWAY";
  if (t.state === "complete" || t.state === "ended") status = "COMPLETE";

  await db.insert(schema.tournaments).values({
    name: t.name,
    description: t.description,
    date: (t.startAt ? new Date(t.startAt) : new Date()).toISOString(),
    format: t.tournamentType,
    maxPlayers: 64, // Default
    status,
    challongeId: tournament.id,
    challongeUrl: t.url, // Usually just the slug
  });

  revalidatePath("/admin/tournaments");
}

export async function getTournaments(page = 1, pageSize = 10, search = "") {
  const skip = (page - 1) * pageSize;

  const where = search
    ? or(
        ilike(schema.tournaments.name, `%${search}%`),
        ilike(schema.tournaments.description, `%${search}%`),
      )
    : undefined;

  const [tournaments, totalRows, totalAll, activeRows, participantRows] = await Promise.all([
    db.query.tournaments.findMany({
      where,
      offset: skip,
      limit: pageSize,
      orderBy: desc(schema.tournaments.date),
    }),
    db.select({ value: count() }).from(schema.tournaments).where(where),
    db.select({ value: count() }).from(schema.tournaments),
    db
      .select({ value: count() })
      .from(schema.tournaments)
      .where(inArray(schema.tournaments.status, ["REGISTRATION_OPEN", "UNDERWAY", "CHECKIN"])),
    db.select({ value: count() }).from(schema.tournamentParticipants),
  ]);

  const total = totalRows[0]?.value ?? 0;

  // Participant counts per tournament (Prisma _count.participants)
  const tournamentIds = tournaments.map((t) => t.id);
  const countById = new Map<string, number>();
  if (tournamentIds.length > 0) {
    const rows = await db
      .select({
        tournamentId: schema.tournamentParticipants.tournamentId,
        value: count(),
      })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.tournamentId, tournamentIds))
      .groupBy(schema.tournamentParticipants.tournamentId);
    for (const r of rows) {
      countById.set(r.tournamentId, r.value);
    }
  }

  const tournamentsWithCount = tournaments.map((t) => ({
    ...t,
    _count: { participants: countById.get(t.id) ?? 0 },
  }));

  return {
    tournaments: tournamentsWithCount,
    total,
    summary: {
      totalTournaments: totalAll[0]?.value ?? 0,
      activeTournaments: activeRows[0]?.value ?? 0,
      totalParticipants: participantRows[0]?.value ?? 0,
    },
  };
}

export async function createTournament(data: TournamentInput) {
  const {
    name,
    description,
    date,
    location,
    format,
    maxPlayers,
    status,
    challongeUrl,
    categoryId,
    weight,
  } = data;

  await db.insert(schema.tournaments).values({
    name,
    description,
    date: new Date(date).toISOString(),
    location,
    format,
    maxPlayers,
    status,
    challongeUrl,
    categoryId,
    weight: weight || 1.0,
  });

  revalidatePath("/admin/tournaments");
}

export async function updateTournament(id: string, data: TournamentInput) {
  const {
    name,
    description,
    date,
    location,
    format,
    maxPlayers,
    status,
    challongeUrl,
    categoryId,
    weight,
  } = data;

  await db
    .update(schema.tournaments)
    .set({
      name,
      description,
      date: new Date(date).toISOString(),
      location,
      format,
      maxPlayers,
      status,
      challongeUrl,
      categoryId,
      weight: weight || 1.0,
    })
    .where(eq(schema.tournaments.id, id));

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments"); // Revalidate marketing page if exists
}

export async function deleteTournament(id: string) {
  await db.delete(schema.tournaments).where(eq(schema.tournaments.id, id));

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
}
