import { createSchema } from "graphql-yoga";
import {
  getBeybladeByCode,
  getGlobalRankingByName,
  getPartByExternalId,
  getProfileByUserId,
  getSeasonBySlug,
  getTournamentById,
  gqlAnimeFrames,
  gqlGachaCards,
  gqlGachaDrops,
  gqlGachaLeaderboard,
  gqlGachaProfile,
  listBeyblades,
  listGlobalRankings,
  listParts,
  listPublishedAnimeSeries,
  listSeasonEntries,
  listSeasons,
  listTournaments,
  searchGlobalRankings,
} from "@/server/dal/graphql";

/** % de winrate arrondi à 2 décimales (W/(W+L)), 0 si aucun match. */
function winRate(wins: number, losses: number): number {
  return wins + losses > 0 ? Math.round((wins / (wins + losses)) * 10000) / 100 : 0;
}

type RankingRow = { wins: number; losses: number };
function withWinRate<T extends RankingRow>(r: T): T & { winRate: number } {
  return { ...r, winRate: winRate(r.wins, r.losses) };
}

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

    # Frame / capture d'anime (galerie « Google Images »).
    type AnimeFrame {
      id: ID!
      seriesId: ID!
      episodeNumber: Int
      imageUrl: String!
      thumbUrl: String
      sourceUrl: String
      width: Int
      height: Int
      characterNames: [String!]!
      tags: [String!]!
      caption: String
      isNotable: Boolean!
    }

    # ── Gacha ────────────────────────────────────────

    enum GachaRarity {
      COMMON
      RARE
      SUPER_RARE
      LEGENDARY
      SECRET
    }

    type GachaCard {
      id: ID!
      slug: String!
      name: String!
      nameJp: String
      series: String!
      rarity: String!
      element: String
      imageUrl: String
      beyblade: String
      description: String
      att: Int!
      def: Int!
      end: Int!
      equilibre: Int!
      specialMove: String
      artistName: String
      isActive: Boolean!
      dropId: String
    }

    type GachaDrop {
      id: ID!
      slug: String!
      name: String!
      theme: String
      season: Int!
      maxCards: Int
      startDate: String
      endDate: String
      isActive: Boolean!
      imageUrl: String
      cardCount: Int!
    }

    type GachaLeaderboardEntry {
      rank: Int!
      userId: ID!
      name: String
      image: String
      currency: Int!
      duelWins: Int!
      duelRating: Int!
      cardCount: Int!
    }

    # Profil gacha PUBLIC : uniquement des stats déjà visibles (collection, duels,
    # palmarès). Le endpoint /api/graphql est public et non authentifié — on
    # n'expose donc PAS le solde (currency), la pity, le streak ni lastDaily
    # (timing/activité exploitables) pour un userId arbitraire.
    type GachaProfile {
      id: ID!
      userId: ID!
      bladerName: String
      wins: Int!
      losses: Int!
      tournamentWins: Int!
      cardCount: Int!
      totalCards: Int!
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

      """
      Anime frame gallery (screencaps), filterable by series slug / episode / character / notable / free text
      """
      animeFrames(
        series: String
        episode: Int
        character: String
        notable: Boolean
        q: String
        limit: Int = 60
      ): [AnimeFrame!]!

      """
      Public gacha card catalogue (active cards), filterable by rarity / drop / series / search
      """
      gachaCards(
        rarity: GachaRarity
        dropId: String
        series: String
        search: String
        limit: Int = 200
      ): [GachaCard!]!

      """
      Seasonal gacha collections (drops) with card counts
      """
      gachaDrops: [GachaDrop!]!

      """
      Gacha leaderboard (BeyCoins / collection / duels)
      """
      gachaLeaderboard(limit: Int = 100): [GachaLeaderboardEntry!]!

      """
      A player's gacha profile (currency, streak, duels, card count) by user ID
      """
      gachaProfile(userId: ID!): GachaProfile
    }
  `,
  resolvers: {
    Query: {
      rankings: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
        const rows = await listGlobalRankings(limit, offset);
        return rows.map(withWinRate);
      },

      blader: async (_: unknown, { name }: { name: string }) => {
        const r = await getGlobalRankingByName(name);
        return r ? withWinRate(r) : null;
      },

      searchBladers: async (_: unknown, { query, limit }: { query: string; limit: number }) => {
        const rows = await searchGlobalRankings(query, limit);
        return rows.map(withWinRate);
      },

      seasons: () => listSeasons(),

      season: (_: unknown, { slug }: { slug: string }) => getSeasonBySlug(slug),

      parts: (
        _: unknown,
        { type, limit, offset }: { type?: string; limit: number; offset: number },
      ) => listParts(type, limit, offset),

      part: (_: unknown, { externalId }: { externalId: string }) => getPartByExternalId(externalId),

      beyblades: (_: unknown, { limit, offset }: { limit: number; offset: number }) =>
        listBeyblades(limit, offset),

      beyblade: (_: unknown, { code }: { code: string }) => getBeybladeByCode(code),

      tournaments: (
        _: unknown,
        { status, limit, offset }: { status?: string; limit: number; offset: number },
      ) => listTournaments(status, limit, offset),

      tournament: (_: unknown, { id }: { id: string }) => getTournamentById(id),

      profile: (_: unknown, { userId }: { userId: string }) => getProfileByUserId(userId),

      animeSeries: () => listPublishedAnimeSeries(),

      animeFrames: (
        _: unknown,
        args: {
          series?: string;
          episode?: number;
          character?: string;
          notable?: boolean;
          q?: string;
          limit: number;
        },
      ) => gqlAnimeFrames(args),

      gachaCards: (
        _: unknown,
        args: {
          rarity?: string;
          dropId?: string;
          series?: string;
          search?: string;
          limit: number;
        },
      ) => gqlGachaCards(args),

      gachaDrops: () => gqlGachaDrops(),

      gachaLeaderboard: (_: unknown, { limit }: { limit: number }) => gqlGachaLeaderboard(limit),

      gachaProfile: (_: unknown, { userId }: { userId: string }) => gqlGachaProfile(userId),
    },

    Season: {
      entries: (parent: { id: string }, { limit, offset }: { limit: number; offset: number }) =>
        listSeasonEntries(parent.id, limit, offset),
    },

    Tournament: {
      participantCount: (parent: { participantCount?: number }) => parent.participantCount ?? 0,
    },
  },
});
