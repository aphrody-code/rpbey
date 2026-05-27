/**
 * Unit tests for bracketSideFromRound (src/types.ts).
 *
 * All tests are pure — no fixtures, no network calls.
 */

import { describe, test, expect } from "bun:test";
import { bracketSideFromRound } from "../src/types";

// ─── Winners Bracket ──────────────────────────────────────────────────────────

describe("bracketSideFromRound — Winners Bracket (WB)", () => {
  test("round 1, double elimination → WB", () => {
    expect(bracketSideFromRound(1, "double elimination")).toBe("WB");
  });

  test("round 3, double elimination → WB", () => {
    expect(bracketSideFromRound(3, "double elimination", false)).toBe("WB");
  });

  test("round 1, single elimination → WB (only WB exists)", () => {
    expect(bracketSideFromRound(1, "single elimination")).toBe("WB");
  });

  test("round 1, single_elimination (underscore variant) → WB", () => {
    expect(bracketSideFromRound(1, "single_elimination")).toBe("WB");
  });

  test("positive round NOT flagged as last round → WB in double elim", () => {
    expect(bracketSideFromRound(5, "double elimination", false)).toBe("WB");
  });

  test("single elim last round is still WB (no LB exists)", () => {
    expect(bracketSideFromRound(4, "single elimination", true)).toBe("WB");
  });
});

// ─── Losers Bracket ───────────────────────────────────────────────────────────

describe("bracketSideFromRound — Losers Bracket (LB)", () => {
  test("round -1 → LB", () => {
    expect(bracketSideFromRound(-1, "double elimination")).toBe("LB");
  });

  test("round -5 → LB", () => {
    expect(bracketSideFromRound(-5, "double elimination", false)).toBe("LB");
  });

  test("large negative round → LB", () => {
    expect(bracketSideFromRound(-99, "double elimination")).toBe("LB");
  });
});

// ─── Grand Final ──────────────────────────────────────────────────────────────

describe("bracketSideFromRound — Grand Final (GF)", () => {
  test("positive round with isLastRound = true → GF in double elim", () => {
    expect(bracketSideFromRound(8, "double elimination", true)).toBe("GF");
  });

  test("round 1 with isLastRound = true → GF (degenerate but valid per implementation)", () => {
    // The implementation only checks isLastRound, so any positive flagged is GF
    expect(bracketSideFromRound(1, "double elimination", true)).toBe("GF");
  });
});

// ─── Round Robin ──────────────────────────────────────────────────────────────

describe("bracketSideFromRound — Round Robin (RR)", () => {
  test("round_robin (underscore) → RR regardless of round number", () => {
    expect(bracketSideFromRound(1, "round_robin")).toBe("RR");
  });

  test("'Round Robin' (title case) → RR", () => {
    expect(bracketSideFromRound(3, "Round Robin")).toBe("RR");
  });

  test("'round robin' (lowercase) → RR", () => {
    expect(bracketSideFromRound(2, "round robin")).toBe("RR");
  });

  test("negative round in round_robin → RR (type check takes priority)", () => {
    expect(bracketSideFromRound(-1, "round_robin")).toBe("RR");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("bracketSideFromRound — edge cases", () => {
  test("round 0, double elimination → null", () => {
    expect(bracketSideFromRound(0, "double elimination")).toBeNull();
  });

  test("round 0, single elimination → WB (single-elim branch fires before sign check)", () => {
    // The implementation hits t.includes("single") before testing round sign,
    // so any round in a single-elim tournament returns "WB".
    expect(bracketSideFromRound(0, "single elimination")).toBe("WB");
  });

  test("empty tournament type string → null for round 0", () => {
    expect(bracketSideFromRound(0, "")).toBeNull();
  });

  test("positive round, unknown tournament type → WB (default branch)", () => {
    // Unknown type is neither round_robin nor single — falls to double-elim branch
    expect(bracketSideFromRound(2, "unknown_type", false)).toBe("WB");
  });

  test("negative round, unknown tournament type → LB", () => {
    expect(bracketSideFromRound(-2, "unknown_type")).toBe("LB");
  });
});

// ─── Distribution on real BTS4 data ──────────────────────────────────────────

describe("bracketSideFromRound — BTS4 fixture distribution", () => {
  const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

  test("WB + LB + GF accounts for all 161 BTS4 matches", async () => {
    const full = (await Bun.file(FIXTURES + "bts4_full.json").json()) as {
      tournament: { matches: Array<{ match: { round: number } }>; tournament_type: string };
    };
    const t = full.tournament;
    const matches = t.matches.map((x) => x.match);
    const maxRound = matches.reduce((acc, m) => (m.round > acc ? m.round : acc), 0);

    const counts = { WB: 0, LB: 0, GF: 0, RR: 0, null: 0 };
    for (const m of matches) {
      const side = bracketSideFromRound(m.round, t.tournament_type, m.round === maxRound);
      counts[side ?? "null"]++;
    }
    expect(counts.WB + counts.LB + counts.GF).toBe(161);
    expect(counts.WB).toBeGreaterThan(70);
    expect(counts.LB).toBeGreaterThan(70);
    expect(counts.GF).toBeGreaterThanOrEqual(1);
  });
});
