"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-utils";
import { loadJsonSafe } from "@/lib/data-cache";
import {
  db,
  schema,
  and,
  or,
  eq,
  inArray,
  notInArray,
  gte,
  desc,
  ilike,
  count,
  sql,
} from "@/lib/db";

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
  let config = await db.query.rankingSystem.findFirst();

  if (!config) {
    const [created] = await db
      .insert(schema.rankingSystem)
      .values({
        participation: 500,
        firstPlace: 10000,
        secondPlace: 7000,
        thirdPlace: 5000,
        top8: 500,
        matchWin: 300,
        matchWinWinner: 1000,
        matchWinLoser: 500,
      })
      .returning();
    config = created;
  }

  return config!;
}

export async function getTournamentCategories() {
  return await db.query.tournamentCategories.findMany({
    orderBy: desc(schema.tournamentCategories.multiplier),
  });
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

  await db
    .update(schema.rankingSystem)
    .set(result.data)
    .where(eq(schema.rankingSystem.id, config.id));

  revalidatePath("/admin/rankings");
}

export async function recalculateRankings() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const config = await getRankingConfig();

  const currentSeason = await db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.isActive, true),
  });

  const playerPoints = new Map<string, number>();
  const playerStats = new Map<
    string,
    {
      wins: number;
      losses: number;
      tournamentWins: number;
      tournamentsCount: number;
      playerName: string;
      userId: string | null;
      challongeUsername: string | null;
      avatarUrl: string | null;
    }
  >();

  // 1. Load Mapper & JSON Data
  let mapper: Record<
    string,
    { primaryName: string; challongeUsername: string; aliases: string[] }
  > = {};
  interface EnrichedRankingEntry {
    playerKey: string;
    playerName: string;
    wins: number;
    losses: number;
    tournamentWins: number;
    tournamentsCount: number;
    totalPoints: number;
    challongeUsername: string | null;
    avatarUrl: string | null;
  }
  let enrichedData: EnrichedRankingEntry[] = [];
  try {
    // Sur Vercel : fetch CDN (cdn.rpbey.fr). Sur VPS : lecture FS directe.
    const [mapperData, enriched] = await Promise.all([
      loadJsonSafe<typeof mapper>("data/exports/participants_map.json"),
      loadJsonSafe<EnrichedRankingEntry[]>("data/exports/recalculated_ranking_s2_enriched.json"),
    ]);
    if (mapperData) mapper = mapperData;
    if (enriched) enrichedData = enriched;
  } catch {
    // JSON data files not available, skip BTS ranking data
  }

  // Inverse mapping: Map alias to normalized key
  const aliasToKey = new Map<string, string>();
  for (const [key, data] of Object.entries(mapper)) {
    for (const alias of data.aliases) {
      aliasToKey.set(alias, key);
    }
  }

  // 2. Process Enriched JSON Tournaments Data directly
  for (const d of enrichedData) {
    const playerKey = d.playerKey;
    const mapData = mapper[playerKey];

    playerStats.set(playerKey, {
      wins: d.wins,
      losses: d.losses,
      tournamentWins: d.tournamentWins,
      tournamentsCount: d.tournamentsCount,
      playerName: mapData?.primaryName || d.playerName,
      userId: null,
      challongeUsername: d.challongeUsername !== "new" ? d.challongeUsername : null,
      avatarUrl: d.avatarUrl,
    });

    playerPoints.set(playerKey, d.totalPoints);
  }

  // 3. Optional: Process DB tournaments if they exist in current season (excluding auto-imported ones to avoid dupes)
  const startDate = currentSeason?.startDate || new Date(0).toISOString();
  const dbTournaments = await db.query.tournaments.findMany({
    where: and(
      inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED", "UNDERWAY"]),
      gte(schema.tournaments.date, startDate),
      // Exclude the ones we just processed manually if they were somehow in DB
      notInArray(schema.tournaments.id, [
        "bts1",
        "bts2",
        "bts3",
        "bts4",
        "bts5",
        "cm-fr_b_ts2-auto",
        "cm-fr_b_ts3-auto",
        "cmoq5x3yc000009ro7zq1i3uj", // BTS1
        "cmoq5x49a005r09rosc122fr1", // BTS2
        "cmoq5x4fo00aq09roq2og3ihk", // BTS3
        "cmnukkwyt0000z4ro9fvkcko6", // BTS4
        "cmp019bpax2u1m5idwluippk0", // BTS5
      ]),
    ),
    with: {
      tournamentCategory: true,
      tournamentMatches: true,
      tournamentParticipants: {
        with: { user: { with: { profiles: true } } },
      },
    },
  });

  for (const tournament of dbTournaments) {
    const multiplier = tournament.tournamentCategory?.multiplier ?? tournament.weight ?? 1.0;
    for (const participant of tournament.tournamentParticipants) {
      const participantProfile = participant.user?.profiles[0] ?? null;
      if (
        !participant.checkedIn &&
        tournament.status !== "COMPLETE" &&
        tournament.status !== "ARCHIVED"
      )
        continue;

      const baseKey = (participant.playerName || participantProfile?.bladerName || "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const playerKey = aliasToKey.get(participant.playerName || "") || baseKey;
      const mapData = mapper[playerKey];

      let points = 0;
      const stats = playerStats.get(playerKey) || {
        wins: 0,
        losses: 0,
        tournamentWins: 0,
        tournamentsCount: 0,
        playerName:
          mapData?.primaryName ||
          participant.playerName ||
          participantProfile?.bladerName ||
          "Unknown",
        userId: participant.userId,
        challongeUsername:
          mapData?.challongeUsername || participantProfile?.challongeUsername || null,
        avatarUrl: participant.user?.image || null,
      };

      if (tournament.status === "COMPLETE" || tournament.status === "ARCHIVED") {
        stats.tournamentsCount += 1;
        stats.wins += participant.wins || 0;
        stats.losses += participant.losses || 0;
        if (participant.finalPlacement === 1) stats.tournamentWins += 1;
      }

      points += config.participation;
      if (participant.finalPlacement === 1) points += config.firstPlace;
      else if (participant.finalPlacement === 2) points += config.secondPlace;
      else if (participant.finalPlacement === 3) points += config.thirdPlace;
      else if (participant.finalPlacement && participant.finalPlacement <= 8) points += config.top8;

      const matchWins = tournament.tournamentMatches.filter(
        (m) =>
          (m.winnerId === participant.userId || m.winnerName === participant.playerName) &&
          m.state === "complete",
      );
      // RPB tournaments: all wins count equally (no WB/LB distinction)
      const winPts = matchWins.length * config.matchWinWinner;
      points += winPts;

      if (!stats.userId && participant.userId) stats.userId = participant.userId;
      if (!stats.avatarUrl && participant.user?.image) stats.avatarUrl = participant.user.image;
      playerStats.set(playerKey, stats);

      const currentPoints = playerPoints.get(playerKey) || 0;
      playerPoints.set(playerKey, currentPoints + Math.round(points * multiplier));
    }
  }

  // 4. Manual adjustments
  const adjustments = await db.query.pointAdjustments.findMany();
  for (const adj of adjustments) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, adj.userId),
      with: { profiles: true },
    });
    const userProfile = user?.profiles[0] ?? null;
    const baseKey = (userProfile?.bladerName || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "");
    const playerKey = aliasToKey.get(userProfile?.bladerName || "") || baseKey;
    const currentPoints = playerPoints.get(playerKey) || 0;
    playerPoints.set(playerKey, currentPoints + adj.points);
  }

  // 5. Batch update DB
  await db.transaction(async (tx) => {
    await tx.delete(schema.globalRankings); // Complete reset of current rankings to rebuild fresh

    const newRankings = [];
    for (const [playerKey, points] of playerPoints.entries()) {
      const stats = playerStats.get(playerKey);
      if (!stats) continue;

      newRankings.push({
        playerName: stats.playerName,
        points: points,
        wins: stats.wins,
        losses: stats.losses,
        tournamentWins: stats.tournamentWins,
        tournamentsCount: stats.tournamentsCount,
        avatarUrl: stats.avatarUrl,
        userId: stats.userId,
        challongeUsername: stats.challongeUsername,
      });
    }

    if (newRankings.length > 0) {
      await tx
        .insert(schema.globalRankings)
        .values(newRankings.map(({ challongeUsername: _challongeUsername, ...rest }) => rest))
        .onConflictDoNothing();
    }

    // Sync Profiles for UI compatibility
    for (const ranking of newRankings) {
      if (ranking.userId) {
        await tx
          .update(schema.profiles)
          .set({
            rankingPoints: ranking.points,
            wins: ranking.wins,
            losses: ranking.losses,
            tournamentWins: ranking.tournamentWins,
            ...(ranking.challongeUsername ? { challongeUsername: ranking.challongeUsername } : {}),
          })
          .where(eq(schema.profiles.userId, ranking.userId))
          .catch(() => {}); // Ignore if profile doesn't exist
      }
    }
  });

  try {
    revalidatePath("/rankings");
    revalidatePath("/admin/rankings");
  } catch {
    // Ignore error if revalidatePath is called outside of Next.js context
  }

  return {
    success: true,
    message: `Classement recalculé pour ${playerPoints.size} joueurs.`,
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

  const [category] = await db.insert(schema.tournamentCategories).values(result.data).returning();

  // revalidateTag('tournament-categories');
  revalidatePath("/admin/rankings");
  return category;
}

export async function updateTournamentCategory(
  id: string,
  data: { name?: string; multiplier?: number; color?: string },
) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  // Partial validation
  const [category] = await db
    .update(schema.tournamentCategories)
    .set(data)
    .where(eq(schema.tournamentCategories.id, id))
    .returning();
  // revalidateTag('tournament-categories');
  revalidatePath("/admin/rankings");
  return category;
}

export async function deleteTournamentCategory(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const [countRow] = await db
    .select({ value: count() })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.categoryId, id));
  const used = countRow?.value ?? 0;
  if (used > 0) {
    throw new Error(
      `Impossible de supprimer cette catégorie car elle est utilisée par ${used} tournois.`,
    );
  }

  await db.delete(schema.tournamentCategories).where(eq(schema.tournamentCategories.id, id));
  // revalidateTag('tournament-categories');
  revalidatePath("/admin/rankings");
  return { success: true };
}

// --- GESTION DES AJUSTEMENTS MANUELS ---

export async function getPointAdjustments(limit = 20) {
  const rows = await db.query.pointAdjustments.findMany({
    limit,
    orderBy: desc(schema.pointAdjustments.createdAt),
    with: {
      user_userId: {
        columns: { id: true, name: true, image: true },
      },
      user_adminId: {
        columns: { name: true },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    user: r.user_userId,
    admin: r.user_adminId,
  }));
}

export async function addPointAdjustment(userId: string, points: number, reason: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const [adjustment] = await db
    .insert(schema.pointAdjustments)
    .values({
      userId,
      points,
      reason,
      adminId: session.user.id,
    })
    .returning();

  await db
    .update(schema.profiles)
    .set({
      rankingPoints: sql`${schema.profiles.rankingPoints} + ${points}`,
    })
    .where(eq(schema.profiles.userId, userId));

  revalidatePath("/admin/rankings");
  return adjustment;
}

export async function deletePointAdjustment(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const adjustment = await db.query.pointAdjustments.findFirst({
    where: eq(schema.pointAdjustments.id, id),
  });
  if (!adjustment) throw new Error("Ajustement introuvable");

  await db.delete(schema.pointAdjustments).where(eq(schema.pointAdjustments.id, id));

  await db
    .update(schema.profiles)
    .set({
      rankingPoints: sql`${schema.profiles.rankingPoints} - ${adjustment.points}`,
    })
    .where(eq(schema.profiles.userId, adjustment.userId));

  revalidatePath("/admin/rankings");
}

export async function searchUsers(query: string) {
  if (query.length < 2) return [];

  return await db.query.users.findMany({
    where: or(
      ilike(schema.users.name, `%${query}%`),
      ilike(schema.users.email, `%${query}%`),
      ilike(schema.users.discordTag, `%${query}%`),
    ),
    limit: 5,
    columns: {
      id: true,
      name: true,
      image: true,
      email: true,
    },
  });
}
