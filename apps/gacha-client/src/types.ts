/**
 * Types miroir du contrat serveur (`@rpbey/api-contract` / gacha-game.ts).
 * Dupliqués localement (et non importés) parce que le client est un bundle web
 * autonome : importer le package monorepo tirerait Drizzle/Zod dans le navigateur.
 * Garder synchronisé avec `packages/api-contract/src/gacha-game.ts`.
 */

export type Rarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";

/** DTO carte exposée par le serveur (cardDto). */
export interface GachaGameCard {
  id: string;
  name: string;
  nameJp: string | null;
  series: string;
  description: string | null;
  rarity: string;
  element: string;
  att: number;
  def: number;
  end: number;
  equilibre: number;
  beyblade: string | null;
  imageUrl: string | null;
  specialMove: string | null;
  isActive: boolean;
  dropId: string | null;
}

export interface BadgeReward {
  name: string;
  emoji: string;
  reward: number;
}

/** Résultat d'un pull unitaire (Colyseus `pull:result` / REST `{ ok, result }`). */
export interface PullResult {
  rarity: string | null;
  card: GachaGameCard | null;
  isDuplicate: boolean;
  isWished: boolean;
  newBalance: number;
  pityCount: number;
  badgeUnlocked?: BadgeReward | null;
}

export interface MultiPullResult {
  results: PullResult[];
  newBalance: number;
  hitsCount: number;
  missCount: number;
}

export interface DailyResult {
  amount: number;
  streakBonus: number;
  totalGain: number;
  tier: number;
  streakAfter: number;
  newBalance: number;
  message: string;
  streakBonusLabel?: string;
  interestPaid?: number;
  streakBroken?: boolean;
}

export interface GachaBalance {
  currency: number;
  dailyStreak: number;
  lastDaily: string | null;
  pityCount: number;
  userId?: string;
}

/** Frame d'anime (`/api/v1/anime/frames`). */
export interface AnimeFrame {
  id: string;
  imageUrl: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  characterNames: string[];
  episodeNumber?: number | null;
  caption?: string | null;
}

export interface AnimeFramesResponse {
  frames: AnimeFrame[];
  nextCursor: string | null;
  total: number;
}

/** Réponse `/discord_token` (apps/gacha-server/src/discord-token.ts). */
export interface DiscordTokenResponse {
  access_token: string;
  token: string; // JWT Colyseus
  gacha_token: string; // Bearer session (REST économie)
  gacha_user_id: string;
  user: { id: string; username?: string; global_name?: string | null };
}

/** Enveloppe REST économie `{ ok, ... }`. */
export interface RestEnvelope<T> {
  ok: boolean;
  result?: T;
  error?: { code: string; message: string; retryInMs?: number };
}

/** Liste ordonnée des raretés (faible → forte). */
export const RARITY_ORDER: Rarity[] = ["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"];

/** Normalise une rareté serveur (tolère EPIC ≈ SUPER_RARE) vers l'enum local. */
export function normalizeRarity(raw: string | null | undefined): Rarity {
  const up = (raw ?? "COMMON").toUpperCase();
  if (up === "EPIC") return "SUPER_RARE";
  return (RARITY_ORDER as string[]).includes(up) ? (up as Rarity) : "COMMON";
}

/** `true` pour SUPER_RARE et au-dessus (déclenche les FX premium). */
export function isSrPlus(r: Rarity): boolean {
  return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("SUPER_RARE");
}
