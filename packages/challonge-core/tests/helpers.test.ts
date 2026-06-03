import { describe, expect, test } from "bun:test";

import { helpers } from "../src/brackets-manager/index";
import { Status } from "../src/brackets-model/index";

// Helpers PURS du moteur de brackets (logique combinatoire double-élim / round-robin).
// Aucune dépendance système, aucun storage, aucun réseau — pure arithmétique de seeds.

describe("isPowerOfTwo / getNearestPowerOfTwo", () => {
  test("isPowerOfTwo détecte les puissances de deux", () => {
    expect(helpers.isPowerOfTwo(1)).toBe(true);
    expect(helpers.isPowerOfTwo(2)).toBe(true);
    expect(helpers.isPowerOfTwo(8)).toBe(true);
    expect(helpers.isPowerOfTwo(6)).toBe(false);
    expect(helpers.isPowerOfTwo(0)).toBe(false);
  });

  test("getNearestPowerOfTwo arrondit à la puissance >= ", () => {
    expect(helpers.getNearestPowerOfTwo(5)).toBe(8);
    expect(helpers.getNearestPowerOfTwo(8)).toBe(8);
    expect(helpers.getNearestPowerOfTwo(9)).toBe(16);
  });
});

describe("splitBy / splitByParity", () => {
  test("splitBy regroupe par clé en préservant l'ordre d'apparition", () => {
    const out = helpers.splitBy(
      [
        { g: "a", v: 1 },
        { g: "b", v: 2 },
        { g: "a", v: 3 },
      ],
      "g",
    );
    expect(out).toEqual([
      [
        { g: "a", v: 1 },
        { g: "a", v: 3 },
      ],
      [{ g: "b", v: 2 }],
    ]);
  });

  test("splitByParity sépare indices pairs/impairs", () => {
    const { even, odd } = helpers.splitByParity([10, 11, 12, 13]);
    expect(even).toEqual([10, 12]);
    expect(odd).toEqual([11, 13]);
  });
});

describe("makePairs / setArraySize / makeGroups", () => {
  test("makePairs apparie deux à deux", () => {
    expect(helpers.makePairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("makePairs sur taille impaire apparie le dernier avec undefined (pas de throw)", () => {
    expect(helpers.makePairs([1, 2, 3])).toEqual([
      [1, 2],
      [3, undefined as unknown as number],
    ]);
  });

  test("ensureEvenSized lève sur taille impaire, passe sur taille paire", () => {
    expect(() => helpers.ensureEvenSized([1, 2, 3])).toThrow();
    expect(() => helpers.ensureEvenSized([1, 2])).not.toThrow();
  });

  test("setArraySize complète avec le placeholder", () => {
    expect(helpers.setArraySize([1, 2], 4, 0)).toEqual([1, 2, 0, 0]);
  });

  test("makeGroups répartit en N groupes", () => {
    const groups = helpers.makeGroups([1, 2, 3, 4], 2);
    expect(groups).toHaveLength(2);
    expect(groups.flat()).toEqual([1, 2, 3, 4]);
  });
});

describe("getNonNull / uniqueBy", () => {
  test("getNonNull retire null/undefined", () => {
    expect(helpers.getNonNull([1, null, 2, null, 3])).toEqual([1, 2, 3]);
  });

  test("uniqueBy déduplique par clé en gardant la 1re occurrence", () => {
    expect(helpers.uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (o) => o.id)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });
});

describe("seeding (balanceByes / fixSeeding)", () => {
  test("balanceByes complète jusqu'à la puissance de deux avec des BYE (null)", () => {
    expect(helpers.balanceByes([1, 2, 3])).toEqual([1, 2, 3, null]);
  });

  test("fixSeeding pad à la taille de stage demandée", () => {
    expect(helpers.fixSeeding([1, 2, 3], 4)).toEqual([1, 2, 3, null]);
  });

  test("fixSeeding lève si le seeding dépasse la taille", () => {
    expect(() => helpers.fixSeeding([1, 2, 3, 4, 5], 4)).toThrow();
  });
});

describe("sides / rounds", () => {
  test("getSide mappe par parité du numéro de match", () => {
    expect(helpers.getSide(1)).toBe("opponent1");
    expect(helpers.getSide(2)).toBe("opponent2");
  });

  test("getOtherSide inverse le côté", () => {
    expect(helpers.getOtherSide("opponent1")).toBe("opponent2");
    expect(helpers.getOtherSide("opponent2")).toBe("opponent1");
  });

  test("isMajorRound / isMinorRound sont complémentaires", () => {
    expect(helpers.isMajorRound(3)).toBe(true);
    expect(helpers.isMinorRound(3)).toBe(false);
    expect(helpers.isMajorRound(2)).toBe(false);
    expect(helpers.isMinorRound(2)).toBe(true);
  });
});

describe("bracket sizing", () => {
  test("getUpperBracketRoundCount(8) == 3", () => {
    expect(helpers.getUpperBracketRoundCount(8)).toBe(3);
  });

  test("isDoubleEliminationNecessary vrai dès 4 participants", () => {
    expect(helpers.isDoubleEliminationNecessary(4)).toBe(true);
    expect(helpers.isDoubleEliminationNecessary(2)).toBe(false);
  });

  test("getFractionOfFinal(1, 3) == 0.25", () => {
    expect(helpers.getFractionOfFinal(1, 3)).toBe(0.25);
  });

  test("getDiagonalMatchNumber(4) == 2", () => {
    expect(helpers.getDiagonalMatchNumber(4)).toBe(2);
  });

  test("minScoreToWinBestOfX(5) == 3", () => {
    expect(helpers.minScoreToWinBestOfX(5)).toBe(3);
    expect(helpers.minScoreToWinBestOfX(3)).toBe(2);
  });
});

describe("match status", () => {
  test("getMatchStatus(duel vide) == Locked", () => {
    expect(helpers.getMatchStatus({ opponent1: null, opponent2: null })).toBe(Status.Locked);
  });

  test("getMatchStatus(deux opposants présents) == Ready", () => {
    expect(helpers.getMatchStatus({ opponent1: { id: 1 }, opponent2: { id: 2 } })).toBe(
      Status.Ready,
    );
  });

  test("isMatchPending vrai quand un côté est vide", () => {
    expect(helpers.isMatchPending({ opponent1: null, opponent2: null })).toBe(true);
    expect(helpers.isMatchPending({ opponent1: { id: 1 }, opponent2: { id: 2 } })).toBe(false);
  });
});
