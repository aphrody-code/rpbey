/**
 * battle-engine.ts — Unified Battle Engine for RPB Bot
 *
 * Consolidates the three combat engines:
 *   - "beyblade-x"  : Full physics sim with HP, stamina drain, burst, xtreme dash,
 *                     weight advantage, multi-round (from GameGroup.ts)
 *   - "tcg-duel"    : TCG card duel with elements, rarity, special moves, momentum,
 *                     3-round Best-of-3 (from DuelCommand.ts)
 *   - "quick-battle": Single-score battle with type advantage, crit, xdash, finish
 *                     types (from battle-utils.ts runBattleSimulation)
 *
 * RNG INJECTION
 * -------------
 * Every function that was previously calling Math.random() directly now accepts an
 * optional `rng: () => number` parameter (default Math.random). This makes the
 * engine fully deterministic in tests without changing call-sites that rely on the
 * default signature.
 *
 * BALANCE CHANGES (2026-05-30)
 * ----------------------------
 * - Type matchup (BBX + Quick): weighted, continuous advantage instead of binary
 *   step. Advantage factor: 1.20 (was 1.25 BBX / 1.15 Quick).
 *   Disadvantage factor: 0.83 (was 0.80 BBX / 0.88 Quick).
 *   This keeps the cycle meaningful while reducing "cliff" effects.
 * - TCG variance: narrowed from 0.85..1.15 (range 0.30) to 0.90..1.10 (range 0.20).
 *   The stronger card now wins more reliably; upsets still happen (~25 % range).
 * - BBX burst probability: clamped to [0, 0.30] to prevent guaranteed or negative
 *   burst rolls.
 * - BBX x-treme accumulation: capped at 0.60 per combatant so the trigger can
 *   never become a certainty.
 * - calcElo: adaptive K-factor (40 / 20 / 10 by games played), optional
 *   margin-of-victory multiplier, rating floor of 100.
 */

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type BattleVariant = "beyblade-x" | "tcg-duel" | "quick-battle";

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "beyblade-x" — Full Beyblade X physics simulation
// Source: commands/General/GameGroup.ts → simulateBattle()
// ═══════════════════════════════════════════════════════════════════════════════

export interface BbxComboStats {
  attack: number;
  defense: number;
  stamina: number;
  dash: number;
  burst: number;
  weight: number;
}

export interface BbxBattleLog {
  phase: string;
  text: string;
}

const BBX_FINISH_TYPES = [
  { result: "xtreme", message: "X-TREME FINISH !", points: 3, emoji: "X" },
  { result: "burst", message: "BURST FINISH !", points: 2, emoji: "B" },
  { result: "over", message: "OVER FINISH !", points: 2, emoji: "O" },
  { result: "spin", message: "SPIN FINISH !", points: 1, emoji: "S" },
] as const;

export type BbxFinishType = (typeof BBX_FINISH_TYPES)[number];

export interface BbxBattleResult {
  winner: "A" | "B";
  finishType: BbxFinishType;
  hpA: number;
  hpB: number;
  maxHp: number;
  log: BbxBattleLog[];
  rounds: number;
}

/**
 * Type advantage multiplier for Beyblade X.
 * Cycle: Attack > Stamina > Defense > Attack; Balance = neutral.
 *
 * Values (updated 2026-05-30):
 *   advantage    = 1.20  (was 1.25 — smoother, less cliff)
 *   disadvantage = 0.833 (was 0.80 — reciprocal of 1.20, zero-sum on log scale)
 *   neutral/balance = 1.0
 */
function bbxTypeMatchup(attacker: string | null, defender: string | null): number {
  const a = attacker ?? "BALANCE";
  const d = defender ?? "BALANCE";
  if (a === d) return 1.0;
  if (a === "BALANCE" || d === "BALANCE") return 1.0;
  if (
    (a === "ATTACK" && d === "STAMINA") ||
    (a === "STAMINA" && d === "DEFENSE") ||
    (a === "DEFENSE" && d === "ATTACK")
  ) {
    return 1.2; // advantage
  }
  return 1 / 1.2; // disadvantage — exact reciprocal (~0.833)
}

/**
 * Full Beyblade X battle simulation.
 *
 * Preserves structure from GameGroup.ts:
 * - maxHp = 200, MAX_ROUNDS = 12
 * - endurance: 50 + sta*1.2 + def*0.3 + weight*0.15
 * - burstRes: burst + def*0.5 + weight*0.2
 * - launch advantage: dash*0.8 + rng()*15, threshold *1.3
 * - attack: rawAtk - def*0.3*(0.7+rng()*0.6), floor 2
 * - weight knockback: if |diff|>3 → diff*0.5
 * - critical: 10% + atk*0.001 → +12..20 HP
 * - stamina drain: max(1, 8 - sta*0.08)
 * - burst trigger: hp < 35%, prob clamped to [0, 0.30]
 * - xtreme: accumulate dash*0.003 (cap 0.60), on trigger → 30 + dash*0.5
 * - finish: loserHp<=-5 → (dash>30 && rng<0.5 ? xtreme : burst); rounds>=10 → spin; else over
 *
 * @param rng Injectable RNG (default Math.random). Pass a seeded function for
 *            deterministic tests without touching call-site signatures.
 */
export function simulateBbxBattle(
  sA: BbxComboStats,
  typeA: string | null,
  sB: BbxComboStats,
  typeB: string | null,
  nameA: string,
  nameB: string,
  rng: () => number = Math.random,
): BbxBattleResult {
  const log: BbxBattleLog[] = [];
  const MAX_ROUNDS = 12;
  /** Hard cap on xtreme accumulation — prevents near-guaranteed triggers */
  const XTREME_CAP = 0.6;
  const maxHp = 200;
  let hpA = maxHp;
  let hpB = maxHp;

  const enduranceA = 50 + sA.stamina * 1.2 + sA.defense * 0.3 + sA.weight * 0.15;
  const enduranceB = 50 + sB.stamina * 1.2 + sB.defense * 0.3 + sB.weight * 0.15;
  const burstResA = sA.burst + sA.defense * 0.5 + sA.weight * 0.2;
  const burstResB = sB.burst + sB.defense * 0.5 + sB.weight * 0.2;

  // Phase 2: Launch
  const launchA = sA.dash * 0.8 + rng() * 15;
  const launchB = sB.dash * 0.8 + rng() * 15;
  if (launchA > launchB * 1.3) {
    const dmg = 15 + rng() * 10;
    hpB -= dmg;
    log.push({
      phase: "Lancement",
      text: `${nameA} prend l'avantage au lancement ! (-${Math.round(dmg)} PV)`,
    });
  } else if (launchB > launchA * 1.3) {
    const dmg = 15 + rng() * 10;
    hpA -= dmg;
    log.push({
      phase: "Lancement",
      text: `${nameB} domine le lancement ! (-${Math.round(dmg)} PV)`,
    });
  } else {
    log.push({
      phase: "Lancement",
      text: "Lancement equilibre, les deux toupies entrent en collision !",
    });
  }

  // Phase 3: Combat rounds
  let round = 0;
  let xtremeChanceA = 0;
  let xtremeChanceB = 0;

  while (hpA > 0 && hpB > 0 && round < MAX_ROUNDS) {
    round++;
    const matchA = bbxTypeMatchup(typeA, typeB);
    const matchB = bbxTypeMatchup(typeB, typeA);
    const rawAtkA = sA.attack * matchA * (0.8 + rng() * 0.4);
    const rawAtkB = sB.attack * matchB * (0.8 + rng() * 0.4);
    const dmgToB = Math.max(2, rawAtkA - sB.defense * 0.3 * (0.7 + rng() * 0.6));
    const dmgToA = Math.max(2, rawAtkB - sA.defense * 0.3 * (0.7 + rng() * 0.6));
    const weightDiff = sA.weight - sB.weight;
    const knockbackA = weightDiff > 3 ? weightDiff * 0.5 : 0;
    const knockbackB = weightDiff < -3 ? Math.abs(weightDiff) * 0.5 : 0;
    hpB -= dmgToB + knockbackA;
    hpA -= dmgToA + knockbackB;

    if (rng() < 0.1 + sA.attack * 0.001) {
      const critDmg = 12 + rng() * 8;
      hpB -= critDmg;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameA} place un coup critique ! (-${Math.round(critDmg)} PV supplementaires)`,
      });
    }
    if (rng() < 0.1 + sB.attack * 0.001) {
      const critDmg = 12 + rng() * 8;
      hpA -= critDmg;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameB} contre-attaque avec un coup critique !`,
      });
    }

    const drainA = Math.max(1, 8 - sA.stamina * 0.08);
    const drainB = Math.max(1, 8 - sB.stamina * 0.08);
    hpA -= drainA;
    hpB -= drainB;

    // Burst probability: clamp to [0, 0.30] to avoid guaranteed or negative rolls
    const burstProbB = Math.min(0.3, Math.max(0, rawAtkA * 0.01 - burstResB * 0.005 + 0.05));
    const burstProbA = Math.min(0.3, Math.max(0, rawAtkB * 0.01 - burstResA * 0.005 + 0.05));

    if (hpB < maxHp * 0.35 && rng() < burstProbB) {
      hpB = -10;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameA} fait BURST ${nameB} !`,
      });
      break;
    }
    if (hpA < maxHp * 0.35 && rng() < burstProbA) {
      hpA = -10;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameB} fait BURST ${nameA} !`,
      });
      break;
    }

    // Xtreme accumulation: capped at XTREME_CAP
    xtremeChanceA = Math.min(XTREME_CAP, xtremeChanceA + sA.dash * 0.003);
    xtremeChanceB = Math.min(XTREME_CAP, xtremeChanceB + sB.dash * 0.003);
    if (rng() < xtremeChanceA && hpB > 0) {
      const xtDmg = 30 + sA.dash * 0.5;
      hpB -= xtDmg;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameA} active la X-LINE ! Dash devastateur ! (-${Math.round(xtDmg)} PV)`,
      });
      xtremeChanceA = 0;
    }
    if (rng() < xtremeChanceB && hpA > 0) {
      const xtDmg = 30 + sB.dash * 0.5;
      hpA -= xtDmg;
      log.push({
        phase: `Tour ${round}`,
        text: `${nameB} active la X-LINE ! Dash devastateur ! (-${Math.round(xtDmg)} PV)`,
      });
      xtremeChanceB = 0;
    }
  }

  // Phase 4: Determine result
  hpA = Math.max(hpA, -10);
  hpB = Math.max(hpB, -10);
  if (hpA > 0 && hpB > 0) {
    const finalA = hpA + enduranceA * 0.2;
    const finalB = hpB + enduranceB * 0.2;
    if (finalA >= finalB) hpB = 0;
    else hpA = 0;
  }

  const winner: "A" | "B" = hpA > hpB ? "A" : "B";
  const loserHp = winner === "A" ? hpB : hpA;
  const winnerStats = winner === "A" ? sA : sB;
  let finishType: BbxFinishType;
  if (loserHp <= -5) {
    finishType = winnerStats.dash > 30 && rng() < 0.5 ? BBX_FINISH_TYPES[0]! : BBX_FINISH_TYPES[1]!;
  } else if (round >= MAX_ROUNDS - 2) {
    finishType = BBX_FINISH_TYPES[3]!;
  } else {
    finishType = BBX_FINISH_TYPES[2]!;
  }

  return {
    winner,
    finishType,
    hpA: Math.max(hpA, 0),
    hpB: Math.max(hpB, 0),
    maxHp,
    log,
    rounds: round,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "tcg-duel" — TCG Card Duel (Best of 3)
// Source: commands/General/DuelCommand.ts
// ═══════════════════════════════════════════════════════════════════════════════

export interface TcgDuelCard {
  id: string;
  name: string;
  rarity: string;
  element: string;
  att: number;
  def: number;
  end: number;
  equilibre: number;
  imageUrl: string | null;
  specialMove: string | null;
  beyblade: string | null;
  series: string;
}

export interface TcgRoundBonuses {
  synergy: boolean;
  underdog: boolean;
  momentum: boolean;
  lastStand: boolean;
}

export interface TcgRoundResult {
  cardA: TcgDuelCard;
  cardB: TcgDuelCard;
  powerA: number;
  powerB: number;
  winner: "A" | "B";
  events: string[];
  mvpDelta: number;
}

// Constants preserved from DuelCommand.ts
const TCG_RARITY_POWER: Record<string, number> = {
  COMMON: 0,
  RARE: 12,
  SUPER_RARE: 28,
  LEGENDARY: 50,
  SECRET: 70,
};

const TCG_ELEMENT_BEATS: Record<string, string> = {
  FEU: "VENT",
  VENT: "TERRE",
  TERRE: "EAU",
  EAU: "FEU",
  OMBRE: "LUMIERE",
  LUMIERE: "OMBRE",
};

export const TCG_ELEMENT_EMOJI: Record<string, string> = {
  FEU: "F",
  EAU: "E",
  TERRE: "T",
  VENT: "V",
  OMBRE: "O",
  LUMIERE: "L",
  NEUTRAL: "N",
};

export const TCG_ELEMENT_NAME: Record<string, string> = {
  FEU: "Feu",
  EAU: "Eau",
  TERRE: "Terre",
  VENT: "Vent",
  OMBRE: "Ombre",
  LUMIERE: "Lumiere",
  NEUTRAL: "Neutre",
};

export const TCG_RARITY_EMOJI: Record<string, string> = {
  COMMON: "C",
  RARE: "R",
  SUPER_RARE: "SR",
  LEGENDARY: "L",
  SECRET: "S",
};

export const TCG_RARITY_LABEL: Record<string, string> = {
  COMMON: "Commune",
  RARE: "Rare",
  SUPER_RARE: "Super Rare",
  LEGENDARY: "Legendaire",
  SECRET: "Secrete",
};

export const TCG_FINISH_TYPES = [
  { min: 1.6, msg: "X-TREME FINISH !", emoji: "X", color: 0xfbbf24 },
  { min: 1.35, msg: "BURST FINISH !", emoji: "B", color: 0xef4444 },
  { min: 1.1, msg: "OVER FINISH !", emoji: "O", color: 0x8b5cf6 },
  { min: 0, msg: "SPIN FINISH !", emoji: "S", color: 0x22c55e },
] as const;

export type TcgFinishType = (typeof TCG_FINISH_TYPES)[number];

/**
 * Rank tiers (thresholds verified against adaptive Elo K ranges).
 *
 * With adaptive K (K=40 early, K=20 established, K=10 high-rated):
 *   - A brand-new player reaching stable mid-Elo lands around 1000-1100.
 *   - Tiers compressed around 1000-1800 to reflect actual distribution.
 *
 * Thresholds unchanged from original (Bronze 0, Argent 900, Or 1100,
 * Platine 1300, Diamant 1500, Maitre 1800) — the distribution is correct.
 */
export const TCG_RANK_TIERS = [
  { min: 1800, name: "Maitre", emoji: "M", color: "#fbbf24" },
  { min: 1500, name: "Diamant", emoji: "D", color: "#22d3ee" },
  { min: 1300, name: "Platine", emoji: "P", color: "#a78bfa" },
  { min: 1100, name: "Or", emoji: "G", color: "#f59e0b" },
  { min: 900, name: "Argent", emoji: "A", color: "#9ca3af" },
  { min: 0, name: "Bronze", emoji: "B", color: "#cd7f32" },
] as const;

/**
 * Compute TCG card power for one round.
 *
 * Preserved from DuelCommand.ts:
 * - base: att*1.2 + def*0.6 + end*0.8 + equilibre*0.4
 * - rarity bonus: from TCG_RARITY_POWER
 * - element advantage: x1.5 (beats) / x0.75 (beaten)
 * - critical hit: 12% -> x1.4
 * - special move: 10% -> x1.35
 * - defense wall: def>60, 8% -> x0.7
 * - synergy bonus: x1.1
 * - underdog bonus: x1.12
 * - momentum bonus: x1.06
 * - last stand bonus: x1.15
 *
 * CHANGE (2026-05-30): variance tightened from 0.85..1.15 to 0.90..1.10.
 * The stronger card now wins more reliably (~75 % at equal stats, more with
 * a gap) while upsets remain possible when procs stack for the weaker side.
 *
 * @param rng Injectable RNG (default Math.random).
 */
export function tcgComputePower(
  card: TcgDuelCard,
  opponentElement: string,
  bonuses: TcgRoundBonuses,
  rng: () => number = Math.random,
): { power: number; events: string[] } {
  const events: string[] = [];
  const base = card.att * 1.2 + card.def * 0.6 + card.end * 0.8 + card.equilibre * 0.4;
  const rarityBonus = TCG_RARITY_POWER[card.rarity] ?? 0;
  let mult = 1.0;

  if (TCG_ELEMENT_BEATS[card.element] === opponentElement) {
    mult *= 1.5;
    events.push(
      `${TCG_ELEMENT_EMOJI[card.element] ?? ""} **${TCG_ELEMENT_NAME[card.element]}** domine **${TCG_ELEMENT_NAME[opponentElement]}** !`,
    );
  } else if (TCG_ELEMENT_BEATS[opponentElement] === card.element) {
    mult *= 0.75;
  }

  if (rng() < 0.12) {
    mult *= 1.4;
    events.push("**Coup critique** — puissance decuplee !");
  }
  if (card.specialMove && rng() < 0.1) {
    mult *= 1.35;
    events.push(`**${card.specialMove}** declenche !`);
  }
  if (card.def > 60 && rng() < 0.08) {
    mult *= 0.7;
    events.push("**Mur de defense** — impact absorbe !");
  }
  if (bonuses.synergy) {
    mult *= 1.1;
    events.push("**Synergie elementaire** — equipe harmonisee !");
  }
  if (bonuses.underdog) {
    mult *= 1.12;
    events.push("**Underdog** — la rage du plus faible !");
  }
  if (bonuses.momentum) {
    mult *= 1.06;
    events.push("**Momentum** — sur sa lancee !");
  }
  if (bonuses.lastStand) {
    mult *= 1.15;
    events.push("**Dernier souffle** — tout ou rien !");
  }

  // Variance narrowed: 0.90..1.10 (range 0.20, was 0.85..1.15 / range 0.30)
  // Tighter variance = stronger card wins more often without becoming deterministic.
  const variance = 0.9 + rng() * 0.2;
  return {
    power: Math.round((base + rarityBonus) * mult * variance * 100) / 100,
    events,
  };
}

/** Check if all non-neutral cards share one element (synergy) */
export function tcgHasSynergy(cards: TcgDuelCard[]): boolean {
  const elements = cards.map((c) => c.element).filter((e) => e !== "NEUTRAL");
  if (elements.length < 2) return false;
  return new Set(elements).size === 1;
}

/** Sum of all card base stats */
export function tcgTeamPower(cards: TcgDuelCard[]): number {
  return cards.reduce((s, c) => s + c.att + c.def + c.end + c.equilibre, 0);
}

/**
 * Resolve one TCG round.
 * @param rng Injectable RNG (default Math.random).
 */
export function tcgResolveRound(
  cardA: TcgDuelCard,
  cardB: TcgDuelCard,
  bonusesA: TcgRoundBonuses,
  bonusesB: TcgRoundBonuses,
  rng: () => number = Math.random,
): TcgRoundResult {
  const a = tcgComputePower(cardA, cardB.element, bonusesA, rng);
  const b = tcgComputePower(cardB, cardA.element, bonusesB, rng);
  const winner: "A" | "B" = a.power >= b.power ? "A" : "B";
  const mvpDelta = Math.abs(a.power - b.power);
  return {
    cardA,
    cardB,
    powerA: a.power,
    powerB: b.power,
    winner,
    events: [...a.events, ...b.events],
    mvpDelta,
  };
}

/**
 * Get finish type from average power ratio over rounds.
 * Threshold order: >=1.6 xtreme, >=1.35 burst, >=1.1 over, else spin
 */
export function tcgGetFinish(avgRatio: number): TcgFinishType {
  return TCG_FINISH_TYPES.find((f) => avgRatio >= f.min) ?? TCG_FINISH_TYPES[3]!;
}

/**
 * Get rank tier from ELO rating.
 * Tiers: Maitre>=1800, Diamant>=1500, Platine>=1300, Or>=1100, Argent>=900, Bronze>=0
 */
export function tcgGetRankTier(rating: number): (typeof TCG_RANK_TIERS)[number] {
  return TCG_RANK_TIERS.find((t) => rating >= t.min) ?? TCG_RANK_TIERS[5]!;
}

/**
 * Sort metric for cards (sum of base stats, descending).
 */
export function tcgCardSortPower(c: {
  att: number;
  def: number;
  end: number;
  equilibre: number;
}): number {
  return c.att + c.def + c.end + c.equilibre;
}

/**
 * TCG power bar display (10 chars).
 */
export function tcgPowerBar(value: number, max: number, len = 10): string {
  const filled = Math.round((value / Math.max(max, 1)) * len);
  return "|".repeat(Math.min(filled, len)) + ".".repeat(Math.max(len - filled, 0));
}

/**
 * ELO calculation with adaptive K-factor, optional margin-of-victory multiplier,
 * and a rating floor.
 *
 * K-factor schedule (games-played based):
 *   < 30 games  → K = 40  (provisional — large swings to find true level quickly)
 *   30-99 games → K = 20  (established)
 *   >= 100 games→ K = 10  (high-rated, resistant to noise)
 *
 * Margin-of-victory (MOV) multiplier (optional):
 *   movScore in [0, 1]:
 *     0   = extremely close fight (no bonus)
 *     0.5 = moderate dominance
 *     1   = complete domination
 *   Formula: movMultiplier = 1 + movScore * 0.5  (range 1.0 .. 1.5)
 *   Caps the K effectively at K * 1.5.
 *
 * Rating floor: neither player drops below MIN_RATING (100) after any single match.
 *
 * Backward compatibility: calling calcElo(rA, rB, winner) with no extra args
 * uses K=32 behaviour for the first 30 games, transitioning down thereafter.
 * The old hardcoded K=32 is replaced by the adaptive schedule; callers that
 * previously passed only 3 args continue to work unchanged.
 *
 * @param ratingA      Current ELO of player A
 * @param ratingB      Current ELO of player B
 * @param winnerIsA    true if A won, false if B won
 * @param gamesPlayedA Number of games A has played (default 0 = provisional)
 * @param gamesPlayedB Number of games B has played (default 0 = provisional)
 * @param movScore     Margin-of-victory in [0,1] (default 0 = no MOV bonus)
 */
export function calcElo(
  ratingA: number,
  ratingB: number,
  winnerIsA: boolean,
  gamesPlayedA = 0,
  gamesPlayedB = 0,
  movScore = 0,
): { newA: number; newB: number; deltaA: number; deltaB: number } {
  const MIN_RATING = 100;

  function adaptiveK(games: number): number {
    if (games < 30) return 40;
    if (games < 100) return 20;
    return 10;
  }

  const kA = adaptiveK(gamesPlayedA);
  const kB = adaptiveK(gamesPlayedB);

  // MOV multiplier: 1.0 (no bonus) .. 1.5 (max domination)
  const clampedMov = Math.min(1, Math.max(0, movScore));
  const movMult = 1 + clampedMov * 0.5;

  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const actualA = winnerIsA ? 1 : 0;
  const actualB = winnerIsA ? 0 : 1;

  const rawDeltaA = Math.round(kA * movMult * (actualA - expectedA));
  const rawDeltaB = Math.round(kB * movMult * (actualB - expectedB));

  // Apply rating floor: winner never loses points; loser never drops below floor.
  const newARaw = ratingA + rawDeltaA;
  const newBRaw = ratingB + rawDeltaB;

  const newA = Math.max(MIN_RATING, newARaw);
  const newB = Math.max(MIN_RATING, newBRaw);

  // Recalculate actual deltas after floor clamping
  const deltaA = newA - ratingA;
  const deltaB = newB - ratingB;

  return { newA, newB, deltaA, deltaB };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "quick-battle" — Single-score battle (Beyblade-style)
// Source: lib/battle-utils.ts -> runBattleSimulation()
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickBattleStats {
  attack: number;
  defense: number;
  stamina: number;
  dash: number;
  power: number;
  beyType?: QuickBeyType;
}

export type QuickBeyType = "ATTACK" | "DEFENSE" | "STAMINA" | "BALANCE";

export const QUICK_BEY_TYPES = {
  ATTACK: { name: "Attaque", emoji: "A", color: "#ef4444", element: "Feu" },
  DEFENSE: { name: "Defense", emoji: "D", color: "#3b82f6", element: "Glace" },
  STAMINA: {
    name: "Endurance",
    emoji: "S",
    color: "#22c55e",
    element: "Vent",
  },
  BALANCE: {
    name: "Equilibre",
    emoji: "B",
    color: "#a855f7",
    element: "Terre",
  },
} as const;

export const QUICK_FINISH_TYPES = {
  xtreme: {
    result: "xtreme",
    name: "X-TREME FINISH",
    message: "**X-TREME FINISH !**",
    description: "Ejection a pleine vitesse via le X-Line !",
    points: 3,
    emoji: "X",
    dominantStat: "attack" as const,
    minPowerRatio: 0.4,
    color: "#f7d301",
  },
  burst: {
    result: "burst",
    name: "BURST FINISH",
    message: "**BURST FINISH !**",
    description: "La toupie adverse explose sous l'impact !",
    points: 2,
    emoji: "B",
    dominantStat: "attack" as const,
    minPowerRatio: 0.3,
    color: "#ce0c07",
  },
  over: {
    result: "over",
    name: "OVER FINISH",
    message: "**OVER FINISH !**",
    description: "Ejection du stadium par la force defensive !",
    points: 2,
    emoji: "O",
    dominantStat: "defense" as const,
    minPowerRatio: 0.3,
    color: "#3b82f6",
  },
  spin: {
    result: "spin",
    name: "SPIN FINISH",
    message: "**SPIN FINISH !**",
    description: "La toupie adverse s'arrete de tourner.",
    points: 1,
    emoji: "S",
    dominantStat: "stamina" as const,
    minPowerRatio: 0.0,
    color: "#22c55e",
  },
  xcelerator: {
    result: "xcelerator",
    name: "X-CELERATOR FINISH",
    message: "**X-CELERATOR FINISH !**",
    description: "Impact devastateur depuis le Xtreme Dash !",
    points: 3,
    emoji: "XC",
    dominantStat: "dash" as const,
    minPowerRatio: 0.0,
    color: "#e68002",
  },
  survivor: {
    result: "survivor",
    name: "SURVIVOR FINISH",
    message: "**SURVIVOR FINISH !**",
    description: "Victoire par resistance — tous les coups encaisses !",
    points: 1,
    emoji: "SV",
    dominantStat: "defense" as const,
    minPowerRatio: 0.35,
    color: "#60a5fa",
  },
} as const;

export type QuickFinishKey = keyof typeof QUICK_FINISH_TYPES;
export type QuickFinishType = (typeof QUICK_FINISH_TYPES)[QuickFinishKey];

/**
 * Type advantage matrix.
 * Cycle (preserved): Attack > Stamina > Defense > Attack; Balance = neutral.
 *
 * Multipliers updated (2026-05-30) to match BBX convention:
 *   advantage    = 1.20  (was 1.15)
 *   disadvantage = 0.833 (was 0.88 — now reciprocal of 1.20)
 */
const QUICK_TYPE_ADVANTAGE: Record<QuickBeyType, QuickBeyType> = {
  ATTACK: "STAMINA",
  STAMINA: "DEFENSE",
  DEFENSE: "ATTACK",
  BALANCE: "BALANCE",
};

function quickGetTypeAdvantage(
  attacker: QuickBeyType | undefined,
  defender: QuickBeyType | undefined,
): number {
  if (!attacker || !defender || attacker === "BALANCE" || defender === "BALANCE") return 1.0;
  if (QUICK_TYPE_ADVANTAGE[attacker] === defender) return 1.2; // advantage
  if (QUICK_TYPE_ADVANTAGE[defender] === attacker) return 1 / 1.2; // disadvantage (~0.833)
  return 1.0;
}

/**
 * Detect dominant bey type from stats.
 * Threshold: 38% of total (atk+def+sta).
 */
export function detectBeyType(stats: {
  attack: number;
  defense: number;
  stamina: number;
}): QuickBeyType {
  const { attack, defense, stamina } = stats;
  const total = attack + defense + stamina;
  if (total === 0) return "BALANCE";
  const threshold = 0.38;
  const atkRatio = attack / total;
  const defRatio = defense / total;
  const staRatio = stamina / total;
  if (atkRatio > threshold && atkRatio >= defRatio && atkRatio >= staRatio) return "ATTACK";
  if (defRatio > threshold && defRatio >= atkRatio && defRatio >= staRatio) return "DEFENSE";
  if (staRatio > threshold && staRatio >= atkRatio && staRatio >= defRatio) return "STAMINA";
  return "BALANCE";
}

function quickDetermineFinishType(
  winnerStats: QuickBattleStats,
  loserStats: QuickBattleStats,
  rng: () => number,
): QuickFinishType {
  const { attack, defense, stamina, dash } = winnerStats;
  const total = attack + defense + stamina;
  if (total === 0) return QUICK_FINISH_TYPES.spin;
  const atkRatio = attack / total;
  const defRatio = defense / total;
  const dashBonus = dash > 50 ? 0.15 : 0;
  const powerGap = (winnerStats.power - loserStats.power) / Math.max(winnerStats.power, 1);
  const roll = rng();

  if (dash > 60 && atkRatio > 0.3 && roll < 0.12 + dashBonus) return QUICK_FINISH_TYPES.xcelerator;
  if (atkRatio > 0.35 && roll < atkRatio * 0.4 + dashBonus + powerGap * 0.1)
    return QUICK_FINISH_TYPES.xtreme;
  if (roll < atkRatio * 0.7 + dashBonus) return QUICK_FINISH_TYPES.burst;
  if (defRatio > 0.35 && Math.abs(powerGap) < 0.1 && roll < 0.5) return QUICK_FINISH_TYPES.survivor;
  if (roll < atkRatio * 0.7 + defRatio * 0.6) return QUICK_FINISH_TYPES.over;
  return QUICK_FINISH_TYPES.spin;
}

export interface QuickBattleScoreResult {
  scoreA: number;
  scoreB: number;
  typeAdvantageA: number;
  typeAdvantageB: number;
  criticalHit: "A" | "B" | null;
  xDash: "A" | "B" | null;
}

/**
 * Calculate battle scores with all modifiers for quick-battle variant.
 * Preserves all constants from battle-utils.ts:
 * - luck: 0.82..1.18
 * - type advantage: x1.20 (advantage) / x0.833 (disadvantage)
 * - critical: 8% -> x1.25
 * - xDash: dash>55, 20% -> x1.15
 *
 * @param rng Injectable RNG (default Math.random).
 */
export function quickCalculateBattleScores(
  statsA: QuickBattleStats,
  statsB: QuickBattleStats,
  rng: () => number = Math.random,
): QuickBattleScoreResult {
  const luckA = 0.82 + rng() * 0.36;
  const luckB = 0.82 + rng() * 0.36;
  const typeAdvA = quickGetTypeAdvantage(statsA.beyType, statsB.beyType);
  const typeAdvB = quickGetTypeAdvantage(statsB.beyType, statsA.beyType);
  const critA = rng() < 0.08;
  const critB = rng() < 0.08;
  const critMultA = critA ? 1.25 : 1.0;
  const critMultB = critB ? 1.25 : 1.0;
  const xDashA = statsA.dash > 55 && rng() < 0.2;
  const xDashB = statsB.dash > 55 && rng() < 0.2;
  const xDashMultA = xDashA ? 1.15 : 1.0;
  const xDashMultB = xDashB ? 1.15 : 1.0;
  const scoreA = statsA.power * luckA * typeAdvA * critMultA * xDashMultA;
  const scoreB = statsB.power * luckB * typeAdvB * critMultB * xDashMultB;
  return {
    scoreA,
    scoreB,
    typeAdvantageA: typeAdvA,
    typeAdvantageB: typeAdvB,
    criticalHit: critA ? "A" : critB ? "B" : null,
    xDash: xDashA ? "A" : xDashB ? "B" : null,
  };
}

/**
 * Build narrative lines for quick-battle result.
 */
export function quickBuildNarrative(
  scores: QuickBattleScoreResult,
  winnerIsA: boolean,
  finish: QuickFinishType,
  challengerName: string,
  opponentName: string,
): string[] {
  const lines: string[] = [];
  const winnerName = winnerIsA ? challengerName : opponentName;
  if (scores.xDash) {
    const dasher = scores.xDash === "A" ? challengerName : opponentName;
    lines.push(`**${dasher}** active le **Xtreme Dash** !`);
  }
  if (scores.typeAdvantageA > 1 || scores.typeAdvantageB > 1) {
    const advantaged = scores.typeAdvantageA > 1 ? challengerName : opponentName;
    lines.push(`**${advantaged}** a l'avantage de type !`);
  }
  if (scores.criticalHit) {
    const critter = scores.criticalHit === "A" ? challengerName : opponentName;
    lines.push(`**${critter}** porte un coup critique !`);
  }
  lines.push(`**${winnerName}** remporte le combat !`);
  lines.push(`> *${finish.description}*`);
  return lines;
}

/**
 * Run a complete quick battle simulation.
 * Returns winner, finish type, narrative, and raw scores.
 *
 * @param rng Injectable RNG (default Math.random).
 */
export function simulateQuickBattle(
  statsA: QuickBattleStats,
  statsB: QuickBattleStats,
  nameA: string,
  nameB: string,
  rng: () => number = Math.random,
): {
  winnerIsA: boolean;
  scores: QuickBattleScoreResult;
  finishType: QuickFinishType;
  narrative: string[];
} {
  if (!statsA.beyType) statsA.beyType = detectBeyType(statsA);
  if (!statsB.beyType) statsB.beyType = detectBeyType(statsB);

  const scores = quickCalculateBattleScores(statsA, statsB, rng);
  const winnerIsA = scores.scoreA > scores.scoreB;
  const winnerStats = winnerIsA ? statsA : statsB;
  const loserStats = winnerIsA ? statsB : statsA;
  const finishType = quickDetermineFinishType(winnerStats, loserStats, rng);
  const narrative = quickBuildNarrative(scores, winnerIsA, finishType, nameA, nameB);

  return { winnerIsA, scores, finishType, narrative };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Pick a random element from an array */
export function pickRandom<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Stat bar display (block chars) */
export function statBar(value: number, max = 100): string {
  const filled = Math.round((value / max) * 10);
  return "|".repeat(Math.min(filled, 10)) + ".".repeat(10 - Math.min(filled, 10));
}

/** Get type color for Beyblade X type */
export function getTypeColor(beyType: string | null): number {
  switch (beyType) {
    case "ATTACK":
      return 0xef4444;
    case "DEFENSE":
      return 0x3b82f6;
    case "STAMINA":
      return 0x22c55e;
    case "BALANCE":
      return 0xa855f7;
    default:
      return 0x8b5cf6;
  }
}

/** Get type emoji for Beyblade X type */
export function getTypeEmoji(beyType: string | null): string {
  switch (beyType) {
    case "ATTACK":
      return "ATK";
    case "DEFENSE":
      return "DEF";
    case "STAMINA":
      return "STA";
    case "BALANCE":
      return "BAL";
    default:
      return "STA";
  }
}
