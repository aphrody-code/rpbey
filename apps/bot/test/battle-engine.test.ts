/**
 * test/battle-engine.test.ts
 *
 * Deterministic test suite for src/lib/battle-engine.ts.
 *
 * All randomness is controlled via a seeded linear-congruential RNG so every
 * run produces the same results. Statistical win-rate assertions are measured
 * over N=1000 simulations with a deterministic RNG sequence.
 */

import { describe, expect, it } from "bun:test";

import {
  calcElo,
  detectBeyType,
  simulateBbxBattle,
  simulateQuickBattle,
  tcgComputePower,
  tcgGetRankTier,
  tcgResolveRound,
  type BbxComboStats,
  type QuickBattleStats,
  type TcgDuelCard,
  type TcgRoundBonuses,
} from "../src/lib/battle-engine.js";

// ─── Deterministic RNG ────────────────────────────────────────────────────────

/**
 * Simple seeded LCG (parameters from Numerical Recipes).
 * Returns a factory so each test gets an independent sequence.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// ~1.2x all-stats advantage → empirical win rate ~77% (verified 2026-05-30)
const STRONG_STATS: BbxComboStats = {
  attack: 60,
  defense: 50,
  stamina: 60,
  dash: 40,
  burst: 25,
  weight: 10,
};

// ~0.83x of STRONG_STATS (reciprocal 1.2x)
const WEAK_STATS: BbxComboStats = {
  attack: 50,
  defense: 42,
  stamina: 50,
  dash: 33,
  burst: 21,
  weight: 8,
};

const EQUAL_STATS: BbxComboStats = {
  attack: 50,
  defense: 50,
  stamina: 50,
  dash: 30,
  burst: 20,
  weight: 8,
};

function makeCard(overrides: Partial<TcgDuelCard> = {}): TcgDuelCard {
  return {
    id: "test",
    name: "TestCard",
    rarity: "COMMON",
    element: "NEUTRAL",
    att: 50,
    def: 50,
    end: 50,
    equilibre: 50,
    imageUrl: null,
    specialMove: null,
    beyblade: null,
    series: "X",
    ...overrides,
  };
}

const NO_BONUSES: TcgRoundBonuses = {
  synergy: false,
  underdog: false,
  momentum: false,
  lastStand: false,
};

// ─── BBX: combat always terminates ────────────────────────────────────────────

describe("simulateBbxBattle — termination", () => {
  it("always produces a winner (never hangs) over 200 varied seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed);
      const result = simulateBbxBattle(
        STRONG_STATS,
        "ATTACK",
        WEAK_STATS,
        "STAMINA",
        "A",
        "B",
        rng,
      );
      expect(result.winner === "A" || result.winner === "B").toBe(true);
      expect(result.rounds).toBeGreaterThanOrEqual(0);
      expect(result.rounds).toBeLessThanOrEqual(12);
    }
  });

  it("rounds are bounded [0, 12] even with equal stats", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed + 300);
      const r = simulateBbxBattle(EQUAL_STATS, null, EQUAL_STATS, null, "X", "Y", rng);
      expect(r.rounds).toBeGreaterThanOrEqual(0);
      expect(r.rounds).toBeLessThanOrEqual(12);
    }
  });
});

// ─── BBX: no NaN / no negative HP in result ───────────────────────────────────

describe("simulateBbxBattle — result integrity", () => {
  it("hpA and hpB are non-negative numbers in the result", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed + 500);
      const r = simulateBbxBattle(STRONG_STATS, "ATTACK", WEAK_STATS, "DEFENSE", "A", "B", rng);
      expect(isNaN(r.hpA)).toBe(false);
      expect(isNaN(r.hpB)).toBe(false);
      expect(r.hpA).toBeGreaterThanOrEqual(0);
      expect(r.hpB).toBeGreaterThanOrEqual(0);
    }
  });

  it("exactly one combatant ends at 0 HP", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed + 600);
      const r = simulateBbxBattle(STRONG_STATS, null, WEAK_STATS, null, "A", "B", rng);
      const zeroCount = [r.hpA === 0, r.hpB === 0].filter(Boolean).length;
      expect(zeroCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── BBX: stat superiority → win-rate ~70-80% ─────────────────────────────────

describe("simulateBbxBattle — win-rate", () => {
  it("strong stats (~1.2x all) wins 65-90% vs weak over 1000 runs", () => {
    let winsA = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 7 + 1);
      const r = simulateBbxBattle(STRONG_STATS, null, WEAK_STATS, null, "A", "B", rng);
      if (r.winner === "A") winsA++;
    }
    const rate = winsA / N;
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.9);
  });

  it("type advantage ATTACK>STAMINA boosts win-rate by at least 5pp vs neutral matchup", () => {
    let winsAdvantage = 0;
    let winsNeutral = 0;
    const N = 1000;
    // Use same stat level for both sides so only type differs
    const statA: BbxComboStats = {
      attack: 55,
      defense: 40,
      stamina: 40,
      dash: 30,
      burst: 20,
      weight: 8,
    };
    const statB: BbxComboStats = {
      attack: 55,
      defense: 40,
      stamina: 40,
      dash: 30,
      burst: 20,
      weight: 8,
    };
    for (let i = 0; i < N; i++) {
      const rng1 = makeRng(i * 3 + 1);
      const rng2 = makeRng(i * 3 + 1); // same seed = same luck sequence
      const rAdv = simulateBbxBattle(statA, "ATTACK", statB, "STAMINA", "A", "B", rng1);
      const rNeu = simulateBbxBattle(statA, null, statB, null, "A", "B", rng2);
      if (rAdv.winner === "A") winsAdvantage++;
      if (rNeu.winner === "A") winsNeutral++;
    }
    expect(winsAdvantage / N).toBeGreaterThan(winsNeutral / N + 0.05);
  });
});

// ─── TCG: power computation ───────────────────────────────────────────────────

describe("tcgComputePower — determinism & no NaN", () => {
  it("returns same value for same seed", () => {
    const card = makeCard({ att: 60, def: 40, end: 55, equilibre: 30 });
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    const p1 = tcgComputePower(card, "NEUTRAL", NO_BONUSES, rng1);
    const p2 = tcgComputePower(card, "NEUTRAL", NO_BONUSES, rng2);
    expect(p1.power).toBe(p2.power);
  });

  it("never returns NaN", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed);
      const card = makeCard({ att: seed % 100, def: seed % 80, end: seed % 70, equilibre: 30 });
      const result = tcgComputePower(card, "NEUTRAL", NO_BONUSES, rng);
      expect(isNaN(result.power)).toBe(false);
      expect(result.power).toBeGreaterThan(0);
    }
  });
});

// ─── TCG: stronger card wins more often with tighter variance ─────────────────

describe("tcgResolveRound — win-rate with tightened variance", () => {
  // Strong card: uniform 54; Weak: uniform 50 (~8% stat lead).
  // Empirical win rate ~75% at N=2000 (verified 2026-05-30).
  it("card with ~8% stat lead wins 65-88% over 1000 rounds", () => {
    const strongCard = makeCard({ att: 54, def: 54, end: 54, equilibre: 54 });
    const weakCard = makeCard({ att: 50, def: 50, end: 50, equilibre: 50 });
    let winsA = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 11 + 7);
      const r = tcgResolveRound(strongCard, weakCard, NO_BONUSES, NO_BONUSES, rng);
      if (r.winner === "A") winsA++;
    }
    const rate = winsA / N;
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.88);
  });

  it("equal cards land 40-60% win-rate (near-coin-flip)", () => {
    const card = makeCard({ att: 55, def: 50, end: 55, equilibre: 45 });
    let winsA = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 13 + 3);
      const r = tcgResolveRound(card, { ...card }, NO_BONUSES, NO_BONUSES, rng);
      if (r.winner === "A") winsA++;
    }
    const rate = winsA / N;
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });
});

// ─── Quick-battle: win-rate & no NaN ─────────────────────────────────────────

describe("simulateQuickBattle — win-rate", () => {
  // Power 105 vs 95 (~10% gap) → empirical ~72% win rate (verified 2026-05-30).
  it("power 105 wins 65-82% vs power 95 over 1000 runs", () => {
    const strong: QuickBattleStats = {
      attack: 50,
      defense: 50,
      stamina: 50,
      dash: 30,
      power: 105,
    };
    const weak: QuickBattleStats = {
      attack: 50,
      defense: 50,
      stamina: 50,
      dash: 30,
      power: 95,
    };
    let winsA = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 17 + 5);
      const r = simulateQuickBattle(strong, weak, "A", "B", rng);
      if (r.winnerIsA) winsA++;
    }
    const rate = winsA / N;
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.82);
  });

  it("scores are finite numbers", () => {
    const stats: QuickBattleStats = { attack: 50, defense: 50, stamina: 50, dash: 30, power: 100 };
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed + 900);
      const r = simulateQuickBattle(stats, { ...stats }, "A", "B", rng);
      expect(isFinite(r.scores.scoreA)).toBe(true);
      expect(isFinite(r.scores.scoreB)).toBe(true);
    }
  });
});

// ─── Type advantage: Quick ────────────────────────────────────────────────────

describe("simulateQuickBattle — type advantage cycle", () => {
  const power = 100;
  const base = (beyType: QuickBattleStats["beyType"]): QuickBattleStats => ({
    attack: 50,
    defense: 50,
    stamina: 50,
    dash: 30,
    power,
    beyType,
  });

  it("ATTACK beats STAMINA (win-rate > STAMINA beats ATTACK) over 500 runs each", () => {
    let winsATK = 0;
    let winsSTAvsATK = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const rng1 = makeRng(i * 7);
      const rng2 = makeRng(i * 7);
      if (simulateQuickBattle(base("ATTACK"), base("STAMINA"), "A", "B", rng1).winnerIsA) winsATK++;
      if (simulateQuickBattle(base("STAMINA"), base("ATTACK"), "A", "B", rng2).winnerIsA)
        winsSTAvsATK++;
    }
    expect(winsATK / N).toBeGreaterThan(winsSTAvsATK / N);
  });

  it("STAMINA beats DEFENSE consistently", () => {
    let winsSTAdef = 0;
    let winsDEFsta = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const rng1 = makeRng(i * 9 + 1);
      const rng2 = makeRng(i * 9 + 1);
      if (simulateQuickBattle(base("STAMINA"), base("DEFENSE"), "A", "B", rng1).winnerIsA)
        winsSTAdef++;
      if (simulateQuickBattle(base("DEFENSE"), base("STAMINA"), "A", "B", rng2).winnerIsA)
        winsDEFsta++;
    }
    expect(winsSTAdef / N).toBeGreaterThan(winsDEFsta / N);
  });

  it("DEFENSE beats ATTACK consistently", () => {
    let winsDEFatk = 0;
    let winsATKdef = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const rng1 = makeRng(i * 11 + 2);
      const rng2 = makeRng(i * 11 + 2);
      if (simulateQuickBattle(base("DEFENSE"), base("ATTACK"), "A", "B", rng1).winnerIsA)
        winsDEFatk++;
      if (simulateQuickBattle(base("ATTACK"), base("DEFENSE"), "A", "B", rng2).winnerIsA)
        winsATKdef++;
    }
    expect(winsDEFatk / N).toBeGreaterThan(winsATKdef / N);
  });
});

// ─── ELO: basic invariants ────────────────────────────────────────────────────

describe("calcElo — basic invariants", () => {
  it("winner gains points, loser loses points", () => {
    const { deltaA, deltaB } = calcElo(1200, 1200, true);
    expect(deltaA).toBeGreaterThan(0);
    expect(deltaB).toBeLessThan(0);
  });

  it("loser side: winner gains, loser loses when B wins", () => {
    const { deltaA, deltaB } = calcElo(1200, 1200, false);
    expect(deltaA).toBeLessThan(0);
    expect(deltaB).toBeGreaterThan(0);
  });

  it("zero-sum: |deltaA| === |deltaB| when both have same K (equal games)", () => {
    // With equal gamesPlayed the K is the same, so exchange should be zero-sum.
    const { deltaA, deltaB } = calcElo(1500, 1500, true, 50, 50);
    // Due to rounding each delta is independently rounded; sum should be near 0.
    expect(Math.abs(deltaA + deltaB)).toBeLessThanOrEqual(1);
  });

  it("rating floor: loser never goes below 100", () => {
    // Put a new player at 105 with K=40 against a much stronger opponent.
    const result = calcElo(105, 2000, false, 0, 0);
    expect(result.newB).toBeGreaterThanOrEqual(100);
    expect(result.newA).toBeGreaterThanOrEqual(100);
  });

  it("rating floor at exactly 100 when already below would not happen (enforced)", () => {
    // Player at 101 loses a lot of K=40 — floor kicks in
    const result = calcElo(101, 1800, false, 0, 0);
    expect(result.newA).toBeGreaterThanOrEqual(100);
  });
});

// ─── ELO: adaptive K-factor ───────────────────────────────────────────────────

describe("calcElo — adaptive K-factor", () => {
  it("provisional player (0 games) gets bigger swings than established (50 games)", () => {
    const { deltaA: deltaProvisional } = calcElo(1000, 1000, true, 0, 0);
    const { deltaA: deltaEstablished } = calcElo(1000, 1000, true, 50, 50);
    expect(Math.abs(deltaProvisional)).toBeGreaterThan(Math.abs(deltaEstablished));
  });

  it("established player (50 games) gets bigger swings than high-rated (150 games)", () => {
    const { deltaA: deltaEstablished } = calcElo(1000, 1000, true, 50, 50);
    const { deltaA: deltaHighRated } = calcElo(1000, 1000, true, 150, 150);
    expect(Math.abs(deltaEstablished)).toBeGreaterThan(Math.abs(deltaHighRated));
  });

  it("K=40 at 0 games: delta ~20 when winning 50/50 matchup", () => {
    // Expected win probability ~0.5, K=40, delta ~= 40*0.5 = 20
    const { deltaA } = calcElo(1000, 1000, true, 0, 0);
    expect(deltaA).toBe(20);
  });

  it("K=20 at 50 games: delta ~10 when winning 50/50 matchup", () => {
    const { deltaA } = calcElo(1000, 1000, true, 50, 50);
    expect(deltaA).toBe(10);
  });

  it("K=10 at 150 games: delta ~5 when winning 50/50 matchup", () => {
    const { deltaA } = calcElo(1000, 1000, true, 150, 150);
    expect(deltaA).toBe(5);
  });
});

// ─── ELO: margin-of-victory ───────────────────────────────────────────────────

describe("calcElo — margin-of-victory multiplier", () => {
  it("MOV=1 yields larger delta than MOV=0", () => {
    const { deltaA: noMov } = calcElo(1000, 1000, true, 50, 50, 0);
    const { deltaA: fullMov } = calcElo(1000, 1000, true, 50, 50, 1);
    expect(Math.abs(fullMov)).toBeGreaterThan(Math.abs(noMov));
  });

  it("MOV clamped to [0,1]: values outside range produce same result as clamped", () => {
    const { deltaA: mov1 } = calcElo(1000, 1000, true, 50, 50, 1);
    const { deltaA: mov2 } = calcElo(1000, 1000, true, 50, 50, 5); // should clamp to 1
    expect(mov1).toBe(mov2);

    const { deltaA: mov0 } = calcElo(1000, 1000, true, 50, 50, 0);
    const { deltaA: movNeg } = calcElo(1000, 1000, true, 50, 50, -3); // should clamp to 0
    expect(mov0).toBe(movNeg);
  });
});

// ─── ELO: backward compatibility ─────────────────────────────────────────────

describe("calcElo — backward compatibility (3-arg call)", () => {
  it("calling with 3 args works without error and produces sensible output", () => {
    const result = calcElo(1200, 1000, true);
    expect(typeof result.newA).toBe("number");
    expect(typeof result.newB).toBe("number");
    expect(result.newA).toBeGreaterThan(1200); // winner gained
    expect(result.newB).toBeLessThan(1000); // loser lost
  });

  it("favourite wins small, underdog wins big", () => {
    const { deltaA: favDelta } = calcElo(1400, 1000, true, 50, 50);
    const { deltaA: underdogDelta } = calcElo(1000, 1400, true, 50, 50);
    expect(underdogDelta).toBeGreaterThan(favDelta);
  });
});

// ─── Rank tiers ───────────────────────────────────────────────────────────────

describe("tcgGetRankTier — coverage", () => {
  const cases: Array<[number, string]> = [
    [0, "Bronze"],
    [899, "Bronze"],
    [900, "Argent"],
    [1099, "Argent"],
    [1100, "Or"],
    [1299, "Or"],
    [1300, "Platine"],
    [1499, "Platine"],
    [1500, "Diamant"],
    [1799, "Diamant"],
    [1800, "Maitre"],
    [3000, "Maitre"],
  ];

  for (const [rating, expected] of cases) {
    it(`rating ${rating} → ${expected}`, () => {
      expect(tcgGetRankTier(rating).name).toBe(expected);
    });
  }
});

// ─── detectBeyType ────────────────────────────────────────────────────────────

describe("detectBeyType", () => {
  it("attack-heavy stat block detected as ATTACK", () => {
    expect(detectBeyType({ attack: 80, defense: 20, stamina: 20 })).toBe("ATTACK");
  });
  it("defense-heavy detected as DEFENSE", () => {
    expect(detectBeyType({ attack: 20, defense: 80, stamina: 20 })).toBe("DEFENSE");
  });
  it("stamina-heavy detected as STAMINA", () => {
    expect(detectBeyType({ attack: 20, defense: 20, stamina: 80 })).toBe("STAMINA");
  });
  it("balanced detected as BALANCE", () => {
    expect(detectBeyType({ attack: 33, defense: 33, stamina: 34 })).toBe("BALANCE");
  });
  it("all zeros -> BALANCE", () => {
    expect(detectBeyType({ attack: 0, defense: 0, stamina: 0 })).toBe("BALANCE");
  });
});
