/**
 * Logique de tiers/ranking MMR pour le leaderboard gacha.
 * Module pur (sans DB) — entierement testable en isolation.
 */

export interface Tier {
  name: string;
  minRating: number;
  maxRating: number;
}

/**
 * Tiers MMR du classement duel.
 * Seuils alignes sur un ELO de depart a 1000.
 * Invariant : trie par minRating croissant, pas de chevauchement, couvre [0, +inf[.
 */
export const TIERS: readonly Tier[] = [
  { name: "Bronze", minRating: 0, maxRating: 1099 },
  { name: "Argent", minRating: 1100, maxRating: 1249 },
  { name: "Or", minRating: 1250, maxRating: 1399 },
  { name: "Platine", minRating: 1400, maxRating: 1599 },
  { name: "Diamant", minRating: 1600, maxRating: 1799 },
  { name: "Maitre", minRating: 1800, maxRating: Infinity },
] as const;

/** Renvoie le tier correspondant a un rating donne (0 minimum). */
export function getTier(rating: number): Tier {
  const r = Math.max(0, rating);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (r >= TIERS[i]!.minRating) return TIERS[i]!;
  }
  return TIERS[0]!;
}

/**
 * Percentile dans le classement : position 1-based parmi N joueurs.
 * Renvoie un entier 0-100 (0 = dernier, 100 = premier).
 * Si total <= 1, renvoie 100.
 */
export function percentile(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Math.round(((total - rank) / (total - 1)) * 100);
}

/**
 * Decay doux (saison) : reduit un rating de `decayFraction` vers le rating
 * de depart `baseRating`, applique au maximum `maxDecay` points par periode.
 * N'abaisse jamais en dessous de `baseRating`.
 * Exemple (defauts) : rating=1600, 30 jours inactifs → rating - floor(1600*0.05) = 1520.
 *
 * @param rating         Rating actuel du joueur.
 * @param daysInactive   Nombre de jours depuis le dernier duel.
 * @param decayFraction  Fraction du rating retranchée par periode (defaut 5 %).
 * @param decayPeriodDays Periode en jours (defaut 30).
 * @param baseRating     Plancher absolu (ne descend pas en dessous, defaut 1000).
 * @param maxDecay       Plafond de perte par appel (defaut 200).
 */
export function applyDecay(
  rating: number,
  daysInactive: number,
  decayFraction = 0.05,
  decayPeriodDays = 30,
  baseRating = 1000,
  maxDecay = 200,
): number {
  if (daysInactive < decayPeriodDays) return rating;
  const periods = Math.floor(daysInactive / decayPeriodDays);
  const loss = Math.min(Math.floor(rating * decayFraction * periods), maxDecay);
  return Math.max(baseRating, rating - loss);
}

/**
 * Calcule le progres dans le tier actuel (0-100).
 * Tier Maitre (maxRating = Infinity) renvoie 100.
 */
export function tierProgress(rating: number): number {
  const tier = getTier(rating);
  if (tier.maxRating === Infinity) return 100;
  const range = tier.maxRating - tier.minRating + 1;
  const pos = Math.max(0, rating - tier.minRating);
  return Math.min(100, Math.round((pos / range) * 100));
}
