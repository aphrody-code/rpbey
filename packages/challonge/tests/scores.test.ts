/**
 * Fixture-driven + unit tests for src/scores.ts
 *
 * All tests are offline — no network calls.
 */

import { describe, test, expect } from "bun:test";
import {
  normalizeSets,
  setsToLegacyString,
  sumSetWinsForPlayer,
  sumSetWinsForPlayer1,
  isRealMatch,
  type SetScore,
} from "../src/scores";

// ─── normalizeSets ────────────────────────────────────────────────────────────

describe("normalizeSets", () => {
  test("converts 2-D array to SetScore[]", () => {
    expect(
      normalizeSets([
        [3, 1],
        [2, 3],
      ]),
    ).toEqual([
      [3, 1],
      [2, 3],
    ]);
  });

  test("returns empty array for non-array input", () => {
    expect(normalizeSets(null)).toEqual([]);
    expect(normalizeSets(undefined)).toEqual([]);
    expect(normalizeSets("3-1")).toEqual([]);
    expect(normalizeSets(42)).toEqual([]);
  });

  test("returns empty array for empty array input", () => {
    expect(normalizeSets([])).toEqual([]);
  });

  test("skips non-array entries inside the outer array", () => {
    expect(normalizeSets([[3, 1], "bad", null, [2, 3]])).toEqual([
      [3, 1],
      [2, 3],
    ]);
  });

  test("skips entries with non-finite numbers", () => {
    expect(
      normalizeSets([
        [NaN, 1],
        [2, Infinity],
      ]),
    ).toEqual([]);
  });

  test("truncates floats to integers", () => {
    expect(normalizeSets([[3.9, 1.1]])).toEqual([[3, 1]]);
  });

  test("accepts negative scores (forfeit convention)", () => {
    expect(normalizeSets([[-1, 0]])).toEqual([[-1, 0]]);
  });

  test("handles a single-set match", () => {
    expect(normalizeSets([[3, 0]])).toEqual([[3, 0]]);
  });
});

// ─── setsToLegacyString ───────────────────────────────────────────────────────

describe("setsToLegacyString", () => {
  test("round-trip: setsToLegacyString(normalizeSets([[3,1],[2,3]])) === '3-1,2-3'", () => {
    const result = setsToLegacyString(
      normalizeSets([
        [3, 1],
        [2, 3],
      ]),
    );
    expect(result).toBe("3-1,2-3");
  });

  test("empty sets array → '0-0'", () => {
    expect(setsToLegacyString([])).toBe("0-0");
  });

  test("single set", () => {
    expect(setsToLegacyString([[3, 0]])).toBe("3-0");
  });

  test("three sets best-of-five", () => {
    expect(
      setsToLegacyString([
        [3, 1],
        [1, 3],
        [3, 2],
      ]),
    ).toBe("3-1,1-3,3-2");
  });

  test("forfeit score", () => {
    expect(setsToLegacyString([[-1, 0]])).toBe("-1-0");
  });
});

// ─── isRealMatch ──────────────────────────────────────────────────────────────

describe("isRealMatch", () => {
  test("returns true when at least one set has non-zero score", () => {
    expect(isRealMatch([[3, 1]])).toBe(true);
    expect(
      isRealMatch([
        [0, 0],
        [3, 0],
      ]),
    ).toBe(true);
  });

  test("returns false for all-zero sets (walkover / not yet played)", () => {
    expect(isRealMatch([[0, 0]])).toBe(false);
    expect(
      isRealMatch([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(false);
  });

  test("returns false for empty sets array", () => {
    expect(isRealMatch([])).toBe(false);
  });

  test("returns false for forfeit scores (-1, 0) — negative scores are not > 0", () => {
    // -1 is neither > 0 (p1) nor > 0 (p2), so isRealMatch returns false
    expect(isRealMatch([[-1, 0]])).toBe(false);
  });
});

// ─── sumSetWinsForPlayer1 ─────────────────────────────────────────────────────

describe("sumSetWinsForPlayer1", () => {
  test("counts wins and losses from player1 perspective", () => {
    const sets: SetScore[] = [
      [3, 1],
      [1, 3],
      [3, 2],
    ];
    expect(sumSetWinsForPlayer1(sets)).toEqual({ wins: 2, losses: 1 });
  });

  test("2-0 sweep", () => {
    expect(
      sumSetWinsForPlayer1([
        [3, 0],
        [3, 1],
      ]),
    ).toEqual({ wins: 2, losses: 0 });
  });

  test("0-2 loss", () => {
    expect(
      sumSetWinsForPlayer1([
        [1, 3],
        [0, 3],
      ]),
    ).toEqual({ wins: 0, losses: 2 });
  });

  test("tied sets count neither win nor loss", () => {
    // Equal scores — no winner for the set
    expect(sumSetWinsForPlayer1([[2, 2]])).toEqual({ wins: 0, losses: 0 });
  });

  test("empty sets → { wins: 0, losses: 0 }", () => {
    expect(sumSetWinsForPlayer1([])).toEqual({ wins: 0, losses: 0 });
  });
});

// ─── sumSetWinsForPlayer ──────────────────────────────────────────────────────

describe("sumSetWinsForPlayer — perspective inversion", () => {
  const sets: SetScore[] = [
    [3, 1],
    [1, 3],
    [3, 2],
  ];
  const P1 = 100;
  const P2 = 200;

  test("targetId === player1Id gives player1 perspective", () => {
    expect(sumSetWinsForPlayer(sets, P1, P2, P1)).toEqual({ wins: 2, losses: 1 });
  });

  test("targetId === player2Id inverts the perspective", () => {
    // From P2's point of view: P2 won the second set only
    expect(sumSetWinsForPlayer(sets, P1, P2, P2)).toEqual({ wins: 1, losses: 2 });
  });

  test("unknown targetId returns { wins: 0, losses: 0 }", () => {
    expect(sumSetWinsForPlayer(sets, P1, P2, 999)).toEqual({ wins: 0, losses: 0 });
  });

  test("player1Id null, targetId matches player2Id", () => {
    // player1Id is null (e.g. TBD slot), target is P2
    expect(
      sumSetWinsForPlayer(
        [
          [1, 3],
          [0, 3],
        ],
        null,
        P2,
        P2,
      ),
    ).toEqual({ wins: 2, losses: 0 });
  });

  test("both player IDs null returns { wins: 0, losses: 0 }", () => {
    expect(sumSetWinsForPlayer(sets, null, null, 100)).toEqual({ wins: 0, losses: 0 });
  });
});

// ─── Combined round-trip ──────────────────────────────────────────────────────

describe("scores round-trip", () => {
  test("normalizeSets → setsToLegacyString is deterministic", () => {
    const raw = [
      [3, 1],
      [2, 3],
      [3, 0],
    ];
    const s1 = setsToLegacyString(normalizeSets(raw));
    const s2 = setsToLegacyString(normalizeSets(raw));
    expect(s1).toBe(s2);
    expect(s1).toBe("3-1,2-3,3-0");
  });

  test("single-set walkover round-trip", () => {
    expect(setsToLegacyString(normalizeSets([[0, 0]]))).toBe("0-0");
  });
});
