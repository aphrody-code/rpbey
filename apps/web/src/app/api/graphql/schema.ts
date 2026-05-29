import { createSchema } from "graphql-yoga";
import { db, schema as t, and, asc, desc, eq, gt, ilike } from "@/lib/db";

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    enum BeyType {
      ATTACK
      DEFENSE
      STAMINA
      BALANCE
    }

    enum PartType {
      BLADE
      RATCHET
      BIT
    }

    enum TournamentStatus {
      UPCOMING
      PENDING
      ACTIVE
      COMPLETE
      CANCELLED
    }

    # ── Rankings ──────────────────────────────────────

    type Blader {
      id: ID!
      playerName: String!
      points: Int!
      wins: Int!
      losses: Int!
      tournamentWins: Int!
      tournamentsCount: Int!
      avatarUrl: String
      winRate: Float!
    }

    type Season {
      id: ID!
      name: String!
      slug: String!
      isActive: Boolean!
      startDate: String!
      endDate: String
      entries(limit: Int = 50, offset: Int = 0): [SeasonEntry!]!
    }

    type SeasonEntry {
      id: ID!
      playerName: String
      points: Int!
      wins: Int!
      losses: Int!
      tournamentWins: Int!
      rank: Int
    }

    # ── Parts & Beyblades ────────────────────────────

    type Part {
      id: ID!
      externalId: String!
      name: String!
      nameJp: String
      type: PartType!
      beyType: BeyType
      weight: Float
      attack: String
      defense: String
      stamina: String
      burst: String
      dash: String
      imageUrl: String
      rarity: String
      spinDirection: String
      system: String
    }

    type Beyblade {
      id: ID!
      code: String!
      name: String!
      nameEn: String
      nameFr: String
      beyType: BeyType
      totalAttack: Int
      totalDefense: Int
      totalStamina: Int
      totalBurst: Int
      totalDash: Int
      totalWeight: Float
      imageUrl: String
      blade: Part!
      ratchet: Part!
      bit: Part!
    }

    # ── Tournaments ──────────────────────────────────

    type Tournament {
      id: ID!
      name: String!
      description: String
      date: String!
      location: String
      format: String!
      maxPlayers: Int!
      status: TournamentStatus!
      challongeUrl: String
      participantCount: Int!
      category: TournamentCategory
    }

    type TournamentCategory {
      id: ID!
      name: String!
      multiplier: Float!
      color: String
    }

    # ── Profiles ─────────────────────────────────────

    type Profile {
      id: ID!
      bladerName: String
      favoriteType: BeyType
      bio: String
      wins: Int!
      losses: Int!
      tournamentWins: Int!
      rankingPoints: Int!
      challongeUsername: String
      user: PublicUser
    }

    type PublicUser {
      id: ID!
      name: String
      image: String
      discordTag: String
    }

    # ── Anime ────────────────────────────────────────

    type AnimeSeries {
      id: ID!
      slug: String!
      title: String!
      titleFr: String
      titleJp: String
      generation: String!
      synopsis: String
      posterUrl: String
      bannerUrl: String
      year: Int!
      episodeCount: Int!
    }

    # ── Root Query ───────────────────────────────────

    type Query {
      """
      Top bladers from the global ranking
      """
      rankings(limit: Int = 50, offset: Int = 0): [Blader!]!

      """
      Get a blader by name
      """
      blader(name: String!): Blader

      """
      All ranking seasons
      """
      seasons: [Season!]!

      """
      A single season by slug
      """
      season(slug: String!): Season

      """
      All parts, optionally filtered by type
      """
      parts(type: PartType, limit: Int = 100, offset: Int = 0): [Part!]!

      """
      A single part by externalId
      """
      part(externalId: String!): Part

      """
      All beyblades
      """
      beyblades(limit: Int = 100, offset: Int = 0): [Beyblade!]!

      """
      A beyblade by code
      """
      beyblade(code: String!): Beyblade

      """
      Tournaments, optionally filtered by status
      """
      tournaments(status: TournamentStatus, limit: Int = 20, offset: Int = 0): [Tournament!]!

      """
      A tournament by ID
      """
      tournament(id: ID!): Tournament

      """
      A blader profile by user ID
      """
      profile(userId: ID!): Profile

      """
      Search bladers by name
      """
      searchBladers(query: String!, limit: Int = 10): [Blader!]!

      """
      All published anime series
      """
      animeSeries: [AnimeSeries!]!
    }
  `,
  resolvers: {
    Query: {
      rankings: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
        const rows = await db.query.globalRankings.findMany({
          where: gt(t.globalRankings.points, 0),
          orderBy: [desc(t.globalRankings.points), desc(t.globalRankings.wins)],
          limit: Math.min(limit, 100),
          offset,
        });
        return rows.map((r) => ({
          ...r,
          winRate:
            r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 10000) / 100 : 0,
        }));
      },

      blader: async (_: unknown, { name }: { name: string }) => {
        const r = await db.query.globalRankings.findFirst({
          where: eq(t.globalRankings.playerName, name),
        });
        if (!r) return null;
        return {
          ...r,
          winRate:
            r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 10000) / 100 : 0,
        };
      },

      searchBladers: async (_: unknown, { query, limit }: { query: string; limit: number }) => {
        const rows = await db.query.globalRankings.findMany({
          where: and(
            ilike(t.globalRankings.playerName, `%${query}%`),
            gt(t.globalRankings.points, 0),
          ),
          orderBy: desc(t.globalRankings.points),
          limit: Math.min(limit, 25),
        });
        return rows.map((r) => ({
          ...r,
          winRate:
            r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 10000) / 100 : 0,
        }));
      },

      seasons: () =>
        db.query.rankingSeasons.findMany({
          orderBy: desc(t.rankingSeasons.startDate),
        }),

      season: (_: unknown, { slug }: { slug: string }) =>
        db.query.rankingSeasons.findFirst({
          where: eq(t.rankingSeasons.slug, slug),
        }),

      parts: (
        _: unknown,
        { type, limit, offset }: { type?: string; limit: number; offset: number },
      ) =>
        db.query.parts.findMany({
          where: type ? eq(t.parts.type, type as never) : undefined,
          orderBy: asc(t.parts.name),
          limit: Math.min(limit, 200),
          offset,
        }),

      part: (_: unknown, { externalId }: { externalId: string }) =>
        db.query.parts.findFirst({
          where: eq(t.parts.externalId, externalId),
        }),

      beyblades: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
        const rows = await db.query.beyblades.findMany({
          with: {
            part_bladeId: true,
            part_ratchetId: true,
            part_bitId: true,
          },
          orderBy: asc(t.beyblades.name),
          limit: Math.min(limit, 200),
          offset,
        });
        return rows.map((b) => ({
          ...b,
          blade: b.part_bladeId,
          ratchet: b.part_ratchetId,
          bit: b.part_bitId,
        }));
      },

      beyblade: async (_: unknown, { code }: { code: string }) => {
        const b = await db.query.beyblades.findFirst({
          where: eq(t.beyblades.code, code),
          with: {
            part_bladeId: true,
            part_ratchetId: true,
            part_bitId: true,
          },
        });
        if (!b) return null;
        return {
          ...b,
          blade: b.part_bladeId,
          ratchet: b.part_ratchetId,
          bit: b.part_bitId,
        };
      },

      tournaments: async (
        _: unknown,
        { status, limit, offset }: { status?: string; limit: number; offset: number },
      ) => {
        const rows = await db.query.tournaments.findMany({
          where: status ? eq(t.tournaments.status, status as never) : undefined,
          with: {
            tournamentCategory: true,
            tournamentParticipants: { columns: { id: true } },
          },
          orderBy: desc(t.tournaments.date),
          limit: Math.min(limit, 50),
          offset,
        });
        return rows.map((tr) => ({
          ...tr,
          category: tr.tournamentCategory,
          _count: { participants: tr.tournamentParticipants.length },
        }));
      },

      tournament: async (_: unknown, { id }: { id: string }) => {
        const tr = await db.query.tournaments.findFirst({
          where: eq(t.tournaments.id, id),
          with: {
            tournamentCategory: true,
            tournamentParticipants: { columns: { id: true } },
          },
        });
        if (!tr) return null;
        return {
          ...tr,
          category: tr.tournamentCategory,
          _count: { participants: tr.tournamentParticipants.length },
        };
      },

      profile: async (_: unknown, { userId }: { userId: string }) => {
        const p = await db.query.profiles.findFirst({
          where: eq(t.profiles.userId, userId),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
                discordTag: true,
              },
            },
          },
        });
        return p;
      },

      animeSeries: () =>
        db.query.animeSeries.findMany({
          where: eq(t.animeSeries.isPublished, true),
          orderBy: [asc(t.animeSeries.generation), asc(t.animeSeries.sortOrder)],
        }),
    },

    Season: {
      entries: (parent: { id: string }, { limit, offset }: { limit: number; offset: number }) =>
        db.query.seasonEntries.findMany({
          where: eq(t.seasonEntries.seasonId, parent.id),
          orderBy: desc(t.seasonEntries.points),
          limit: Math.min(limit, 100),
          offset,
        }),
    },

    Tournament: {
      participantCount: (parent: { _count?: { participants: number } }) =>
        parent._count?.participants ?? 0,
    },
  },
});
