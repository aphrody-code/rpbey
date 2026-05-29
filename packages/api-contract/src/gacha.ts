import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Gacha TCG + économie — surface PUBLIQUE (sans session) consommée par le SDK.
// Reflet des tables `gacha_cards`, `gacha_drops`, `profiles` (@rpbey/db).
// Timestamps en string ISO (toutes les tables gacha sont en mode:"string").

export const GachaRaritySchema = z.enum(["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"]);
export type GachaRarity = z.infer<typeof GachaRaritySchema>;

// ─── Carte ─────────────────────────────────────────────────────────────────

export const GachaCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  nameJp: z.string().nullish(),
  series: z.string(),
  rarity: z.string(),
  imageUrl: z.string().nullish(),
  beyblade: z.string().nullish(),
  description: z.string().nullish(),
  dropRate: z.number().nullish(),
  isActive: z.boolean(),
  att: z.number(),
  def: z.number(),
  end: z.number(),
  equilibre: z.number(),
  element: z.string().nullish(),
  specialMove: z.string().nullish(),
  artistName: z.string().nullish(),
  cardType: z.string().nullish(),
  dropId: z.string().nullish(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type GachaCard = z.infer<typeof GachaCardSchema>;

export const GachaCardsQuerySchema = z.object({
  rarity: GachaRaritySchema.optional(),
  dropId: z.string().optional(),
  series: z.string().optional(),
  search: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type GachaCardsQuery = z.infer<typeof GachaCardsQuerySchema>;

export const GachaCardsResponseSchema = z.object({
  cards: z.array(GachaCardSchema),
  total: z.number(),
});
export type GachaCardsResponse = z.infer<typeof GachaCardsResponseSchema>;

// ─── Drop (collection saisonnière) ───────────────────────────────────────────

export const GachaDropSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  theme: z.string().nullish(),
  season: z.number(),
  maxCards: z.number().nullish(),
  startDate: IsoDateSchema.nullish(),
  endDate: IsoDateSchema.nullish(),
  isActive: z.boolean(),
  imageUrl: z.string().nullish(),
  cardCount: z.number(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type GachaDrop = z.infer<typeof GachaDropSchema>;

export const GachaDropsResponseSchema = z.object({
  drops: z.array(GachaDropSchema),
});
export type GachaDropsResponse = z.infer<typeof GachaDropsResponseSchema>;

// ─── Leaderboard gacha public (par BeyCoins / collection / duels) ─────────────

export const GachaLeaderboardEntrySchema = z.object({
  rank: z.number(),
  userId: z.string(),
  name: z.string().nullish(),
  image: z.string().nullish(),
  currency: z.number(),
  duelWins: z.number(),
  duelRating: z.number(),
  cardCount: z.number(),
});
export type GachaLeaderboardEntry = z.infer<typeof GachaLeaderboardEntrySchema>;

export const GachaLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type GachaLeaderboardQuery = z.infer<typeof GachaLeaderboardQuerySchema>;

export const GachaLeaderboardResponseSchema = z.object({
  entries: z.array(GachaLeaderboardEntrySchema),
});
export type GachaLeaderboardResponse = z.infer<typeof GachaLeaderboardResponseSchema>;
