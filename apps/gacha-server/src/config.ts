/**
 * Constantes d'équilibre du serveur gacha. Alignées sur ce que le bot affiche
 * (apps/bot/src/commands/General/EconomyGroup.ts) et le client
 * (apps/bot/src/lib/gacha-api.ts).
 */

export const PORT = Number(process.env.GACHA_PORT ?? process.env.PORT ?? "5050") || 5050;

/** Base web pour rediriger les images de carte vers le rendu OG existant. */
export const WEB_BASE = process.env.WEB_BASE ?? "https://rpbey.fr";

export const PULL_COST = 50;
export const MULTI_PULL_COST = 450; // 10 tirages, ~10 % d'économie
export const MULTI_PULL_COUNT = 10;

export type Rarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";
export const SR_PLUS: Rarity[] = ["SUPER_RARE", "LEGENDARY", "SECRET"];
export const RARITY_ORDER: Rarity[] = ["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"];

/** Table de tirage (somme = 100). `MISS` = aucune carte (tirage raté). */
export const RATES: { MISS: number } & Record<Rarity, number> = {
  MISS: 30,
  COMMON: 39,
  RARE: 18,
  SUPER_RARE: 9,
  LEGENDARY: 3,
  SECRET: 1,
};

/** Pity : après N tirages sans SR+, le suivant est un SUPER_RARE garanti. */
export const PITY_THRESHOLD = 3;

export const SELL_PRICE: Record<Rarity, number> = {
  COMMON: 5,
  RARE: 15,
  SUPER_RARE: 50,
  LEGENDARY: 150,
  SECRET: 500,
};

export const DAILY_BASE = 50;
export const DAILY_COOLDOWN_H = 20; // un claim toutes les ~20 h
export const STREAK_RESET_H = 48; // au-delà, le streak retombe à 1
export const DEBT_INTEREST = 0.15; // intérêts quotidiens sur currency < 0

/** Paliers de streak (bonus ponctuel au franchissement du jour). */
export const STREAK_MILESTONES = [
  { days: 3, bonus: 50, label: "3 jours" },
  { days: 7, bonus: 150, label: "7 jours" },
  { days: 14, bonus: 300, label: "14 jours" },
  { days: 30, bonus: 750, label: "30 jours" },
];

/** Badges de collection (nb de cartes uniques). */
export const BADGES = [
  { count: 5, name: "Débutant", emoji: "🥉", reward: 200 },
  { count: 10, name: "Collectionneur", emoji: "🥈", reward: 500 },
  { count: 15, name: "Passionné", emoji: "🥇", reward: 750 },
  { count: 20, name: "Expert", emoji: "💎", reward: 1000 },
  { count: 25, name: "Maître", emoji: "👑", reward: 1500 },
  { count: 31, name: "Légende", emoji: "🏆", reward: 3000 },
];

export const GIFT_COOLDOWN_H = 12;

/** Coût de fusion : nb de doublons d'une rareté à brûler pour monter d'un cran. */
export const FUSION_DUPES_REQUIRED = 3;
