import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Classements — SATR / Wild Breakers / Stardust + classement global RPB.
// Reflet des tables `satrRankings` / `wbRankings` / `stardustRankings` /
// `globalRankings` (@rpbey/db). Timestamps en mode:"string" → ISO sur le fil.

/** Ligne de classement par saison (algorithme Ichigo) — SATR / WB / Stardust. */
export const RankingEntrySchema = z.object({
  id: z.string(),
  rank: z.number().int(),
  playerName: z.string(),
  score: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  participation: z.number().int(),
  winRate: z.string(),
  pointsAverage: z.string(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type RankingEntry = z.infer<typeof RankingEntrySchema>;

/** Profil de carrière (cumul tous tournois) — bladers SATR / WB / Stardust. */
export const RankingBladerSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalWins: z.number().int(),
  totalLosses: z.number().int(),
  tournamentWins: z.number().int(),
  tournamentsCount: z.number().int(),
  history: z.unknown().nullish(),
  linkedUserId: z.string().nullish(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type RankingBlader = z.infer<typeof RankingBladerSchema>;

/** Entrée du classement global RPB (points pondérés par catégorie de tournoi). */
export const GlobalRankingEntrySchema = z.object({
  id: z.string(),
  playerName: z.string(),
  userId: z.string().nullish(),
  points: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  tournamentWins: z.number().int(),
  tournamentsCount: z.number().int(),
  avatarUrl: z.string().nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type GlobalRankingEntry = z.infer<typeof GlobalRankingEntrySchema>;

/** Famille de classement demandée. `global` = leaderboard RPB par points. */
export const RankingKindSchema = z.enum(["satr", "wb", "stardust", "global"]);
export type RankingKind = z.infer<typeof RankingKindSchema>;

export const RankingsQuerySchema = z.object({
  kind: RankingKindSchema.default("global"),
  /** Carrière (`career`) vs classement de saison (`ranking`). Ignoré pour `global`. */
  view: z.enum(["ranking", "career"]).default("ranking"),
  season: z.coerce.number().int().min(1).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});
export type RankingsQuery = z.infer<typeof RankingsQuerySchema>;

/**
 * Réponse d'une liste de classement. `items` est l'union des trois formes
 * possibles (entrée de saison, blader de carrière, entrée globale) selon
 * `kind`/`view` — le consommateur discrimine via le `kind` qu'il a demandé.
 */
export const RankingsListResponseSchema = z.object({
  kind: RankingKindSchema,
  view: z.enum(["ranking", "career"]),
  season: z.number().int().nullable(),
  items: z.array(z.union([RankingEntrySchema, RankingBladerSchema, GlobalRankingEntrySchema])),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  lastUpdate: IsoDateSchema.nullable(),
});
export type RankingsListResponse = z.infer<typeof RankingsListResponseSchema>;

/** Stats agrégées d'une famille (totaux bladers + matches estimés + tournois saison). */
export const RankingStatsSchema = z.object({
  totalBladers: z.number().int().nonnegative(),
  totalMatches: z.number().int().nonnegative(),
  tournamentCount: z.number().int().nonnegative(),
  uniqueParticipants: z.number().int().nonnegative(),
});
export type RankingStats = z.infer<typeof RankingStatsSchema>;
