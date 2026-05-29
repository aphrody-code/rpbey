import "server-only";
import { and, asc, count, db, desc, eq, gte, ilike, inArray, lte, or, schema, sql } from "@/lib/db";
import { type User } from "@/lib/types";

/**
 * Data Access Layer — infra (health, sitemap SEO, dashboard admin, gestion users,
 * maintenance). SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine.
 * UI-agnostic.
 *
 * Invariant timestamp (cf. AGENTS.md §2) :
 *   - `users.createdAt` = colonne auth `mode:"date"` → Drizzle renvoie un `Date`.
 *   - `profiles/tournaments/anime*` = `mode:"string"` → string ISO.
 * Toute valeur exposée hors DAL est normalisée en **string ISO** (`toIso`) afin que
 * les consommateurs (RSC, sitemap) reçoivent une forme uniforme sans avoir à
 * connaître le mode de chaque colonne.
 */

/** Normalise un timestamp (`Date` auth-mode ou string ISO) en string ISO stable. */
function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// ───────────────────────────── health ──────────────────────────────────────

/** Ping DB léger (`SELECT 1`) pour `/api/health`. `true` si la base répond. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────── sitemap (SEO) ───────────────────────────────

export interface SitemapEntry {
  /** Slug / id à concaténer au baseUrl par le consommateur. */
  path: string;
  /** Dernière modification, string ISO (jamais un `Date`). */
  lastModified: string;
}

export interface SitemapAnimeEntry extends SitemapEntry {
  episodes: { number: number; lastModified: string }[];
}

/** Tournois publiés pour le sitemap (id + updatedAt). */
export async function listSitemapTournaments(limit = 1000): Promise<SitemapEntry[]> {
  const rows = await db.query.tournaments.findMany({
    columns: { id: true, updatedAt: true },
    orderBy: desc(schema.tournaments.updatedAt),
    limit,
  });
  return rows.map((t) => ({ path: t.id, lastModified: toIso(t.updatedAt) }));
}

/** Profils publics pour le sitemap (userId + updatedAt). */
export async function listSitemapProfiles(limit = 1000): Promise<SitemapEntry[]> {
  const rows = await db.query.profiles.findMany({
    columns: { userId: true, updatedAt: true },
    orderBy: desc(schema.profiles.updatedAt),
    limit,
  });
  return rows.map((p) => ({
    path: p.userId,
    lastModified: toIso(p.updatedAt),
  }));
}

/** Séries anime publiées + leurs épisodes pour le sitemap. */
export async function listSitemapAnime(): Promise<SitemapAnimeEntry[]> {
  const series = await db.query.animeSeries.findMany({
    where: eq(schema.animeSeries.isPublished, true),
    columns: { slug: true, updatedAt: true },
    with: {
      animeEpisodes: {
        columns: { number: true, updatedAt: true },
        orderBy: asc(schema.animeEpisodes.number),
      },
    },
  });
  return series.map((s) => ({
    path: s.slug,
    lastModified: toIso(s.updatedAt),
    episodes: s.animeEpisodes.map((ep) => ({
      number: ep.number,
      lastModified: toIso(ep.updatedAt),
    })),
  }));
}

// ───────────────────────────── dashboard admin ─────────────────────────────

export interface AdminOverviewStats {
  userCount: number;
  activeTournamentCount: number;
  profileCount: number;
  usersLastMonth: number;
  profilesLastMonth: number;
  tournamentTotalCount: number;
  /** createdAt normalisé en string ISO (mix auth/non-auth aplati). */
  recentUsers: { name: string | null; createdAt: string }[];
  recentTournaments: { name: string; createdAt: string }[];
  /** createdAt des inscriptions des 6 derniers mois (string ISO). */
  chartUsers: { createdAt: string }[];
  chartTournaments: { createdAt: string }[];
  chartMatches: { state: string }[];
}

/** Agrège toutes les métriques du dashboard d'administration en un seul appel. */
export async function getAdminOverview(): Promise<AdminOverviewStats> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
  const sixMonthsAgoIso = sixMonthsAgo.toISOString();

  const [
    userCountRows,
    activeTournamentRows,
    profileCountRows,
    usersLastMonthRows,
    profilesLastMonthRows,
    recentUsers,
    recentTournaments,
    chartUsers,
    chartTournaments,
    chartMatches,
    tournamentTotalRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(schema.users),
    db
      .select({ value: count() })
      .from(schema.tournaments)
      .where(inArray(schema.tournaments.status, ["REGISTRATION_OPEN", "UNDERWAY", "CHECKIN"])),
    db.select({ value: count() }).from(schema.profiles),
    // users.createdAt = mode:"date" → comparer à un Date.
    db
      .select({ value: count() })
      .from(schema.users)
      .where(lte(schema.users.createdAt, thirtyDaysAgo)),
    // profiles.createdAt = mode:"string" → comparer à une string ISO.
    db
      .select({ value: count() })
      .from(schema.profiles)
      .where(lte(schema.profiles.createdAt, thirtyDaysAgoIso)),
    db.query.users.findMany({
      limit: 5,
      orderBy: desc(schema.users.createdAt),
      columns: { name: true, createdAt: true },
    }),
    db.query.tournaments.findMany({
      limit: 5,
      orderBy: desc(schema.tournaments.createdAt),
      columns: { name: true, createdAt: true },
    }),
    db.query.users.findMany({
      where: gte(schema.users.createdAt, sixMonthsAgo),
      columns: { createdAt: true },
    }),
    db.query.tournaments.findMany({
      where: gte(schema.tournaments.createdAt, sixMonthsAgoIso),
      columns: { createdAt: true },
    }),
    db.query.tournamentMatches.findMany({ columns: { state: true } }),
    db.select({ value: count() }).from(schema.tournaments),
  ]);

  return {
    userCount: userCountRows[0]?.value ?? 0,
    activeTournamentCount: activeTournamentRows[0]?.value ?? 0,
    profileCount: profileCountRows[0]?.value ?? 0,
    usersLastMonth: usersLastMonthRows[0]?.value ?? 0,
    profilesLastMonth: profilesLastMonthRows[0]?.value ?? 0,
    tournamentTotalCount: tournamentTotalRows[0]?.value ?? 0,
    recentUsers: recentUsers.map((u) => ({
      name: u.name,
      createdAt: toIso(u.createdAt),
    })),
    recentTournaments: recentTournaments.map((t) => ({
      name: t.name,
      createdAt: toIso(t.createdAt),
    })),
    chartUsers: chartUsers.map((u) => ({ createdAt: toIso(u.createdAt) })),
    chartTournaments: chartTournaments.map((t) => ({
      createdAt: toIso(t.createdAt),
    })),
    chartMatches,
  };
}

// ───────────────────────────── gestion des users ───────────────────────────

export type AdminUserRow = User & { _count: { tournaments: number } };

/** Liste paginée des users avec compte de participations aux tournois. */
export async function listAdminUsers(
  page = 1,
  pageSize = 10,
  search = "",
): Promise<{ users: AdminUserRow[]; total: number }> {
  const skip = (page - 1) * pageSize;

  const where = search
    ? or(ilike(schema.users.name, `%${search}%`), ilike(schema.users.email, `%${search}%`))
    : undefined;

  const [users, totalRows] = await Promise.all([
    db.query.users.findMany({
      where,
      offset: skip,
      limit: pageSize,
      orderBy: desc(schema.users.createdAt),
    }),
    db.select({ value: count() }).from(schema.users).where(where),
  ]);

  const total = totalRows[0]?.value ?? 0;

  const userIds = users.map((u) => u.id);
  const countByUser = new Map<string, number>();
  if (userIds.length > 0) {
    const rows = await db
      .select({ userId: schema.tournamentParticipants.userId, value: count() })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.userId, userIds))
      .groupBy(schema.tournamentParticipants.userId);
    for (const r of rows) {
      if (r.userId) countByUser.set(r.userId, r.value);
    }
  }

  const usersWithCount: AdminUserRow[] = users.map((u) => ({
    ...u,
    _count: { tournaments: countByUser.get(u.id) ?? 0 },
  }));

  return { users: usersWithCount, total };
}

/** Met à jour les champs éditables d'un user (admin). */
export async function updateAdminUser(
  id: string,
  data: {
    name?: string;
    role?: string;
    banned?: boolean;
    banReason?: string | null;
  },
): Promise<void> {
  await db
    .update(schema.users)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.banned !== undefined && { banned: data.banned }),
      ...(data.banReason !== undefined && { banReason: data.banReason }),
      ...(!data.banned && { banReason: null, banExpires: null }),
    })
    .where(eq(schema.users.id, id));
}

/** Change uniquement le rôle d'un user. */
export async function updateAdminUserRole(id: string, role: string): Promise<void> {
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, id));
}

/** Supprime un user (cascade DB). */
export async function deleteAdminUser(id: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}

// ───────────────────────────── maintenance ─────────────────────────────────

/** Utilisateurs + relations nécessaires à la fusion de doublons (stubs bts). */
export async function listUsersForMerge() {
  return db.query.users.findMany({
    with: {
      profiles: true,
      tournamentParticipants: true,
      decks: true,
      seasonEntries: true,
    },
  });
}

/** Réaffecte toutes les références d'un user-stub vers le user cible puis supprime le stub. */
export async function mergeUserInto(
  stubId: string,
  targetId: string,
  stubProfileId: string | null,
): Promise<void> {
  await db
    .update(schema.tournamentParticipants)
    .set({ userId: targetId })
    .where(eq(schema.tournamentParticipants.userId, stubId));
  await db
    .update(schema.tournamentMatches)
    .set({ player1Id: targetId })
    .where(eq(schema.tournamentMatches.player1Id, stubId));
  await db
    .update(schema.tournamentMatches)
    .set({ player2Id: targetId })
    .where(eq(schema.tournamentMatches.player2Id, stubId));
  await db
    .update(schema.tournamentMatches)
    .set({ winnerId: targetId })
    .where(eq(schema.tournamentMatches.winnerId, stubId));
  if (stubProfileId) {
    await db.delete(schema.profiles).where(eq(schema.profiles.id, stubProfileId));
  }
  await db.delete(schema.users).where(eq(schema.users.id, stubId));
}

/** Upsert d'un tournoi importé depuis Challonge (date = string ISO, mode:"string"). */
export async function upsertImportedTournament(input: {
  id: string;
  name: string;
  challongeUrl: string;
  challongeId: string;
  status: "COMPLETE";
  standings: unknown;
  categoryId: string;
  description: string;
}): Promise<void> {
  await db
    .insert(schema.tournaments)
    .values({
      id: input.id,
      name: input.name,
      challongeUrl: input.challongeUrl,
      challongeId: input.challongeId,
      date: new Date().toISOString(),
      status: input.status,
      standings: input.standings as never,
      categoryId: input.categoryId,
      description: input.description,
    })
    .onConflictDoUpdate({
      target: schema.tournaments.id,
      set: {
        name: input.name,
        challongeUrl: input.challongeUrl,
        challongeId: input.challongeId,
        status: input.status,
        standings: input.standings as never,
        categoryId: input.categoryId,
        description: input.description,
      },
    });
}

/** Tous les users + profil (lookup d'appariement durant l'import). */
export async function listUsersWithProfileForImport() {
  return db.query.users.findMany({ with: { profiles: true } });
}

/** Crée un user placeholder + profil et renvoie l'id/profil créés. */
export async function createImportedUserWithProfile(input: {
  name: string;
  username: string;
  email: string;
  bladerName: string;
}): Promise<{ id: string; profileId: string | null }> {
  const [createdUser] = await db
    .insert(schema.users)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      username: input.username,
      email: input.email,
    })
    .returning();
  const [createdProfile] = await db
    .insert(schema.profiles)
    .values({
      userId: createdUser!.id,
      bladerName: input.bladerName,
      rankingPoints: 0,
    })
    .returning();
  return { id: createdUser!.id, profileId: createdProfile?.id ?? null };
}

/** Participation existante (tournoi, user) ou null. */
export async function findParticipant(tournamentId: string, userId: string) {
  return db.query.tournamentParticipants.findFirst({
    where: and(
      eq(schema.tournamentParticipants.tournamentId, tournamentId),
      eq(schema.tournamentParticipants.userId, userId),
    ),
  });
}

/** Met à jour le placement/score d'une participation. */
export async function updateParticipantResult(
  id: string,
  data: { finalPlacement: number; wins: number; losses: number },
): Promise<void> {
  await db
    .update(schema.tournamentParticipants)
    .set(data)
    .where(eq(schema.tournamentParticipants.id, id));
}

/** Crée une participation importée. */
export async function createImportedParticipant(input: {
  tournamentId: string;
  userId: string;
  challongeParticipantId: string;
  finalPlacement: number;
  wins: number;
  losses: number;
}): Promise<void> {
  await db.insert(schema.tournamentParticipants).values({ ...input, checkedIn: true });
}

/** Upsert d'un match importé. */
export async function upsertImportedMatch(input: {
  id: string;
  tournamentId: string;
  challongeMatchId: string;
  round: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  score: string | null;
  state: string;
}): Promise<void> {
  await db
    .insert(schema.tournamentMatches)
    .values(input)
    .onConflictDoUpdate({
      target: [schema.tournamentMatches.tournamentId, schema.tournamentMatches.challongeMatchId],
      set: {
        player1Id: input.player1Id,
        player2Id: input.player2Id,
        winnerId: input.winnerId,
        score: input.score,
        state: input.state,
      },
    });
}

/** Upsert d'une pièce synchronisée depuis la bey-library. */
export async function upsertLibraryPart(input: {
  externalId: string;
  name: string;
  imageUrl: string | null;
  system: string;
  attack: string;
  defense: string;
  stamina: string;
  dash: string;
  burst: string;
}): Promise<void> {
  await db
    .insert(schema.parts)
    .values({
      externalId: input.externalId,
      name: input.name,
      type: "BLADE",
      imageUrl: input.imageUrl,
      system: input.system,
      attack: input.attack,
      defense: input.defense,
      stamina: input.stamina,
      dash: input.dash,
      burst: input.burst,
    })
    .onConflictDoUpdate({
      target: schema.parts.externalId,
      set: {
        name: input.name,
        imageUrl: input.imageUrl,
        system: input.system,
        attack: input.attack || undefined,
        defense: input.defense || undefined,
        stamina: input.stamina || undefined,
        dash: input.dash || undefined,
        burst: input.burst || undefined,
      },
    });
}

/** Tournois terminés/archivés à vider (clear cache standings). */
export async function listCompletedTournamentIds(): Promise<string[]> {
  const rows = await db.query.tournaments.findMany({
    where: inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED"]),
    columns: { id: true },
  });
  return rows.map((t) => t.id);
}

/** Vide les standings (cache) d'un tournoi. */
export async function clearTournamentStandings(id: string): Promise<void> {
  await db
    .update(schema.tournaments)
    .set({ standings: [] as never })
    .where(eq(schema.tournaments.id, id));
}

/** Configuration du barème de ranking (lecture). */
export async function getRankingSystemConfig() {
  return db.query.rankingSystem.findFirst();
}

/** Met à jour le barème de ranking. */
export async function updateRankingSystemConfig(
  id: string,
  data: {
    participation: number;
    firstPlace: number;
    secondPlace: number;
    thirdPlace: number;
    matchWinWinner: number;
    matchWinLoser: number;
    top8: number;
  },
): Promise<void> {
  await db.update(schema.rankingSystem).set(data).where(eq(schema.rankingSystem.id, id));
}
