import { z } from "zod";
import { GachaRaritySchema } from "./gacha";

/**
 * Contrat du **serveur de jeu gacha** (`apps/gacha-server`, Colyseus `:5050`) —
 * surface économie AUTHENTIFIÉE (Bearer), distincte de la surface web publique
 * (`gacha.ts`). Source de vérité unique partagée par :
 *   - le serveur (`apps/gacha-server/src/handlers.ts` — types de retour) ;
 *   - le client du bot (`apps/bot/src/lib/gacha-api.ts`).
 *
 * Les schémas décrivent les **payloads** (données utiles) ; les handlers du
 * serveur les emballent (`{ ok, result }` / `{ ok, page }` / brut selon la route)
 * et le client déballe vers ces mêmes types.
 *
 * Timestamps = string ISO (toutes les tables gacha sont `mode:"string"`).
 */

// ─── Carte de jeu (cardDto serveur — forme allégée vs GachaCardSchema public) ─

export const GachaGameCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameJp: z.string().nullable(),
  series: z.string(),
  description: z.string().nullable(),
  rarity: z.string(),
  element: z.string(),
  att: z.number(),
  def: z.number(),
  end: z.number(),
  equilibre: z.number(),
  beyblade: z.string().nullable(),
  imageUrl: z.string().nullable(),
  specialMove: z.string().nullable(),
  isActive: z.boolean(),
  dropId: z.string().nullable(),
});
export type GachaGameCard = z.infer<typeof GachaGameCardSchema>;

const BadgeRewardSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  reward: z.number(),
});

// ─── Tirage ───────────────────────────────────────────────────────────────────

export const PullResultSchema = z.object({
  rarity: z.string().nullable(),
  card: GachaGameCardSchema.nullable(),
  isDuplicate: z.boolean(),
  isWished: z.boolean(),
  newBalance: z.number(),
  pityCount: z.number(),
  badgeUnlocked: BadgeRewardSchema.nullish(),
});
export type PullResult = z.infer<typeof PullResultSchema>;

export const MultiPullResultSchema = z.object({
  results: z.array(PullResultSchema),
  newBalance: z.number(),
  hitsCount: z.number(),
  missCount: z.number(),
});
export type MultiPullResult = z.infer<typeof MultiPullResultSchema>;

// ─── Daily / solde ──────────────────────────────────────────────────────────

export const DailyResultSchema = z.object({
  amount: z.number(),
  streakBonus: z.number(),
  totalGain: z.number(),
  tier: z.number(),
  streakAfter: z.number(),
  newBalance: z.number(),
  message: z.string(),
  streakBonusLabel: z.string().optional(),
  interestPaid: z.number().optional(),
  streakBroken: z.boolean().optional(),
});
export type DailyResult = z.infer<typeof DailyResultSchema>;

export const GachaBalanceSchema = z.object({
  currency: z.number(),
  dailyStreak: z.number(),
  lastDaily: z.string().nullable(),
  pityCount: z.number(),
  userId: z.string().optional(),
});
export type GachaBalance = z.infer<typeof GachaBalanceSchema>;

// ─── Inventaire ─────────────────────────────────────────────────────────────

export const InventoryItemSchema = z.object({
  cardId: z.string(),
  count: z.number(),
  card: GachaGameCardSchema,
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const InventoryPageSchema = z.object({
  items: z.array(InventoryItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number(),
});
export type InventoryPage = z.infer<typeof InventoryPageSchema>;

export const InventoryQuerySchema = z.object({
  rarity: GachaRaritySchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;

// ─── Vente ────────────────────────────────────────────────────────────────────

export const SellResultSchema = z.object({
  pricePaid: z.number(),
  newBalance: z.number(),
  cardName: z.string(),
  rarity: z.string(),
});
export type SellResult = z.infer<typeof SellResultSchema>;

export const SellAllResultSchema = z.object({
  soldCount: z.number(),
  totalEarned: z.number(),
  newBalance: z.number(),
  sold: z.array(
    z.object({
      name: z.string(),
      rarity: z.string(),
      count: z.number(),
      earned: z.number(),
    }),
  ),
});
export type SellAllResult = z.infer<typeof SellAllResultSchema>;

export const SellBodySchema = z.object({ cardId: z.string().min(1) });
export type SellBody = z.infer<typeof SellBodySchema>;

// ─── Don / wishlist ───────────────────────────────────────────────────────────

export const GiftBodySchema = z.object({
  recipientId: z.string().min(1),
  cardId: z.string().min(1),
});
export type GiftBody = z.infer<typeof GiftBodySchema>;

export const GiftResultSchema = z.object({
  newBalance: z.number(),
  recipientName: z.string().optional(),
});
export type GiftResult = z.infer<typeof GiftResultSchema>;

export const WishlistItemSchema = z.object({
  cardId: z.string(),
  card: GachaGameCardSchema,
  owned: z.boolean(),
});
export type WishlistItem = z.infer<typeof WishlistItemSchema>;

export const WishlistToggleBodySchema = z.object({ cardId: z.string().min(1) });
export type WishlistToggleBody = z.infer<typeof WishlistToggleBodySchema>;

export const WishlistToggleResultSchema = z.object({
  added: z.boolean(),
  cardName: z.string(),
});
export type WishlistToggleResult = z.infer<typeof WishlistToggleResultSchema>;

// ─── Historique ─────────────────────────────────────────────────────────────

export const HistoryItemSchema = z.object({
  id: z.string(),
  amount: z.number(),
  type: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const HistoryPageSchema = z.object({
  items: z.array(HistoryItemSchema),
  nextCursor: z.string().nullable(),
});
export type HistoryPage = z.infer<typeof HistoryPageSchema>;

export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  type: z.string().optional(),
});
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

// ─── Taux ───────────────────────────────────────────────────────────────────

export const GachaRatesResponseSchema = z.object({
  MISS: z.number(),
  COMMON: z.number(),
  RARE: z.number(),
  SUPER_RARE: z.number(),
  LEGENDARY: z.number(),
  SECRET: z.number(),
  pityThreshold: z.number(),
});
export type GachaRatesResponse = z.infer<typeof GachaRatesResponseSchema>;

// ─── Bannières ──────────────────────────────────────────────────────────────

export const GachaBannerSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  theme: z.string().nullable(),
  season: z.number(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});
export type GachaBanner = z.infer<typeof GachaBannerSchema>;

// ─── Badges de collection ─────────────────────────────────────────────────────

export const BadgeProgressSchema = z.object({
  badges: z.array(
    z.object({
      count: z.number(),
      name: z.string(),
      emoji: z.string(),
      reward: z.number(),
      earned: z.boolean(),
      claimed: z.boolean(),
    }),
  ),
  uniqueCards: z.number(),
  nextBadge: z
    .object({
      count: z.number(),
      name: z.string(),
      emoji: z.string(),
      reward: z.number(),
    })
    .nullable(),
});
export type BadgeProgress = z.infer<typeof BadgeProgressSchema>;

export const ClaimBadgeResultSchema = z.object({
  badge: BadgeRewardSchema,
  newBalance: z.number(),
});
export type ClaimBadgeResult = z.infer<typeof ClaimBadgeResultSchema>;

// ─── Fusion ─────────────────────────────────────────────────────────────────

export const FusionPreviewSchema = z.object({
  eligible: z.boolean(),
  candidates: z.array(GachaGameCardSchema),
  targetRarity: z.string().nullable(),
  message: z.string(),
});
export type FusionPreview = z.infer<typeof FusionPreviewSchema>;

export const FuseBodySchema = z.object({ cardId: z.string().min(1) });
export type FuseBody = z.infer<typeof FuseBodySchema>;

export const FusionResultSchema = z.object({
  burnedCardId: z.string(),
  burnedRarity: z.string(),
  rewardCard: GachaGameCardSchema,
  rewardRarity: z.string(),
  newBalance: z.number(),
});
export type FusionResult = z.infer<typeof FusionResultSchema>;

// ─── Leaderboard (jeu) ──────────────────────────────────────────────────────

export const GameLeaderboardCategorySchema = z.enum(["currency", "wins", "mmr", "collection"]);
export type GameLeaderboardCategory = z.infer<typeof GameLeaderboardCategorySchema>;

export const GameLeaderboardEntrySchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  value: z.number(),
});
export type GameLeaderboardEntry = z.infer<typeof GameLeaderboardEntrySchema>;

export const GameLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type GameLeaderboardQuery = z.infer<typeof GameLeaderboardQuerySchema>;

// ─── Admin ──────────────────────────────────────────────────────────────────

export const AdminGrantBodySchema = z.object({
  targetUserId: z.string().min(1),
  amount: z.number().int(),
  note: z.string().optional(),
});
export type AdminGrantBody = z.infer<typeof AdminGrantBodySchema>;

export const AdminGrantResultSchema = z.object({
  newBalance: z.number(),
  prevBalance: z.number(),
});
export type AdminGrantResult = z.infer<typeof AdminGrantResultSchema>;

// ─── Cartes (recherche / par id) ──────────────────────────────────────────────

export const CardSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type CardSearchQuery = z.infer<typeof CardSearchQuerySchema>;
