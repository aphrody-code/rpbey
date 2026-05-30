/**
 * Tests unitaires des algorithmes gacha et ranking.
 * Entierement sans DB — fonctions pures uniquement.
 *
 *   cd apps/gacha-server && bun test test/gacha-algorithms.test.ts
 */
import { describe, expect, it, afterEach } from "bun:test";
import { computeEffectiveRates, rollRarity, resetRng, setRng } from "../src/game";
import {
  PITY_SR_SOFT_START,
  PITY_THRESHOLD,
  PITY_LEGENDARY_SOFT_START,
  PITY_LEGENDARY_THRESHOLD,
  RATES,
  SR_PLUS,
  type Rarity,
} from "../src/config";
import { getTier, TIERS, percentile, applyDecay, tierProgress } from "../src/ranking";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cree un generateur sequentiel a partir d'un tableau de valeurs [0,1[. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

afterEach(() => {
  resetRng();
});

// ─── Distribution de base ─────────────────────────────────────────────────────

describe("rollRarity — distribution de base (sans pity)", () => {
  const N = 100_000;

  it("la somme des poids de RATES est exactement 100", () => {
    const sum =
      RATES.MISS + RATES.COMMON + RATES.RARE + RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET;
    expect(sum).toBe(100);
  });

  it("produit uniquement des valeurs valides", () => {
    const valid = new Set(["MISS", "COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"]);
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(0, 0);
      expect(valid.has(r)).toBe(true);
    }
  });

  it("distribution empirique proche des taux de base (tolerance 15 %)", () => {
    const counts: Record<string, number> = {
      MISS: 0,
      COMMON: 0,
      RARE: 0,
      SUPER_RARE: 0,
      LEGENDARY: 0,
      SECRET: 0,
    };
    for (let i = 0; i < N; i++) {
      counts[rollRarity(0, 0)]!++;
    }
    // Tolerance : 15 % de l'esperance (loi des grands nombres).
    const tol = 0.15;
    for (const [key, expected] of Object.entries(RATES)) {
      const actual = ((counts[key] ?? 0) / N) * 100;
      const lo = expected * (1 - tol);
      const hi = expected * (1 + tol) + 0.5; // +0.5 pour les taux tres bas (SECRET=1)
      expect(actual).toBeGreaterThanOrEqual(lo);
      expect(actual).toBeLessThanOrEqual(hi);
    }
  });
});

// ─── Soft-pity SR+ ────────────────────────────────────────────────────────────

describe("computeEffectiveRates — soft-pity SR+", () => {
  it("avant PITY_SR_SOFT_START, le taux SR+ est le taux de base", () => {
    const base = (RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET) / 100;
    for (let p = 0; p < PITY_SR_SOFT_START; p++) {
      const { srPlus } = computeEffectiveRates(p, 0);
      expect(srPlus).toBeCloseTo(base, 5);
    }
  });

  it("le taux SR+ monte progressivement a partir de PITY_SR_SOFT_START", () => {
    const base = (RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET) / 100;
    const prev = computeEffectiveRates(PITY_SR_SOFT_START - 1, 0).srPlus;
    for (let p = PITY_SR_SOFT_START; p < PITY_THRESHOLD; p++) {
      const { srPlus } = computeEffectiveRates(p, 0);
      expect(srPlus).toBeGreaterThan(base);
      expect(srPlus).toBeGreaterThanOrEqual(prev);
    }
  });

  it("au rang PITY_THRESHOLD - 1 le taux SR+ atteint 100 %", () => {
    const { srPlus } = computeEffectiveRates(PITY_THRESHOLD - 1, 0);
    expect(srPlus).toBeCloseTo(1.0, 5);
  });
});

// ─── Soft-pity LEGENDARY ──────────────────────────────────────────────────────

describe("computeEffectiveRates — soft-pity LEGENDARY", () => {
  it("avant PITY_LEGENDARY_SOFT_START, le taux leg est le taux de base", () => {
    const baseSrPlus = (RATES.SUPER_RARE + RATES.LEGENDARY + RATES.SECRET) / 100;
    const baseLeg = (RATES.LEGENDARY + RATES.SECRET) / 100;
    const baseShare = baseLeg / baseSrPlus; // part LEGENDARY dans les SR+
    const { legendary, srPlus } = computeEffectiveRates(0, PITY_LEGENDARY_SOFT_START - 1);
    // legendary / srPlus doit etre proche de baseShare (proportion preservee)
    expect(legendary / srPlus).toBeCloseTo(baseShare, 2);
  });

  it("la part de LEGENDARY dans SR+ monte apres PITY_LEGENDARY_SOFT_START", () => {
    const { legendary: legBase, srPlus: srBase } = computeEffectiveRates(
      0,
      PITY_LEGENDARY_SOFT_START - 1,
    );
    const { legendary: legBoosted, srPlus: srBoosted } = computeEffectiveRates(
      0,
      PITY_LEGENDARY_SOFT_START + 5,
    );
    expect(legBoosted / srBoosted).toBeGreaterThan(legBase / srBase);
  });

  it("au rang PITY_LEGENDARY_THRESHOLD - 1, LEGENDARY + SECRET representent ~100 % des SR+", () => {
    const { legendary, srPlus } = computeEffectiveRates(0, PITY_LEGENDARY_THRESHOLD - 1);
    // La part legendary/srPlus doit etre tres proche de 1.0 (tout le SR+ est legendary).
    expect(legendary / srPlus).toBeCloseTo(1.0, 2);
  });
});

// ─── Hard-pity SR+ ────────────────────────────────────────────────────────────

describe("rollRarity — hard-pity SR+ garanti", () => {
  it("au rang PITY_THRESHOLD - 1, rollRarity retourne toujours SR+", () => {
    // Le soft-pity atteint 100 % au rang PITY_THRESHOLD - 1.
    const srPlusSet = new Set<string>(SR_PLUS as string[]);
    for (let trial = 0; trial < 500; trial++) {
      const r = rollRarity(PITY_THRESHOLD - 1, 0);
      // MISS n'est pas SR+, donc on ne doit jamais avoir MISS ici.
      expect(r).not.toBe("MISS");
      expect(srPlusSet.has(r)).toBe(true);
    }
  });
});

// ─── Hard-pity LEGENDARY ─────────────────────────────────────────────────────

describe("rollRarity — hard-pity LEGENDARY garanti", () => {
  it("au rang PITY_LEGENDARY_THRESHOLD, retourne LEGENDARY", () => {
    // Le hard-pity legendary est force a PITY_LEGENDARY_THRESHOLD.
    const result = rollRarity(0, PITY_LEGENDARY_THRESHOLD);
    expect(result).toBe("LEGENDARY");
  });
});

// ─── RNG injectable ───────────────────────────────────────────────────────────

describe("rollRarity — RNG injectable / determinisme", () => {
  it("meme seed => meme sequence", () => {
    const rng = seqRng([0.01, 0.5, 0.3]); // valeurs basses = MISS/COMMON/etc
    const r1 = rollRarity(0, 0, rng);
    const rng2 = seqRng([0.01, 0.5, 0.3]);
    const r2 = rollRarity(0, 0, rng2);
    expect(r1).toBe(r2);
  });

  it("setRng / resetRng changent le generateur global", () => {
    // Avec pity=PITY_THRESHOLD-1 le taux SR+ atteint 100 %.
    // Roll quelconque => toujours SR+.
    setRng(seqRng([0.5]));
    const r = rollRarity(PITY_THRESHOLD - 1, 0);
    const srPlusSet = new Set<string>(SR_PLUS as string[]);
    expect(srPlusSet.has(r)).toBe(true);
    resetRng();
  });
});

// ─── Monotonie du soft-pity ───────────────────────────────────────────────────

describe("computeEffectiveRates — monotonie", () => {
  it("srPlus est non-decroissant quand pityCount augmente", () => {
    let prev = 0;
    for (let p = 0; p < PITY_THRESHOLD; p++) {
      const { srPlus } = computeEffectiveRates(p, 0);
      expect(srPlus).toBeGreaterThanOrEqual(prev);
      prev = srPlus;
    }
  });

  it("legendary est non-decroissant quand pityLegendaryCount augmente", () => {
    let prev = 0;
    for (let p = 0; p < PITY_LEGENDARY_THRESHOLD; p++) {
      const { legendary } = computeEffectiveRates(0, p);
      expect(legendary).toBeGreaterThanOrEqual(prev);
      prev = legendary;
    }
  });
});

// ─── Tiers ranking ────────────────────────────────────────────────────────────

describe("getTier", () => {
  it("rating 0 => Bronze", () => {
    expect(getTier(0).name).toBe("Bronze");
  });

  it("rating 1000 (ELO de depart) => Bronze", () => {
    expect(getTier(1000).name).toBe("Bronze");
  });

  it("seuils de transition corrects", () => {
    expect(getTier(1099).name).toBe("Bronze");
    expect(getTier(1100).name).toBe("Argent");
    expect(getTier(1249).name).toBe("Argent");
    expect(getTier(1250).name).toBe("Or");
    expect(getTier(1399).name).toBe("Or");
    expect(getTier(1400).name).toBe("Platine");
    expect(getTier(1599).name).toBe("Platine");
    expect(getTier(1600).name).toBe("Diamant");
    expect(getTier(1799).name).toBe("Diamant");
    expect(getTier(1800).name).toBe("Maitre");
    expect(getTier(9999).name).toBe("Maitre");
  });

  it("TIERS couvre [0, +inf[ sans chevauchement", () => {
    // Chaque tier suivant commence exactement apres la fin du precedent.
    for (let i = 0; i < TIERS.length - 1; i++) {
      expect(TIERS[i + 1]!.minRating).toBe(TIERS[i]!.maxRating + 1);
    }
    // Le dernier tier va a l'infini.
    expect(TIERS[TIERS.length - 1]!.maxRating).toBe(Infinity);
  });

  it("rating negatif => Bronze (clamp a 0)", () => {
    expect(getTier(-100).name).toBe("Bronze");
  });
});

// ─── Percentile ───────────────────────────────────────────────────────────────

describe("percentile", () => {
  it("rank=1 sur total=100 => 100", () => {
    expect(percentile(1, 100)).toBe(100);
  });

  it("rank=100 sur total=100 => 0", () => {
    expect(percentile(100, 100)).toBe(0);
  });

  it("rank=50 sur total=100 => ~49 (arrondi)", () => {
    const p = percentile(50, 100);
    expect(p).toBeGreaterThanOrEqual(48);
    expect(p).toBeLessThanOrEqual(51);
  });

  it("total <= 1 => 100", () => {
    expect(percentile(1, 1)).toBe(100);
    expect(percentile(1, 0)).toBe(100);
  });
});

// ─── Decay ────────────────────────────────────────────────────────────────────

describe("applyDecay", () => {
  it("moins de decayPeriodDays => pas de decay", () => {
    expect(applyDecay(1600, 29)).toBe(1600);
  });

  it("exactement decayPeriodDays => perte de 5 % (1 periode)", () => {
    const result = applyDecay(1600, 30);
    expect(result).toBe(1600 - Math.floor(1600 * 0.05));
  });

  it("ne descend jamais en dessous de baseRating (1000)", () => {
    expect(applyDecay(1050, 365)).toBeGreaterThanOrEqual(1000);
  });

  it("perte plafonnee a maxDecay", () => {
    const result = applyDecay(10000, 3650);
    const expected = Math.max(1000, 10000 - 200);
    expect(result).toBe(expected);
  });
});

// ─── tierProgress ─────────────────────────────────────────────────────────────

describe("tierProgress", () => {
  it("en bas du tier => 0 %", () => {
    expect(tierProgress(1100)).toBe(0); // debut Argent
  });

  it("en haut du tier => 99 % (pas 100 car 100 = tier suivant)", () => {
    // 1249 = fin de Argent (maxRating = 1249) => progress = (149/150)*100 = 99
    const p = tierProgress(1249);
    expect(p).toBeGreaterThanOrEqual(99);
  });

  it("tier Maitre (infini) => toujours 100", () => {
    expect(tierProgress(1800)).toBe(100);
    expect(tierProgress(9999)).toBe(100);
  });
});
