import "server-only";
import { and, count, db, desc, eq, or, schema } from "@/lib/db";
import type {
  MatchPlayer,
  PublicUser,
  PublicUserResponse,
  UserMatch,
  UserMatchesResponse,
} from "@rpbey/api-contract";

/**
 * Data Access Layer — profils / utilisateurs.
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Invariant timestamp (@rpbey/db) : `users.createdAt` est `mode:"date"` (objet Date),
 * `profiles.createdAt/updatedAt` sont `mode:"string"` (ISO). On normalise en ISO
 * (`toIso`) avant de franchir la frontière du contrat — jamais d'objet Date au-delà.
 */

// Stats joueur (ELO/leaderboard/H2H) vivent dans la DAL voisine `dal/stats`.
// Ré-exportées ici pour offrir un point d'entrée unique au domaine `users`.
export { getHeadToHead, getLeaderboard, getUserStats } from "@/server/dal/stats";

/** Normalise une valeur date (Date | string | null) en string ISO ou null. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

const PUBLIC_USER_COLUMNS = {
  id: true,
  name: true,
  image: true,
  createdAt: true,
  discordTag: true,
  nickname: true,
  serverAvatar: true,
  globalName: true,
  roles: true,
} as const;

const PUBLIC_PROFILE_COLUMNS = {
  bladerName: true,
  favoriteType: true,
  experience: true,
  bio: true,
  wins: true,
  losses: true,
  tournamentWins: true,
  rankingPoints: true,
  challongeUsername: true,
  twitterHandle: true,
  tiktokHandle: true,
} as const;

/**
 * Compte + profil public agrégé, forme contrat `PublicUser` (route `/api/v1/users/[id]`).
 * `null` si l'utilisateur n'existe pas.
 */
export async function getPublicUser(id: string): Promise<PublicUserResponse> {
  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: PUBLIC_USER_COLUMNS,
    with: {
      profiles: { columns: PUBLIC_PROFILE_COLUMNS },
    },
  });

  if (!userRow) return { user: null };

  const [tournamentsRow, p1Row, p2Row] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.tournamentParticipants)
      .where(eq(schema.tournamentParticipants.userId, id)),
    db
      .select({ value: count() })
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.player1Id, id)),
    db
      .select({ value: count() })
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.player2Id, id)),
  ]);

  const profileRow = userRow.profiles[0] ?? null;
  const user: PublicUser = {
    id: userRow.id,
    name: userRow.name,
    image: userRow.image,
    createdAt: toIso(userRow.createdAt),
    discordTag: userRow.discordTag,
    nickname: userRow.nickname,
    serverAvatar: userRow.serverAvatar,
    globalName: userRow.globalName,
    // `roles` est un `jsonb` typé `unknown[]` ; on coerce en string[] pour le contrat.
    roles: Array.isArray(userRow.roles) ? userRow.roles.map(String) : null,
    profile: profileRow
      ? {
          bladerName: profileRow.bladerName,
          favoriteType: profileRow.favoriteType,
          experience: profileRow.experience,
          bio: profileRow.bio,
          wins: profileRow.wins,
          losses: profileRow.losses,
          tournamentWins: profileRow.tournamentWins,
          rankingPoints: profileRow.rankingPoints,
          challongeUsername: profileRow.challongeUsername,
          twitterHandle: profileRow.twitterHandle,
          tiktokHandle: profileRow.tiktokHandle,
        }
      : null,
    counts: {
      tournaments: tournamentsRow[0]?.value ?? 0,
      matches: (p1Row[0]?.value ?? 0) + (p2Row[0]?.value ?? 0),
    },
  };

  return { user };
}

/**
 * Détail utilisateur "riche" — forme legacy `/api/users/[id]` (profil + decks actifs
 * remappés Prisma-style + `_count`). Conservée pour les consommateurs SWR existants.
 */
export async function getUserDetailLegacy(id: string) {
  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: PUBLIC_USER_COLUMNS,
    with: {
      profiles: {
        columns: {
          bladerName: true,
          favoriteType: true,
          experience: true,
          bio: true,
          wins: true,
          losses: true,
          tournamentWins: true,
          twitterHandle: true,
          tiktokHandle: true,
        },
      },
      decks: {
        where: eq(schema.decks.isActive, true),
        with: {
          deckItems: {
            with: {
              beyblade: true,
              part_bladeId: true,
              part_ratchetId: true,
              part_bitId: true,
            },
          },
        },
      },
    },
  });

  if (!userRow) return null;

  const [tournamentsRow, p1Row, p2Row] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.tournamentParticipants)
      .where(eq(schema.tournamentParticipants.userId, id)),
    db
      .select({ value: count() })
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.player1Id, id)),
    db
      .select({ value: count() })
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.player2Id, id)),
  ]);

  return {
    ...userRow,
    createdAt: toIso(userRow.createdAt),
    profile: userRow.profiles[0] ?? null,
    decks: userRow.decks.map((d) => ({
      ...d,
      items: d.deckItems.map((it) => ({
        ...it,
        bey: it.beyblade,
        blade: it.part_bladeId,
        ratchet: it.part_ratchetId,
        bit: it.part_bitId,
      })),
    })),
    _count: {
      tournaments: tournamentsRow[0]?.value ?? 0,
      player1Matches: p1Row[0]?.value ?? 0,
      player2Matches: p2Row[0]?.value ?? 0,
    },
  };
}

/** Champs nécessaires à la méta SEO d'une page profil publique (`/profile/[id]`). */
export async function getProfileMeta(id: string) {
  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { name: true, image: true },
    with: {
      profiles: {
        columns: {
          bladerName: true,
          rankingPoints: true,
          wins: true,
          losses: true,
          tournamentWins: true,
        },
      },
    },
  });
  if (!userRow) return null;
  return { ...userRow, profile: userRow.profiles[0] ?? null };
}

/** Existence rapide d'un utilisateur (carte profil OG). */
export async function userExists(id: string): Promise<{ id: string; name: string | null } | null> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { id: true, name: true },
  });
  return row ?? null;
}

/** Historique de matchs complets d'un joueur — forme contrat `UserMatchesResponse`. */
export async function getUserMatches(
  userId: string,
  params: { limit: number; offset: number },
): Promise<UserMatchesResponse> {
  const { limit, offset } = params;
  const where = and(
    or(
      eq(schema.tournamentMatches.player1Id, userId),
      eq(schema.tournamentMatches.player2Id, userId),
    ),
    eq(schema.tournamentMatches.state, "complete"),
  );

  const [matchRows, totalRow] = await Promise.all([
    db.query.tournamentMatches.findMany({
      where,
      with: {
        tournament: { columns: { id: true, name: true } },
        user_player1Id: {
          columns: { id: true, name: true, image: true },
          with: { profiles: { columns: { bladerName: true } } },
        },
        user_player2Id: {
          columns: { id: true, name: true, image: true },
          with: { profiles: { columns: { bladerName: true } } },
        },
      },
      orderBy: desc(schema.tournamentMatches.createdAt),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(schema.tournamentMatches).where(where),
  ]);

  const toPlayer = (
    row: {
      id: string;
      name: string | null;
      image: string | null;
      profiles: { bladerName: string | null }[];
    } | null,
  ): MatchPlayer | null =>
    row
      ? {
          id: row.id,
          name: row.name,
          image: row.image,
          bladerName: row.profiles[0]?.bladerName ?? null,
        }
      : null;

  const matches: UserMatch[] = matchRows.map((m) => ({
    id: m.id,
    tournamentId: m.tournamentId,
    tournamentName: m.tournament?.name ?? null,
    round: m.round,
    score: m.score,
    state: m.state,
    createdAt: toIso(m.createdAt),
    player1: toPlayer(m.user_player1Id),
    player2: toPlayer(m.user_player2Id),
    winnerId: m.winnerId,
  }));

  return { matches, total: totalRow[0]?.value ?? 0, limit, offset };
}

/** Historique de matchs — forme legacy `/api/users/[id]/matches` (objets remappés). */
export async function getUserMatchesLegacy(
  userId: string,
  params: { limit: number; offset: number },
) {
  const { limit, offset } = params;
  const where = and(
    or(
      eq(schema.tournamentMatches.player1Id, userId),
      eq(schema.tournamentMatches.player2Id, userId),
    ),
    eq(schema.tournamentMatches.state, "complete"),
  );

  const [matchRows, totalRow] = await Promise.all([
    db.query.tournamentMatches.findMany({
      where,
      with: {
        tournament: { columns: { id: true, name: true } },
        user_player1Id: {
          columns: { id: true, name: true, image: true },
          with: { profiles: { columns: { bladerName: true } } },
        },
        user_player2Id: {
          columns: { id: true, name: true, image: true },
          with: { profiles: { columns: { bladerName: true } } },
        },
        user_winnerId: { columns: { id: true } },
      },
      orderBy: desc(schema.tournamentMatches.createdAt),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(schema.tournamentMatches).where(where),
  ]);

  const matches = matchRows.map((m) => ({
    ...m,
    createdAt: toIso(m.createdAt),
    player1: m.user_player1Id
      ? { ...m.user_player1Id, profile: m.user_player1Id.profiles[0] ?? null }
      : null,
    player2: m.user_player2Id
      ? { ...m.user_player2Id, profile: m.user_player2Id.profiles[0] ?? null }
      : null,
    winner: m.user_winnerId ?? null,
  }));

  return { matches, total: totalRow[0]?.value ?? 0 };
}

/** Profil de l'utilisateur connecté + tournois (route legacy `/api/profile` GET). */
export async function getOwnProfile(userId: string) {
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    with: {
      user: {
        with: {
          tournamentParticipants: {
            with: { tournament: true },
          },
        },
      },
    },
  });

  if (!profileRow) return null;

  return {
    ...profileRow,
    user: {
      ...profileRow.user,
      createdAt: toIso(profileRow.user.createdAt),
      updatedAt: toIso(profileRow.user.updatedAt),
      tournaments: profileRow.user.tournamentParticipants,
    },
  };
}

export interface ProfileUpsertInput {
  bladerName?: string | null;
  favoriteType?: string | null;
  experience?: string | null;
  bio?: string | null;
  challongeUsername?: string | null;
  deckBoxImage?: string | null;
}

/**
 * Upsert du profil de l'utilisateur connecté (route legacy `/api/profile` PATCH).
 * Met aussi à jour l'avatar (`users.image`) si fourni. `fallbackName` sert de
 * `bladerName` par défaut à la création.
 */
export async function upsertOwnProfile(
  userId: string,
  data: ProfileUpsertInput & { image?: string | null },
  fallbackName: string | null,
) {
  const { image, ...profileData } = data;

  if (image) {
    await db.update(schema.users).set({ image }).where(eq(schema.users.id, userId));
  }

  const [profile] = await db
    .insert(schema.profiles)
    .values({
      userId,
      bladerName: profileData.bladerName ?? fallbackName,
      // `favoriteType`/`experience` sont des colonnes enum ; le corps de mutation
      // fournit des strings arbitraires (validées en amont). Cast assumé.
      favoriteType: profileData.favoriteType as never,
      experience: profileData.experience as never,
      bio: profileData.bio,
      challongeUsername: profileData.challongeUsername,
      deckBoxImage: profileData.deckBoxImage,
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        bladerName: profileData.bladerName,
        favoriteType: profileData.favoriteType as never,
        experience: profileData.experience as never,
        bio: profileData.bio,
        challongeUsername: profileData.challongeUsername,
        deckBoxImage: profileData.deckBoxImage,
      },
    })
    .returning();

  return profile ?? null;
}

/** Vérifie qu'un utilisateur est un stub `bts2_` éligible à la liaison. */
export async function getClaimableStub(stubUserId: string) {
  const stubUser = await db.query.users.findFirst({
    where: eq(schema.users.id, stubUserId),
    columns: { id: true, username: true },
  });
  return stubUser ?? null;
}

/**
 * Fusionne un profil stub (`bts2_*`) dans le compte réel : déplace participations,
 * matchs (P1/P2/vainqueur) puis supprime le stub. Transactionnel.
 */
export async function mergeStubIntoUser(stubUserId: string, realUserId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.tournamentParticipants)
      .set({ userId: realUserId })
      .where(eq(schema.tournamentParticipants.userId, stubUserId));

    await tx
      .update(schema.tournamentMatches)
      .set({ player1Id: realUserId })
      .where(eq(schema.tournamentMatches.player1Id, stubUserId));
    await tx
      .update(schema.tournamentMatches)
      .set({ player2Id: realUserId })
      .where(eq(schema.tournamentMatches.player2Id, stubUserId));
    await tx
      .update(schema.tournamentMatches)
      .set({ winnerId: realUserId })
      .where(eq(schema.tournamentMatches.winnerId, stubUserId));

    await tx.delete(schema.profiles).where(eq(schema.profiles.userId, stubUserId));
    await tx.delete(schema.users).where(eq(schema.users.id, stubUserId));
  });
}
