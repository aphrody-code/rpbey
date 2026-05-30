/** Logique de jeu pure (sans DB). */
import type { GachaGameCard } from "@rpbey/api-contract";
import {
  PITY_LEGENDARY_SOFT_START,
  PITY_LEGENDARY_THRESHOLD,
  PITY_SR_SOFT_START,
  PITY_THRESHOLD,
  RATES,
  type Rarity,
} from "./config";

/** Ligne carte lue en DB (colonnes `CARD_COLS`). Superset structurel de la DTO. */
export interface CardRow {
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

/** DTO carte exposée par l'API — type partagé du contrat (`@rpbey/api-contract`). */
export type CardDto = GachaGameCard;

export function cardDto(c: CardRow): CardDto {
  return {
    id: c.id,
    name: c.name,
    nameJp: c.nameJp,
    series: c.series,
    description: c.description,
    rarity: c.rarity,
    element: c.element,
    att: c.att,
    def: c.def,
    end: c.end,
    equilibre: c.equilibre,
    beyblade: c.beyblade,
    imageUrl: c.imageUrl,
    specialMove: c.specialMove,
    isActive: c.isActive,
    dropId: c.dropId,
  };
}

/**
 * Generateur de nombres pseudo-aleatoires injectable.
 * Par defaut utilise `Math.random()`.
 * Passer une fonction deterministe (ex. seedable) dans les tests.
 */
export type RngFn = () => number;

// Module-scoped (non-exporte) pour eviter le warning no-mutable-exports.
let _defaultRng: RngFn = () => Math.random();

/** Renvoie le generateur actif (utile dans les tests). */
export function getDefaultRng(): RngFn {
  return _defaultRng;
}

/** Remplace la RNG globale (tests uniquement). */
export function setRng(fn: RngFn): void {
  _defaultRng = fn;
}

/** Remet la RNG globale a `Math.random()`. */
export function resetRng(): void {
  _defaultRng = () => Math.random();
}

/**
 * Calcule le facteur multiplicatif du soft-pity SR+ appliqué au taux global SR+.
 *
 * - Avant PITY_SR_SOFT_START : facteur 1.0 (pas de boost).
 * - Entre PITY_SR_SOFT_START et PITY_THRESHOLD : ramp lineaire de 1.0 a 1/baseSrPlus
 *   de sorte que le taux final atteint 100 % au rang PITY_THRESHOLD - 1.
 *
 * @param pityCount Compteur pity SR+ courant (avant ce tirage, 0-based).
 * @returns Facteur multiplicatif >= 1.0.
 */
export function srPlusBoostFactor(pityCount: number): number {
  if (pityCount < PITY_SR_SOFT_START) return 1.0;
  const baseSrPlus = (RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET) / 100;
  // Au rang PITY_THRESHOLD - 1 on veut taux * facteur = 1.0, donc facteur = 1/baseSrPlus.
  const maxFactor = 1 / baseSrPlus;
  const window = PITY_THRESHOLD - PITY_SR_SOFT_START;
  const pos = pityCount - PITY_SR_SOFT_START + 1; // 1-based dans la fenetre
  const t = Math.min(pos / window, 1.0);
  return 1.0 + (maxFactor - 1.0) * t;
}

/**
 * Calcule la part (0-1) de LEGENDARY+SECRET dans les SR+ en tenant compte
 * du soft-pity LEGENDARY.
 *
 * - Avant PITY_LEGENDARY_SOFT_START : part de base = baseLegSec / baseSrPlus.
 * - Ramp lineaire jusqu'a 1.0 (tout le SR+ est legendary) au rang
 *   PITY_LEGENDARY_THRESHOLD - 1.
 *
 * @param pityLegendaryCount Compteur pity LEGENDARY courant (0-based).
 * @returns Part [0, 1] de LEGENDARY+SECRET dans le budget SR+.
 */
export function legendaryShareInSrPlus(pityLegendaryCount: number): number {
  const baseSrPlus = (RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET) / 100;
  const baseLegSec = (RATES.LEGENDARY + RATES.SECRET) / 100;
  const baseShare = baseLegSec / baseSrPlus;
  if (pityLegendaryCount < PITY_LEGENDARY_SOFT_START) return baseShare;
  const window = PITY_LEGENDARY_THRESHOLD - PITY_LEGENDARY_SOFT_START;
  const pos = pityLegendaryCount - PITY_LEGENDARY_SOFT_START + 1;
  const t = Math.min(pos / window, 1.0);
  return baseShare + (1.0 - baseShare) * t;
}

/**
 * Calcule les taux effectifs de chaque rareté en tenant compte des soft-pity.
 *
 * Algorithme :
 * 1. Appliquer le facteur legendary : multiplier (LEGENDARY + SECRET) par le boost.
 * 2. Appliquer le facteur SR+ : multiplier (SUPER_RARE + LEGENDARY + SECRET) par le boost.
 * 3. Recalibrer toutes les raretés non-SR+ proportionnellement pour que la somme = 1.
 * 4. Recalibrer l'intérieur des SR+ proportionnellement.
 *
 * Proprietes garanties :
 *   - Somme de tous les taux = 1.0.
 *   - MISS, COMMON, RARE, SUPER_RARE, LEGENDARY, SECRET >= 0.
 *   - Taux SR+ >= taux de base.
 *   - Taux LEGENDARY+SECRET >= taux de base.
 *
 * @returns Objet avec les taux [0,1] de chaque bucket (somme = 1).
 */
export function computeEffectiveRates(
  pityCount: number,
  pityLegendaryCount: number,
): {
  srPlus: number;
  legendary: number;
  MISS: number;
  COMMON: number;
  RARE: number;
  SUPER_RARE: number;
  LEGENDARY: number;
  SECRET: number;
} {
  const baseMiss = RATES.MISS / 100;
  const baseCommon = RATES.COMMON / 100;
  const baseRare = RATES.RARE / 100;
  const baseSR = RATES.SUPER_RARE / 100;
  const baseLeg = RATES.LEGENDARY / 100;
  const baseSec = RATES.SECRET / 100;

  // 1. Taux SR+ booste par soft-pity.
  const srBoost = srPlusBoostFactor(pityCount);
  const baseSrPlus = baseSR + baseLeg + baseSec;
  const effSRPlus = Math.min(baseSrPlus * srBoost, 1.0);

  // 2. Repartition interne SR+ avec soft-pity legendary.
  //    legShare = part de (LEGENDARY+SECRET) dans le budget SR+.
  const legShare = legendaryShareInSrPlus(pityLegendaryCount);
  const legBudget = effSRPlus * legShare;
  const srBudget = effSRPlus * (1.0 - legShare);

  // Proportions LEGENDARY / SECRET preservees (baseLeg:baseSec).
  const baseLegSecTotal = baseLeg + baseSec;
  let fLeg: number;
  let fSec: number;
  if (baseLegSecTotal > 0) {
    fLeg = (baseLeg / baseLegSecTotal) * legBudget;
    fSec = (baseSec / baseLegSecTotal) * legBudget;
  } else {
    fLeg = 0;
    fSec = 0;
  }

  // 3. Raretés non-SR+ : redistribution proportionnelle sur (1 - effSRPlus).
  const nonSrBudget = Math.max(0, 1.0 - effSRPlus);
  const baseNonSr = baseMiss + baseCommon + baseRare;
  let effMiss: number;
  let effCommon: number;
  let effRare: number;
  if (baseNonSr > 0) {
    effMiss = (baseMiss / baseNonSr) * nonSrBudget;
    effCommon = (baseCommon / baseNonSr) * nonSrBudget;
    effRare = (baseRare / baseNonSr) * nonSrBudget;
  } else {
    effMiss = 0;
    effCommon = 0;
    effRare = 0;
  }

  return {
    srPlus: effSRPlus,
    legendary: fLeg + fSec,
    MISS: effMiss,
    COMMON: effCommon,
    RARE: effRare,
    SUPER_RARE: srBudget,
    LEGENDARY: fLeg,
    SECRET: fSec,
  };
}

/**
 * Tire `MISS` ou une rareté selon la table pondérée RATES, en appliquant le
 * soft-pity SR+ et LEGENDARY.
 *
 * Utilise un seul appel RNG avec la table cumulative des taux effectifs.
 * Distribution exactement proportionnelle aux taux effectifs calculés.
 *
 * @param pityCount          Compteur pity SR+ courant (avant ce tirage, 0-based).
 * @param pityLegendaryCount Compteur pity LEGENDARY courant (avant ce tirage, 0-based).
 * @param rng                Generateur aleatoire injectable (defaut `defaultRng`).
 */
export function rollRarity(
  pityCount = 0,
  pityLegendaryCount = 0,
  rng: RngFn = _defaultRng,
): "MISS" | Rarity {
  // Hard pity legendary : force LEGENDARY sans meme interroger la table.
  if (pityLegendaryCount >= PITY_LEGENDARY_THRESHOLD) return "LEGENDARY";

  const eff = computeEffectiveRates(pityCount, pityLegendaryCount);

  // Table cumulative (ordre : MISS, COMMON, RARE, SUPER_RARE, LEGENDARY, SECRET).
  const order: Array<["MISS" | Rarity, number]> = [
    ["MISS", eff.MISS],
    ["COMMON", eff.COMMON],
    ["RARE", eff.RARE],
    ["SUPER_RARE", eff.SUPER_RARE],
    ["LEGENDARY", eff.LEGENDARY],
    ["SECRET", eff.SECRET],
  ];

  const roll = rng();
  let cum = 0;
  for (const [key, w] of order) {
    cum += w;
    if (roll < cum) return key;
  }
  // Fallback numerique (erreur d'arrondi infime).
  return "COMMON";
}
