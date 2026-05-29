"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { buildStardustSyncPlan, DEFAULT_STARDUST_CONFIG, keyOf } from "@/lib/stardust-sync-bts";
import {
  getRankingSystemConfig,
  getStardustBladerByName as getStardustBladerByNameDal,
  getTournamentTop10,
  listStardustBladers,
  listUsersForStardustLink,
  loadStardustSyncTournaments,
  loadStardustTournaments,
  persistStardustRankings,
  resolveStardustTournamentId,
  setStardustBladerLink,
} from "@/server/dal/gacha";

export interface StardustTournamentMeta {
  slug: string;
  tournamentId: string;
  label: string;
  date: string;
  participantsCount: number;
  matchesCount: number;
  format: string;
}

export async function syncStardustRanking() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  // Formule BTS canonique (participation + finalRank bucket + matchWin) —
  // plan pur factorisé dans `@/lib/stardust-sync-bts`, I/O via la DAL.
  try {
    const tournaments = await loadStardustSyncTournaments();
    if (tournaments.length === 0) {
      return {
        success: false as const,
        error: "Aucun tournoi Stardust trouvé en base",
      };
    }
    const config = (await getRankingSystemConfig()) ?? DEFAULT_STARDUST_CONFIG;
    const plan = buildStardustSyncPlan(tournaments, config);
    await persistStardustRankings(plan.ranked, plan.bladers);
    revalidatePath("/tournaments/stardust");
    revalidatePath("/rankings");
    return {
      success: true as const,
      count: plan.ranked.length,
      tournamentCount: plan.tournamentCount,
    };
  } catch (error) {
    console.error("Stardust sync error:", error);
    return { success: false as const, error: String(error) };
  }
}

export async function getStardustSeasonStats() {
  try {
    const tournaments = await loadStardustTournaments();
    const uniqueNames = new Set<string>();
    const metas: StardustTournamentMeta[] = [];
    for (const t of tournaments) {
      metas.push({
        slug: t.id,
        tournamentId: t.id,
        label: t.name,
        date: t.date.toISOString(),
        participantsCount: t.participants.length,
        matchesCount: t.matches.length,
        format: t.format || "double elimination",
      });
      for (const p of t.participants) {
        if (p.playerName) uniqueNames.add(keyOf(p.playerName));
      }
    }
    return {
      success: true as const,
      data: {
        tournamentCount: tournaments.length,
        uniqueParticipants: uniqueNames.size,
        metas,
      },
    };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

export async function getStardustBladerByName(name: string) {
  try {
    const blader = await getStardustBladerByNameDal(name);
    return { success: true as const, data: blader ?? null };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

/**
 * Top 10 d'un tournoi Stardust depuis la DB.
 * Accepte soit l'id, soit un slug/label — résout d'abord par id, puis
 * fallback sur recherche `name ILIKE` dans les tournois Stardust.
 */
export async function getStardustTournamentTop10(idOrSlug: string): Promise<{
  success: boolean;
  data?: Array<{ rank: number; name: string }>;
  error?: string;
}> {
  try {
    const tournamentId = await resolveStardustTournamentId(idOrSlug);
    if (!tournamentId) return { success: true, data: [] };

    const participants = await getTournamentTop10(tournamentId);
    const top10 = participants.map((p, i) => ({
      rank: p.finalPlacement ?? i + 1,
      name: p.playerName ?? "—",
    }));

    return { success: true, data: top10 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function linkStardustBladers() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const bladers = await listStardustBladers();
    const users = await listUsersForStardustLink();
    let linkedCount = 0;
    for (const blader of bladers) {
      const match = users.find(
        (u) =>
          (u.name && u.name.toLowerCase() === blader.name.toLowerCase()) ||
          (u.discordTag && u.discordTag.toLowerCase() === blader.name.toLowerCase()),
      );
      if (match && blader.linkedUserId !== match.id) {
        await setStardustBladerLink(blader.id, match.id);
        linkedCount++;
      }
    }
    revalidatePath("/tournaments/stardust");
    return { success: true as const, linkedCount };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}
