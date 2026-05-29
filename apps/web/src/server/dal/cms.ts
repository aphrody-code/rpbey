import "server-only";
import type { ContentBlockInput, StaffMemberInput } from "@rpbey/types";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  like,
  or,
  schema,
} from "@/lib/db";

/**
 * Data Access Layer — CMS / contenu éditorial, staff, seasons, méta admin,
 * fusion de comptes (admin-link) et agrégat de la landing marketing.
 * SEUL endroit autorisé à importer `@rpbey/db` pour le domaine `cms`. UI-agnostic.
 *
 * Invariant timestamp : toutes les tables touchées ici sont en mode:"string"
 * (content_blocks, staff_members, ranking_seasons, tournaments…) → on écrit des
 * strings ISO (`new Date().toISOString()`), jamais d'objet `Date`.
 */

// ── Content blocks ──────────────────────────────────────────────────────────

/** Tous les blocs de contenu (admin), triés par slug. */
export async function listContentBlocks() {
  return db.query.contentBlocks.findMany({
    orderBy: asc(schema.contentBlocks.slug),
  });
}

/** Résout un bloc par slug (lecture publique, ex: home-hero-text), ou `null`. */
export async function getContentBlock(slug: string) {
  const block = await db.query.contentBlocks.findFirst({
    where: eq(schema.contentBlocks.slug, slug),
  });
  return block ?? null;
}

/** Upsert sur le slug (action `cms.upsertContent`). */
export async function upsertContentBlock(slug: string, content: string, title?: string) {
  await db
    .insert(schema.contentBlocks)
    .values({ slug, content, title, type: "markdown" })
    .onConflictDoUpdate({
      target: schema.contentBlocks.slug,
      set: { content, title, type: "markdown" },
    });
}

export async function createContentBlock(data: ContentBlockInput) {
  const [block] = await db.insert(schema.contentBlocks).values(data).returning();
  return block;
}

export async function updateContentBlock(
  id: string,
  data: Pick<ContentBlockInput, "slug" | "title" | "type" | "content">,
) {
  await db.update(schema.contentBlocks).set(data).where(eq(schema.contentBlocks.id, id));
}

export async function deleteContentBlock(id: string) {
  await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, id));
}

// ── Staff members ─────────────────────────────────────────────────────────────

/** Staff complet (admin), trié rôle puis ordre d'affichage. */
export async function listStaffMembers() {
  return db.query.staffMembers.findMany({
    orderBy: [asc(schema.staffMembers.role), asc(schema.staffMembers.displayIndex)],
  });
}

/** Staff actif uniquement (page publique `/notre-equipe`). */
export async function listActiveStaffMembers() {
  return db.query.staffMembers.findMany({
    where: eq(schema.staffMembers.isActive, true),
    orderBy: [asc(schema.staffMembers.role), asc(schema.staffMembers.displayIndex)],
  });
}

export async function createStaffMember(data: StaffMemberInput) {
  const [member] = await db.insert(schema.staffMembers).values(data).returning();
  return member;
}

export async function updateStaffMember(id: string, data: Partial<StaffMemberInput>) {
  const [member] = await db
    .update(schema.staffMembers)
    .set(data)
    .where(eq(schema.staffMembers.id, id))
    .returning();
  return member;
}

export async function deleteStaffMember(id: string) {
  await db.delete(schema.staffMembers).where(eq(schema.staffMembers.id, id));
}

// ── Seasons (ranking_seasons / season_entries) ────────────────────────────────

export async function getCurrentSeason() {
  const season = await db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.isActive, true),
  });
  return season ?? null;
}

export async function listSeasons() {
  return db.query.rankingSeasons.findMany({
    orderBy: desc(schema.rankingSeasons.startDate),
  });
}

/** Classement d'une saison (entries + user + profil + count tournois). */
export async function getSeasonStandings(slug: string) {
  const season = await db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.slug, slug),
    with: {
      seasonEntries: {
        with: {
          user: {
            with: { profiles: true },
          },
        },
        orderBy: desc(schema.seasonEntries.points),
      },
    },
  });
  if (!season) return null;

  const userIds = season.seasonEntries
    .map((e) => e.userId)
    .filter((id): id is string => id != null);
  const countMap = new Map<string, number>();
  if (userIds.length > 0) {
    const rows = await db
      .select({
        userId: schema.tournamentParticipants.userId,
        value: count(),
      })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.userId, userIds))
      .groupBy(schema.tournamentParticipants.userId);
    for (const r of rows) if (r.userId) countMap.set(r.userId, r.value);
  }

  return {
    ...season,
    entries: season.seasonEntries.map((e) => ({
      ...e,
      user: e.user
        ? {
            ...e.user,
            profile: e.user.profiles[0] ?? null,
            _count: {
              tournaments: e.userId ? (countMap.get(e.userId) ?? 0) : 0,
            },
          }
        : null,
    })),
  };
}

/** Crée une nouvelle saison (désactive l'active courante au passage). */
export async function createSeason(name: string, slug: string) {
  await db
    .update(schema.rankingSeasons)
    .set({ isActive: false, endDate: new Date().toISOString() })
    .where(eq(schema.rankingSeasons.isActive, true));

  const [season] = await db
    .insert(schema.rankingSeasons)
    .values({
      name,
      slug,
      isActive: true,
      startDate: new Date().toISOString(),
    })
    .returning();
  return season;
}

/**
 * Archive la saison active : snapshot des classements, marquage des tournois,
 * remise à zéro, puis ouverture de la saison suivante. Atomique (transaction).
 */
export async function archiveSeason(params: {
  currentSeasonId: string;
  currentSeasonStartDate: string;
  nextSeasonName: string;
  nextSeasonSlug: string;
}) {
  const { currentSeasonId, currentSeasonStartDate, nextSeasonName, nextSeasonSlug } = params;

  await db.transaction(async (tx) => {
    // 1. Snapshot des classements globaux vers SeasonEntry
    const rankings = await tx.query.globalRankings.findMany({
      where: or(
        gt(schema.globalRankings.points, 0),
        gt(schema.globalRankings.wins, 0),
        gt(schema.globalRankings.losses, 0),
        gt(schema.globalRankings.tournamentWins, 0),
      ),
    });

    const entriesData = rankings.map((r) => ({
      seasonId: currentSeasonId,
      userId: r.userId,
      playerName: r.playerName,
      points: r.points,
      wins: r.wins,
      losses: r.losses,
      tournamentWins: r.tournamentWins,
    }));

    if (entriesData.length > 0) {
      await tx.insert(schema.seasonEntries).values(entriesData).onConflictDoNothing();
    }

    // 2. Marque les anciens tournois comme ARCHIVED
    await tx
      .update(schema.tournaments)
      .set({ status: "ARCHIVED" })
      .where(
        and(
          eq(schema.tournaments.status, "COMPLETE"),
          gte(schema.tournaments.date, currentSeasonStartDate),
        ),
      );

    // 3. Reset des classements & profils
    await tx.update(schema.globalRankings).set({
      points: 0,
      wins: 0,
      losses: 0,
      tournamentWins: 0,
    });

    await tx.update(schema.profiles).set({
      rankingPoints: 0,
      wins: 0,
      losses: 0,
      tournamentWins: 0,
    });

    // 4. Création de la saison suivante
    await tx
      .update(schema.rankingSeasons)
      .set({ isActive: false, endDate: new Date().toISOString() })
      .where(eq(schema.rankingSeasons.id, currentSeasonId));

    await tx.insert(schema.rankingSeasons).values({
      name: nextSeasonName,
      slug: nextSeasonSlug,
      isActive: true,
      startDate: new Date().toISOString(),
    });
  });
}

// ── Méta admin (usage des pièces dans les decks) ──────────────────────────────

/** Top-10 d'usage des pièces (blades/ratchets/bits/assists) sur les decks. */
export async function getMetaStats() {
  const [bladeUsage, ratchetUsage, bitUsage, assistUsage] = await Promise.all([
    db
      .select({ id: schema.deckItems.bladeId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bladeId))
      .groupBy(schema.deckItems.bladeId)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ id: schema.deckItems.ratchetId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.ratchetId))
      .groupBy(schema.deckItems.ratchetId)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ id: schema.deckItems.bitId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bitId))
      .groupBy(schema.deckItems.bitId)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ id: schema.deckItems.assistBladeId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.assistBladeId))
      .groupBy(schema.deckItems.assistBladeId)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const allPartIds = [
    ...bladeUsage.map((u) => u.id!),
    ...ratchetUsage.map((u) => u.id!),
    ...bitUsage.map((u) => u.id!),
    ...assistUsage.map((u) => u.id!),
  ];

  const parts = allPartIds.length
    ? await db
        .select({
          id: schema.parts.id,
          name: schema.parts.name,
          type: schema.parts.type,
          imageUrl: schema.parts.imageUrl,
        })
        .from(schema.parts)
        .where(inArray(schema.parts.id, allPartIds))
    : [];

  const partMap = new Map(parts.map((p) => [p.id, p]));

  return {
    blades: bladeUsage.map((u) => ({ ...partMap.get(u.id!), count: u.count })),
    ratchets: ratchetUsage.map((u) => ({
      ...partMap.get(u.id!),
      count: u.count,
    })),
    bits: bitUsage.map((u) => ({ ...partMap.get(u.id!), count: u.count })),
    assists: assistUsage.map((u) => ({
      ...partMap.get(u.id!),
      count: u.count,
    })),
  };
}

// ── Admin link (fusion de comptes joueurs) ────────────────────────────────────

/** Participants des tournois BTS avec leur user/profil (pour le linking manuel). */
export async function getUnlinkedParticipants() {
  const rows = await db.query.tournaments.findMany({
    where: or(
      like(schema.tournaments.challongeUrl, "%B_TS1%"),
      like(schema.tournaments.challongeUrl, "%B_TS2%"),
      like(schema.tournaments.challongeUrl, "%B_TS3%"),
    ),
    with: {
      tournamentParticipants: {
        with: {
          user: {
            with: { profiles: true },
          },
        },
        orderBy: asc(schema.tournamentParticipants.finalPlacement),
      },
    },
    orderBy: desc(schema.tournaments.date),
  });

  return rows.map((t) => ({
    ...t,
    participants: t.tournamentParticipants.map((p) => ({
      ...p,
      user: p.user ? { ...p.user, profile: p.user.profiles[0] ?? null } : null,
    })),
  }));
}

/** Utilisateurs « réels » (avec un Discord ID) — cibles d'une fusion. */
export async function getAllRealUsers() {
  const users = await db.query.users.findMany({
    where: isNotNull(schema.users.discordId),
    columns: {
      id: true,
      name: true,
      discordTag: true,
      discordId: true,
      image: true,
    },
    with: {
      profiles: { columns: { bladerName: true } },
    },
    orderBy: asc(schema.users.name),
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    discordTag: u.discordTag,
    discordId: u.discordId,
    image: u.image,
    profile: u.profiles[0] ?? null,
  }));
}

/** Fusionne un compte placeholder dans un compte réel (atomique). */
export async function mergeUserAccounts(placeholderUserId: string, realUserId: string) {
  return db.transaction(async (tx) => {
    await tx
      .update(schema.tournamentParticipants)
      .set({ userId: realUserId })
      .where(eq(schema.tournamentParticipants.userId, placeholderUserId));

    await tx
      .update(schema.tournamentMatches)
      .set({ player1Id: realUserId })
      .where(eq(schema.tournamentMatches.player1Id, placeholderUserId));

    await tx
      .update(schema.tournamentMatches)
      .set({ player2Id: realUserId })
      .where(eq(schema.tournamentMatches.player2Id, placeholderUserId));

    await tx
      .update(schema.tournamentMatches)
      .set({ winnerId: realUserId })
      .where(eq(schema.tournamentMatches.winnerId, placeholderUserId));

    await tx
      .update(schema.decks)
      .set({ userId: realUserId })
      .where(eq(schema.decks.userId, placeholderUserId));

    await tx.delete(schema.users).where(eq(schema.users.id, placeholderUserId));
  });
}

// ── Landing marketing (homepage) ──────────────────────────────────────────────

export interface HomeRankingRow {
  id: string;
  playerName: string;
  score: number;
  wins: number;
  losses: number;
}

/** Tournoi actif (en cours/check-in/inscriptions) pour la bannière homepage. */
export async function getActiveHomeTournament() {
  const t = await db.query.tournaments.findFirst({
    where: and(
      inArray(schema.tournaments.status, ["UNDERWAY", "CHECKIN", "REGISTRATION_OPEN"]),
      isNotNull(schema.tournaments.challongeUrl),
    ),
    orderBy: desc(schema.tournaments.date),
    columns: {
      id: true,
      challongeUrl: true,
      name: true,
      standings: true,
      stations: true,
      activityLog: true,
    },
  });
  return t ?? null;
}

/** Classements WB / SATR / Stardust (top-N) pour le carrousel de la homepage. */
export async function getHomeRankingBoards(season: number, top: number) {
  const [wb, satr, stardust] = await Promise.all([
    db.query.wbRankings.findMany({
      where: eq(schema.wbRankings.season, season),
      orderBy: asc(schema.wbRankings.rank),
      limit: top,
    }),
    db.query.satrRankings.findMany({
      where: eq(schema.satrRankings.season, season),
      orderBy: asc(schema.satrRankings.rank),
      limit: top,
    }),
    db.query.stardustRankings.findMany({
      orderBy: asc(schema.stardustRankings.rank),
      limit: top,
    }),
  ]);
  // Champs communs aux trois tables de classement (wb/satr ont `season`, stardust non) :
  // on type structurellement le sous-ensemble réellement lu pour accepter les trois.
  const pick = (rows: readonly HomeRankingRow[]): HomeRankingRow[] =>
    rows.map((r) => ({
      id: r.id,
      playerName: r.playerName,
      score: r.score,
      wins: r.wins,
      losses: r.losses,
    }));
  return { wb: pick(wb), satr: pick(satr), stardust: pick(stardust) };
}

/** Images des pièces (name → imageUrl) pour enrichir l'aperçu méta de la homepage. */
export async function getPartImages() {
  return db.query.parts.findMany({
    columns: { name: true, imageUrl: true },
  });
}

export interface HomeVideo {
  id: string;
  title: string;
  channelName: string | null;
  channelAvatar: string | null;
  thumbnail: string | null;
  views: number | null;
  duration: string | null;
  publishedAt: string;
  videoId: string;
}

/** Vidéos YouTube mises en avant de la chaîne RPB (homepage). */
export async function getFeaturedHomeVideos(limit = 12): Promise<HomeVideo[]> {
  const vids = await db.query.youtubeVideos.findMany({
    where: and(
      eq(schema.youtubeVideos.isFeatured, true),
      eq(schema.youtubeVideos.channelId, "UCHiDwWI-2uQrsUiJhXt6rng"),
    ),
    orderBy: desc(schema.youtubeVideos.publishedAt),
    limit,
    columns: {
      id: true,
      title: true,
      channelName: true,
      channelAvatar: true,
      thumbnail: true,
      views: true,
      duration: true,
      publishedAt: true,
    },
  });
  return vids.map((v) => ({
    ...v,
    videoId: v.id,
    publishedAt: new Date(v.publishedAt).toISOString(),
  }));
}

export interface HomeUpcomingTournament {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  challongeUrl?: string | null;
  posterUrl?: string | null;
}

/** Prochain tournoi Bey-Tamashii à l'affiche (homepage). */
export async function getNextBtsTournament() {
  const t = await db.query.tournaments.findFirst({
    where: and(
      ilike(schema.tournaments.name, "%BEY-TAMASHII%"),
      inArray(schema.tournaments.status, ["UPCOMING", "REGISTRATION_OPEN", "CHECKIN", "UNDERWAY"]),
    ),
    orderBy: asc(schema.tournaments.date),
    columns: {
      id: true,
      name: true,
      date: true,
      location: true,
      challongeUrl: true,
    },
  });
  return t ?? null;
}

/** Prochain tournoi Stardust à venir (homepage). */
export async function getNextStardustTournament() {
  const rows = await db.query.tournaments.findMany({
    where: inArray(schema.tournaments.status, [
      "UPCOMING",
      "REGISTRATION_OPEN",
      "CHECKIN",
      "UNDERWAY",
    ]),
    orderBy: asc(schema.tournaments.date),
    columns: { id: true, name: true, date: true, posterUrl: true },
    with: { tournamentCategory: { columns: { name: true } } },
  });
  return (
    rows.find((t) => (t.tournamentCategory?.name ?? "").toUpperCase().includes("STARDUST")) ?? null
  );
}
