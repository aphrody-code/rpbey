"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-utils";
import {
  bumpProfilePoints,
  countTournamentsByCategory,
  createTournamentCategory as dalCreateCategory,
  deletePointAdjustment as dalDeletePointAdjustment,
  deleteTournamentCategory as dalDeleteCategory,
  getOrCreateRankingSystem,
  getPointAdjustment,
  insertPointAdjustment,
  listPointAdjustments,
  listTournamentCategories,
  searchUsers as dalSearchUsers,
  updateRankingSystem,
  updateTournamentCategory as dalUpdateCategory,
} from "@/server/dal/rankings";
import { runFullRecalculation } from "@/server/services/rankings";

// Zod Schemas
const RankingConfigSchema = z.object({
  participation: z.number().int().min(0),
  firstPlace: z.number().int().min(0),
  secondPlace: z.number().int().min(0),
  thirdPlace: z.number().int().min(0),
  top8: z.number().int().min(0),
  matchWinWinner: z.number().int().min(0),
  matchWinLoser: z.number().int().min(0),
});

const CategorySchema = z.object({
  name: z.string().min(2),
  multiplier: z.number().min(0.1),
  color: z.string().optional(),
});

// Cached Data Fetching
export async function getRankingConfig() {
  return getOrCreateRankingSystem();
}

export async function getTournamentCategories() {
  return listTournamentCategories();
}

// Mutations
export async function updateRankingConfig(data: {
  participation: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  top8: number;
  matchWinWinner: number;
  matchWinLoser: number;
}) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const result = RankingConfigSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }

  const config = await getRankingConfig();
  await updateRankingSystem(config.id, result.data);

  revalidatePath("/admin/rankings");
}

export async function recalculateRankings() {
  if (!(await requireAdmin())) throw new Error("Forbidden");

  // Chemin COMPLET unique (global_rankings + miroir profils, inscrits + non-inscrits).
  const { playersRanked, linkedToUser } = await runFullRecalculation();

  try {
    revalidatePath("/rankings");
    revalidatePath("/admin/rankings");
  } catch {
    // Ignore error if revalidatePath is called outside of Next.js context
  }

  return {
    success: true,
    message: `Classement recalculé pour ${playersRanked} joueurs (${linkedToUser} liés à un compte).`,
  };
}

export async function createTournamentCategory(data: {
  name: string;
  multiplier: number;
  color?: string;
}) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const result = CategorySchema.safeParse(data);
  if (!result.success) throw new Error("Invalid category data");

  const category = await dalCreateCategory(result.data);

  revalidatePath("/admin/rankings");
  return category;
}

export async function updateTournamentCategory(
  id: string,
  data: { name?: string; multiplier?: number; color?: string },
) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  // Partial validation
  const category = await dalUpdateCategory(id, data);
  revalidatePath("/admin/rankings");
  return category;
}

export async function deleteTournamentCategory(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const used = await countTournamentsByCategory(id);
  if (used > 0) {
    throw new Error(
      `Impossible de supprimer cette catégorie car elle est utilisée par ${used} tournois.`,
    );
  }

  await dalDeleteCategory(id);
  revalidatePath("/admin/rankings");
  return { success: true };
}

// --- GESTION DES AJUSTEMENTS MANUELS ---

export async function getPointAdjustments(limit = 20) {
  return listPointAdjustments(limit);
}

export async function addPointAdjustment(userId: string, points: number, reason: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const adjustment = await insertPointAdjustment({
    userId,
    points,
    reason,
    adminId: session.user.id,
  });

  await bumpProfilePoints(userId, points);

  revalidatePath("/admin/rankings");
  return adjustment;
}

export async function deletePointAdjustment(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const adjustment = await getPointAdjustment(id);
  if (!adjustment) throw new Error("Ajustement introuvable");

  await dalDeletePointAdjustment(id);

  await bumpProfilePoints(adjustment.userId, -adjustment.points);

  revalidatePath("/admin/rankings");
}

export async function searchUsers(query: string) {
  if (query.length < 2) return [];

  return dalSearchUsers(query);
}
