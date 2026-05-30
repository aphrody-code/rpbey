import "server-only";
import {
  db,
  schema,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
  sum,
} from "@/lib/db";

/**
 * Data Access Layer — classements (SATR / Wild Breakers / Stardust / global RPB).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Reçoit la logique DB anciennement éparpillée dans `lib/ranking-service.ts`,
 * `lib/auto-sync-ranking.ts`, les routes `admin/ranking[/sync]`,
 * `admin/export/rankings`, `external/v1/leaderboard` et les actions
 * `ranking.ts` / `satr.ts` / `wb.ts`.
 *
 * Invariant timestamp : toutes les tables ici sont `mode:"string"` (ISO).
 * Écriture d'une colonne timestamp = string ISO ; lecture = string ISO renvoyée.
 */

type SatrRankingInsert = typeof schema.satrRankings.$inferInsert;
type WbRankingInsert = typeof schema.wbRankings.$inferInsert;
type StardustRankingInsert = typeof schema.stardustRankings.$inferInsert;
type GlobalRankingInsert = typeof schema.globalRankings.$inferInsert;
type RankingSystemInsert = typeof schema.rankingSystem.$inferInsert;

// --- Tables par famille (DRY pour les listes paginées / counts / sync) ------

const RANKING_TABLE = {
  satr: schema.satrRankings,
  wb: schema.wbRankings,
  stardust: schema.stardustRankings,
} as const;

const BLADER_TABLE = {
  satr: schema.satrBladers,
  wb: schema.wbBladers,
  stardust: schema.stardustBladers,
} as const;

export type SeasonRankingKind = keyof typeof RANKING_TABLE;

// --- Système de classement (rankingSystem) ---------------------------------

export async function getRankingSystem() {
  return db.query.rankingSystem.findFirst();
}

/** Récupère la config OU la crée avec les valeurs par défaut RPB si absente. */
export async function getOrCreateRankingSystem() {
  const existing = await db.query.rankingSystem.findFirst();
  if (existing) return existing;
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
  return created!;
}

export async function updateRankingSystem(id: string, data: Partial<RankingSystemInsert>) {
  await db.update(schema.rankingSystem).set(data).where(eq(schema.rankingSystem.id, id));
}

export async function insertRankingSystem(data: RankingSystemInsert) {
  await db.insert(schema.rankingSystem).values(data);
}

// --- Catégories de tournoi (multiplicateurs de points) ----------------------

export async function listTournamentCategories() {
  return db.query.tournamentCategories.findMany({
    orderBy: desc(schema.tournamentCategories.multiplier),
  });
}

export async function createTournamentCategory(data: {
  name: string;
  multiplier: number;
  color?: string;
}) {
  const [category] = await db.insert(schema.tournamentCategories).values(data).returning();
  return category!;
}

export async function updateTournamentCategory(
  id: string,
  data: { name?: string; multiplier?: number; color?: string },
) {
  const [category] = await db
    .update(schema.tournamentCategories)
    .set(data)
    .where(eq(schema.tournamentCategories.id, id))
    .returning();
  return category ?? null;
}

export async function countTournamentsByCategory(categoryId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.categoryId, categoryId));
  return row?.value ?? 0;
}

export async function deleteTournamentCategory(id: string) {
  await db.delete(schema.tournamentCategories).where(eq(schema.tournamentCategories.id, id));
}

// --- Ajustements manuels de points ------------------------------------------

export async function listPointAdjustments(limit = 20) {
  const rows = await db.query.pointAdjustments.findMany({
    limit,
    orderBy: desc(schema.pointAdjustments.createdAt),
    with: {
      user_userId: { columns: { id: true, name: true, image: true } },
      user_adminId: { columns: { name: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    user: r.user_userId,
    admin: r.user_adminId,
  }));
}

export async function getPointAdjustment(id: string) {
  return db.query.pointAdjustments.findFirst({
    where: eq(schema.pointAdjustments.id, id),
  });
}

export async function insertPointAdjustment(data: {
  userId: string;
  points: number;
  reason: string;
  adminId: string;
}) {
  const [adjustment] = await db.insert(schema.pointAdjustments).values(data).returning();
  return adjustment!;
}

export async function deletePointAdjustment(id: string) {
  await db.delete(schema.pointAdjustments).where(eq(schema.pointAdjustments.id, id));
}

export async function bumpProfilePoints(userId: string, delta: number) {
  await db
    .update(schema.profiles)
    .set({ rankingPoints: sql`${schema.profiles.rankingPoints} + ${delta}` })
    .where(eq(schema.profiles.userId, userId));
}

// --- Recherche utilisateurs (autocomplete ajustements) ----------------------

export async function searchUsers(query: string, limit = 5) {
  return db.query.users.findMany({
    where: or(
      ilike(schema.users.name, `%${query}%`),
      ilike(schema.users.email, `%${query}%`),
      ilike(schema.users.discordTag, `%${query}%`),
    ),
    limit,
    columns: { id: true, name: true, image: true, email: true },
  });
}

// --- Saisons ----------------------------------------------------------------

export async function getActiveSeason() {
  return db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.isActive, true),
  });
}

// --- Auto-sync (helper `lib/auto-sync-ranking`) -----------------------------

/** Tournoi + sa catégorie (pour décider quel classement resynchroniser). */
export async function getTournamentForAutoSync(tournamentId: string) {
  return db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, tournamentId),
    with: { tournamentCategory: true },
  });
}

// --- Recalcul global (server action `recalculateRankings`) ------------------

/**
 * Tournois éligibles au recalcul global (status COMPLETE/ARCHIVED/UNDERWAY).
 *
 * `startDate` OPTIONNEL : le leaderboard global RPB est ALL-TIME (cross-saison), donc
 * par défaut aucun filtre date — on agrège TOUS les tournois terminés (sinon les BTS
 * antérieurs à la saison active seraient amputés). Passer `startDate` ne sert qu'à un
 * recalcul borné par saison. `excludeIds` reste l'anti-double-compte BTS↔enrichi.
 */
export async function listTournamentsForRecalc(params: {
  startDate?: string;
  excludeIds: string[];
}) {
  const conditions = [inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED", "UNDERWAY"])];
  // `NOT IN ()` est invalide en SQL → n'ajouter le filtre que si la liste est non vide.
  if (params.excludeIds.length > 0) {
    conditions.push(notInArray(schema.tournaments.id, params.excludeIds));
  }
  if (params.startDate) conditions.push(gte(schema.tournaments.date, params.startDate));
  return db.query.tournaments.findMany({
    where: and(...conditions),
    with: {
      tournamentCategory: true,
      tournamentMatches: true,
      tournamentParticipants: { with: { user: { with: { profiles: true } } } },
    },
  });
}

export async function listAllPointAdjustments() {
  return db.query.pointAdjustments.findMany();
}

/**
 * Identités de tous les users (+ profil) pour la liaison nom→compte du recalcul global.
 * Renvoie chaque user avec ses noms possibles (username/displayUsername/name/globalName/
 * discordTag) + challongeUsername/bladerName du profil → matching normalisé conservateur
 * dans `computeRankings`, pour rattacher un `playerName` non-inscrit à un compte.
 */
export async function listUsersForRankingLink() {
  const rows = await db.query.users.findMany({
    columns: {
      id: true,
      image: true,
      username: true,
      displayUsername: true,
      name: true,
      globalName: true,
      discordTag: true,
    },
    with: {
      profiles: { columns: { bladerName: true, challongeUsername: true } },
    },
  });
  return rows.map((u) => {
    const profile = u.profiles?.[0] ?? null;
    return {
      userId: u.id,
      image: u.image ?? null,
      names: [u.username, u.displayUsername, u.name, u.globalName, u.discordTag],
      challongeUsername: profile?.challongeUsername ?? null,
      bladerName: profile?.bladerName ?? null,
    };
  });
}

/** Profils (bladerName) des users ajustés → clé d'agrégation des ajustements manuels. */
export async function listAdjustmentUserProfiles(userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await db.query.profiles.findMany({
    where: inArray(schema.profiles.userId, userIds),
    columns: { userId: true, bladerName: true },
  });
  return rows.map((r) => ({ userId: r.userId, bladerName: r.bladerName ?? null }));
}

/**
 * Réécrit en bloc le classement global puis resynchronise les profils.
 * Transactionnel : reset complet de `globalRankings` puis ré-insertion fraîche.
 */
export async function rebuildGlobalRankings(
  rows: Array<GlobalRankingInsert & { challongeUsername: string | null }>,
) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.globalRankings);

    if (rows.length > 0) {
      await tx
        .insert(schema.globalRankings)
        .values(rows.map(({ challongeUsername: _challongeUsername, ...rest }) => rest))
        .onConflictDoNothing();
    }

    for (const r of rows) {
      if (r.userId) {
        await tx
          .update(schema.profiles)
          .set({
            rankingPoints: r.points,
            wins: r.wins,
            losses: r.losses,
            tournamentWins: r.tournamentWins,
            ...(r.challongeUsername ? { challongeUsername: r.challongeUsername } : {}),
          })
          .where(eq(schema.profiles.userId, r.userId))
          .catch(() => {});
      }
    }
  });
}

// --- Sync par saison : SATR / WB (remplace une saison sans toucher les autres)

export async function replaceSatrSeason(season: number, rankings: SatrRankingInsert[]) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.satrRankings).where(eq(schema.satrRankings.season, season));
    if (rankings.length > 0) await tx.insert(schema.satrRankings).values(rankings);
  });
}

export async function replaceWbSeason(season: number, rankings: WbRankingInsert[]) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.wbRankings).where(eq(schema.wbRankings.season, season));
    if (rankings.length > 0) await tx.insert(schema.wbRankings).values(rankings);
  });
}

export async function replaceStardustRankings(rankings: StardustRankingInsert[]) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.stardustRankings);
    if (rankings.length > 0) await tx.insert(schema.stardustRankings).values(rankings);
  });
}

// --- Liaison bladers ↔ comptes utilisateurs ---------------------------------

export async function listBladers(kind: SeasonRankingKind) {
  return db.select().from(BLADER_TABLE[kind]);
}

export async function listUsersForLinking() {
  return db.query.users.findMany({
    columns: { id: true, name: true, discordTag: true },
  });
}

export async function linkBlader(kind: SeasonRankingKind, bladerId: string, userId: string) {
  const table = BLADER_TABLE[kind];
  await db.update(table).set({ linkedUserId: userId }).where(eq(table.id, bladerId));
}

export async function getBladerByName(kind: SeasonRankingKind, name: string) {
  const table = BLADER_TABLE[kind];
  const [row] = await db.select().from(table).where(ilike(table.name, name)).limit(1);
  return row ?? null;
}

// --- Lectures paginées par famille (RSC marketing satr/wb/stardust) ---------

export async function listSeasonRankings(params: {
  kind: SeasonRankingKind;
  season?: number;
  search?: string;
  limit: number;
  offset: number;
}) {
  const { kind, season, search, limit, offset } = params;
  const table = RANKING_TABLE[kind];
  const conditions = [];
  // Stardust n'a pas de colonne `season`.
  if (season != null && kind !== "stardust") {
    conditions.push(eq((table as typeof schema.satrRankings).season, season));
  }
  if (search) conditions.push(ilike(table.playerName, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalRows] = await Promise.all([
    db.select().from(table).where(where).orderBy(asc(table.rank)).limit(limit).offset(offset),
    db.select({ value: count() }).from(table).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}

export async function listSeasonRankingsAll(kind: SeasonRankingKind, season?: number) {
  const table = RANKING_TABLE[kind];
  const where =
    season != null && kind !== "stardust"
      ? eq((table as typeof schema.satrRankings).season, season)
      : undefined;
  return db.select().from(table).where(where).orderBy(asc(table.rank));
}

export async function listCareerBladers(params: {
  kind: SeasonRankingKind;
  search?: string;
  limit: number;
  offset: number;
}) {
  const { kind, search, limit, offset } = params;
  const table = BLADER_TABLE[kind];
  const where = search ? ilike(table.name, `%${search}%`) : undefined;
  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(table)
      .where(where)
      .orderBy(desc(table.tournamentWins), desc(table.totalWins))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(table).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0 };
}

export async function getBladerAggregateStats(kind: SeasonRankingKind) {
  const table = BLADER_TABLE[kind];
  const [stats] = await db
    .select({
      totalWins: sum(table.totalWins),
      totalLosses: sum(table.totalLosses),
      count: count(),
    })
    .from(table);
  const totalBladers = stats?.count ?? 0;
  const totalMatches = Math.floor(
    ((Number(stats?.totalWins) || 0) + (Number(stats?.totalLosses) || 0)) / 2,
  );
  return { totalBladers, totalMatches };
}

export async function getRankingLastUpdate(kind: SeasonRankingKind): Promise<string | null> {
  const table = RANKING_TABLE[kind];
  const [row] = await db
    .select({ updatedAt: table.updatedAt })
    .from(table)
    .orderBy(desc(table.updatedAt))
    .limit(1);
  return row?.updatedAt ?? null;
}

export async function countSeasonRankings(kind: SeasonRankingKind) {
  const [row] = await db.select({ value: count() }).from(RANKING_TABLE[kind]);
  return row?.value ?? 0;
}

export async function countCareerBladers(kind: SeasonRankingKind) {
  const [row] = await db.select({ value: count() }).from(BLADER_TABLE[kind]);
  return row?.value ?? 0;
}

/** Nombre de tournois rattachés à une catégorie « STARDUST » (admin Stardust). */
export async function countStardustSourceTournaments() {
  const [row] = await db
    .select({ value: count() })
    .from(schema.tournaments)
    .innerJoin(
      schema.tournamentCategories,
      eq(schema.tournaments.categoryId, schema.tournamentCategories.id),
    )
    .where(ilike(schema.tournamentCategories.name, "%STARDUST%"));
  return row?.value ?? 0;
}

/** Champions Stardust (1er de chaque tournoi catégorie STARDUST terminé). */
export async function listStardustChampions() {
  const rows = await db.query.tournaments.findMany({
    where: inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED"]),
    orderBy: desc(schema.tournaments.date),
    columns: { id: true, name: true },
    with: {
      tournamentCategory: { columns: { name: true } },
      tournamentParticipants: {
        where: eq(schema.tournamentParticipants.finalPlacement, 1),
        columns: { playerName: true },
        limit: 1,
      },
    },
  });
  return rows.filter((t) => (t.tournamentCategory?.name ?? "").toUpperCase().includes("STARDUST"));
}

// --- Classement global (leaderboard RPB) ------------------------------------

/** Leaderboard global non-vide trié par points (export CSV/JSON `current`). */
export async function listGlobalRankings() {
  return db.query.globalRankings.findMany({
    where: gt(schema.globalRankings.points, 0),
    with: { user: true },
    orderBy: [
      desc(schema.globalRankings.points),
      desc(schema.globalRankings.tournamentWins),
      desc(schema.globalRankings.wins),
    ],
  });
}

/** Entrées de saison archivée (export CSV/JSON historique). */
export async function listSeasonEntries(seasonId: string) {
  return db.query.seasonEntries.findMany({
    where: eq(schema.seasonEntries.seasonId, seasonId),
    with: { user: true },
    orderBy: desc(schema.seasonEntries.points),
  });
}

// --- API partenaire externe (`external/v1/leaderboard`) ---------------------

/** Snapshot complet pour l'API partenaire : config + tournois Tamashii + leaderboard. */
export async function getExternalLeaderboardSnapshot() {
  const rankingConfig = await db.query.rankingSystem.findFirst();

  const tournamentRows = await db.query.tournaments.findMany({
    where: or(
      ilike(schema.tournaments.name, "%Tamashii%"),
      ilike(schema.tournaments.name, "%Tamashi%"),
    ),
    with: {
      tournamentCategory: true,
      tournamentParticipants: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              username: true,
              discordTag: true,
              image: true,
            },
            with: { profiles: true },
          },
        },
      },
      tournamentMatches: {
        with: {
          user_player1Id: { columns: { id: true, name: true, username: true } },
          user_player2Id: { columns: { id: true, name: true, username: true } },
          user_winnerId: { columns: { id: true, name: true, username: true } },
        },
      },
    },
    orderBy: desc(schema.tournaments.date),
  });

  const players = await db.query.profiles.findMany({
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          discordTag: true,
          image: true,
        },
      },
    },
    orderBy: desc(schema.profiles.rankingPoints),
  });

  const activeSeasonRow = await db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.isActive, true),
    with: {
      seasonEntries: {
        with: {
          user: {
            columns: { id: true, name: true, username: true },
            with: { profiles: true },
          },
        },
        orderBy: desc(schema.seasonEntries.points),
      },
    },
  });

  return { rankingConfig, tournamentRows, players, activeSeasonRow };
}
