/**
 * Fixture-driven tests for ChallongeApi.toCanonical and synthesizeLogFromMatches.
 *
 * Uses bts4_full.json — a real BTS4 API response with participants + matches
 * embedded — captured offline. No network calls.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { ChallongeApi, synthesizeLogFromMatches, type ChallongeApiTournament } from "../src/api";
import { gravatarUrl } from "../src/types";
import type { ScrapedTournament } from "../src/types";

// ─── Fixture loading ──────────────────────────────────────────────────────────

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

let tournament: ChallongeApiTournament;
let canonical: ScrapedTournament;
let api: ChallongeApi;

beforeAll(async () => {
  const full = (await Bun.file(FIXTURES + "bts4_full.json").json()) as {
    tournament: ChallongeApiTournament;
  };
  tournament = full.tournament;
  api = new ChallongeApi({ apiKey: "fixture-key" });
  canonical = api.toCanonical(tournament, { synthesizeLog: true });
});

// ─── Shape / counts ───────────────────────────────────────────────────────────

describe("toCanonical — counts", () => {
  test("81 participants", () => {
    expect(canonical.participants).toHaveLength(81);
  });

  test("161 matches", () => {
    expect(canonical.matches).toHaveLength(161);
  });

  test("at least 100 complete matches", () => {
    const complete = canonical.matches.filter((m) => m.state === "complete");
    expect(complete.length).toBeGreaterThanOrEqual(100);
  });

  test("standings array present (may be empty from API path)", () => {
    expect(Array.isArray(canonical.standings)).toBe(true);
  });

  test("stations array present (may be empty from API path)", () => {
    expect(Array.isArray(canonical.stations)).toBe(true);
  });
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe("toCanonical — metadata", () => {
  test("metadata.game === 'Beyblade X'", () => {
    expect(canonical.metadata.game).toBe("Beyblade X");
  });

  test("metadata.id === 17779621", () => {
    expect(canonical.metadata.id).toBe(17779621);
  });

  test("metadata.name matches tournament name", () => {
    expect(canonical.metadata.name).toBe("Bey-Tamashii Séries #4");
  });

  test("metadata.type is double elimination", () => {
    expect(canonical.metadata.type).toBe("double elimination");
  });

  test("metadata.state is underway", () => {
    expect(canonical.metadata.state).toBe("underway");
  });

  test("metadata.participantsCount === 81", () => {
    expect(canonical.metadata.participantsCount).toBe(81);
  });

  test("metadata.completedAt is null (tournament still underway)", () => {
    expect(canonical.metadata.completedAt).toBeNull();
  });

  test("metadata.startedAt is a non-null ISO string", () => {
    expect(canonical.metadata.startedAt).not.toBeNull();
    expect(typeof canonical.metadata.startedAt).toBe("string");
    expect(() => new Date(canonical.metadata.startedAt!)).not.toThrow();
  });
});

// ─── bracketSide distribution ─────────────────────────────────────────────────

describe("toCanonical — bracketSide distribution", () => {
  test("WB matches > 70", () => {
    const wb = canonical.matches.filter((m) => m.bracketSide === "WB").length;
    expect(wb).toBeGreaterThan(70);
  });

  test("LB matches > 70", () => {
    const lb = canonical.matches.filter((m) => m.bracketSide === "LB").length;
    expect(lb).toBeGreaterThan(70);
  });

  test("GF matches >= 1", () => {
    const gf = canonical.matches.filter((m) => m.bracketSide === "GF").length;
    expect(gf).toBeGreaterThanOrEqual(1);
  });

  test("WB + LB + GF === total matches", () => {
    const wb = canonical.matches.filter((m) => m.bracketSide === "WB").length;
    const lb = canonical.matches.filter((m) => m.bracketSide === "LB").length;
    const gf = canonical.matches.filter((m) => m.bracketSide === "GF").length;
    expect(wb + lb + gf).toBe(canonical.matches.length);
  });

  test("no matches have null bracketSide in a double elim tournament", () => {
    const nullSided = canonical.matches.filter((m) => m.bracketSide == null);
    expect(nullSided).toHaveLength(0);
  });
});

// ─── synthesizeLog ────────────────────────────────────────────────────────────

describe("toCanonical — synthesizeLog", () => {
  test("log array is non-empty when synthesizeLog: true", () => {
    expect(canonical.log.length).toBeGreaterThan(0);
  });

  test("log is sorted oldest to newest", () => {
    const ts = canonical.log.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]!).toBeGreaterThanOrEqual(ts[i - 1]!);
    }
  });

  test("every log entry has a timestamp and message", () => {
    for (const entry of canonical.log) {
      expect(typeof entry.timestamp).toBe("string");
      expect(typeof entry.message).toBe("string");
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });

  test("log entries have type 'match_started' or 'match_completed'", () => {
    const validTypes = new Set(["match_started", "match_completed"]);
    for (const entry of canonical.log) {
      expect(validTypes.has(entry.type)).toBe(true);
    }
  });

  test("synthesizeLog: false returns empty log", () => {
    const noLog = api.toCanonical(tournament, { synthesizeLog: false });
    expect(noLog.log).toHaveLength(0);
  });

  test("synthesizeLog default (no opts) returns empty log", () => {
    const noLog = api.toCanonical(tournament);
    expect(noLog.log).toHaveLength(0);
  });
});

// ─── Portrait URL extraction (typo fix) ───────────────────────────────────────

describe("toCanonical — portrait URL extraction", () => {
  test("at least 70 participants have a non-null portraitUrl", () => {
    const withPortrait = canonical.participants.filter((p) => p.portraitUrl != null);
    expect(withPortrait.length).toBeGreaterThanOrEqual(70);
  });

  test("portraitUrl values are non-empty strings", () => {
    const withPortrait = canonical.participants.filter((p) => p.portraitUrl != null);
    for (const p of withPortrait) {
      expect(typeof p.portraitUrl).toBe("string");
      expect((p.portraitUrl as string).length).toBeGreaterThan(0);
    }
  });
});

// ─── gravatarUrl helper ───────────────────────────────────────────────────────

describe("gravatarUrl helper", () => {
  test("returns a gravatar.com URL when emailHash is present", () => {
    const p = canonical.participants.find((p) => p.emailHash);
    expect(p).not.toBeUndefined();
    const url = gravatarUrl(p!.emailHash);
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\/gravatar\.com\/avatar\//);
  });

  test("includes the emailHash in the URL", () => {
    const p = canonical.participants.find((p) => p.emailHash);
    const url = gravatarUrl(p!.emailHash);
    expect(url).toContain(p!.emailHash!);
  });

  test("returns null when emailHash is null", () => {
    expect(gravatarUrl(null)).toBeNull();
  });

  test("returns null when emailHash is undefined", () => {
    expect(gravatarUrl(undefined)).toBeNull();
  });

  test("default size parameter is 200", () => {
    const p = canonical.participants.find((p) => p.emailHash);
    const url = gravatarUrl(p!.emailHash);
    expect(url).toContain("s=200");
  });

  test("custom size is reflected in URL", () => {
    const p = canonical.participants.find((p) => p.emailHash);
    const url = gravatarUrl(p!.emailHash, 64);
    expect(url).toContain("s=64");
  });
});

// ─── raw passthrough ─────────────────────────────────────────────────────────

describe("toCanonical — raw field", () => {
  test("raw field is the original tournament object", () => {
    expect(canonical.raw).toBe(tournament);
  });
});
