"use server";

import { revalidatePath } from "next/cache";
import { type TournamentStatus } from "@/lib/types";
import { getChallongeService } from "@/lib/challonge";
import {
  createTournamentRow,
  deleteTournamentRow,
  listExistingChallongeIds,
  listTournamentsAdmin,
  updateTournamentRow,
} from "@/server/dal/tournaments";
import { requireAdmin } from "@/lib/auth-utils";

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
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  const communityId = process.env.CHALLONGE_COMMUNITY_ID;
  if (!communityId) {
    throw new Error("CHALLONGE_COMMUNITY_ID is not configured");
  }

  const service = getChallongeService();

  // Fetch ALL tournaments from Challonge using the new pagination method
  // We don't filter by state to get everything available (including past ones we might have missed)
  const challongeTournaments = await service.fetchAllCommunityTournaments(communityId);

  // Get existing tournaments to avoid duplicates
  const existingIds = new Set(
    await listExistingChallongeIds(challongeTournaments.map((t) => t.id)),
  );

  // Filter out existing tournaments
  const newTournaments = challongeTournaments.filter((t) => !existingIds.has(t.id));

  return newTournaments;
}

export async function importTournamentFromChallonge(challongeId: string) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  const service = getChallongeService();
  const tournament = await service.getTournament(challongeId);
  const t = tournament.attributes;

  // Map Challonge state to our status
  let status: TournamentStatus = "UPCOMING";
  if (t.state === "pending") status = "REGISTRATION_OPEN";
  if (t.state === "in_progress" || t.state === "underway") status = "UNDERWAY";
  if (t.state === "complete" || t.state === "ended") status = "COMPLETE";

  await createTournamentRow({
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
  return listTournamentsAdmin(page, pageSize, search);
}

export async function createTournament(data: TournamentInput) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
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

  await createTournamentRow({
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
  if (!(await requireAdmin())) throw new Error("Non autorisé");
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

  await updateTournamentRow(id, {
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
  revalidatePath("/tournaments"); // Revalidate marketing page if exists
}

export async function deleteTournament(id: string) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  await deleteTournamentRow(id);

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
}
