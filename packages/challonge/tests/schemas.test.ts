import { describe, expect, test } from "bun:test";

import {
  ChallongeBracketSideSchema,
  ChallongeLogEntrySchema,
  ChallongeMatchSchema,
  ChallongeParticipantSchema,
  ChallongeStandingSchema,
  ChallongeStationSchema,
  ChallongeTournamentMetadataSchema,
  ChallongeTournamentSchema,
} from "../src/schemas";

// Validation runtime des schémas Zod — fixtures synthétiques, ZÉRO réseau.
// Couvre : (1) parse réussi sur l'instance minimale valide,
//          (2) parse réussi avec tous les champs optionnels remplis,
//          (3) safeParse().success === false sur instance invalide.

// ─── Participant ─────────────────────────────────────────────────────────────

describe("ChallongeParticipantSchema", () => {
  test("parse un participant minimal valide", () => {
    const parsed = ChallongeParticipantSchema.parse({
      id: 1,
      name: "Blader A",
      seed: 1,
    });
    expect(parsed.name).toBe("Blader A");
    expect(parsed.challongeUsername).toBeUndefined();
  });

  test("parse un participant complet (champs optionnels/nullables)", () => {
    const parsed = ChallongeParticipantSchema.parse({
      id: 42,
      name: "Blader B",
      seed: 2,
      ordinalSeed: 3,
      challongeUsername: "bladerb",
      challongeProfileUrl: null,
      challongeUserId: 9001,
      emailHash: "abc123",
      portraitUrl: null,
      finalRank: 4,
      clinched: true,
      metadata: { discordId: "123", extra: 1 },
    });
    expect(parsed.metadata).toEqual({ discordId: "123", extra: 1 });
    expect(parsed.clinched).toBe(true);
  });

  test("rejette un participant sans id requis", () => {
    const res = ChallongeParticipantSchema.safeParse({ name: "X", seed: 1 });
    expect(res.success).toBe(false);
  });

  test("rejette un seed non numérique", () => {
    const res = ChallongeParticipantSchema.safeParse({
      id: 1,
      name: "X",
      seed: "first",
    });
    expect(res.success).toBe(false);
  });
});

// ─── Match ───────────────────────────────────────────────────────────────────

describe("ChallongeMatchSchema", () => {
  test("parse un match minimal valide", () => {
    const parsed = ChallongeMatchSchema.parse({
      id: 100,
      identifier: "A",
      round: 1,
      player1Id: 1,
      player2Id: 2,
      winnerId: 1,
      loserId: 2,
      scores: "3-1",
      sets: [
        [3, 1],
        [2, 0],
      ],
      state: "complete",
    });
    expect(parsed.sets).toHaveLength(2);
    expect(parsed.bracketSide).toBeUndefined();
  });

  test("parse un match double-élim complet (bracketSide + coords SVG)", () => {
    const parsed = ChallongeMatchSchema.parse({
      id: 101,
      identifier: "GF",
      round: 0,
      bracketSide: "GF",
      player1Id: null,
      player2Id: null,
      winnerId: null,
      loserId: null,
      scores: "0-0",
      sets: [],
      state: "pending",
      forfeited: null,
      optional: true,
      startedAt: "2026-05-29T10:00:00Z",
      completedAt: null,
      attachmentCount: 0,
      hasAttachment: false,
      suggestedPlayOrder: 7,
      groupId: null,
      x: 120.5,
      y: 64,
    });
    expect(parsed.bracketSide).toBe("GF");
    expect(parsed.x).toBe(120.5);
  });

  test("rejette des sets mal formés (pas une paire)", () => {
    const res = ChallongeMatchSchema.safeParse({
      id: 1,
      identifier: "A",
      round: 1,
      player1Id: 1,
      player2Id: 2,
      winnerId: 1,
      loserId: 2,
      scores: "3-1",
      sets: [[3]],
      state: "complete",
    });
    expect(res.success).toBe(false);
  });

  test("rejette un bracketSide hors enum", () => {
    const res = ChallongeMatchSchema.safeParse({
      id: 1,
      identifier: "A",
      round: 1,
      bracketSide: "XB",
      player1Id: null,
      player2Id: null,
      winnerId: null,
      loserId: null,
      scores: "0-0",
      sets: [],
      state: "pending",
    });
    expect(res.success).toBe(false);
  });
});

// ─── Standing ────────────────────────────────────────────────────────────────

describe("ChallongeStandingSchema", () => {
  test("parse un standing valide (stats libre)", () => {
    const parsed = ChallongeStandingSchema.parse({
      rank: 1,
      name: "Blader A",
      wins: 5,
      losses: 0,
      stats: { points: 15, diff: 8 },
    });
    expect(parsed.rank).toBe(1);
    expect(parsed.stats).toEqual({ points: 15, diff: 8 });
  });

  test("rejette des wins non numériques", () => {
    const res = ChallongeStandingSchema.safeParse({
      rank: 1,
      name: "A",
      wins: "five",
      losses: 0,
      stats: null,
    });
    expect(res.success).toBe(false);
  });
});

// ─── Station ─────────────────────────────────────────────────────────────────

describe("ChallongeStationSchema", () => {
  test("parse une station idle (stationId number ou string)", () => {
    const parsed = ChallongeStationSchema.parse({
      stationId: 3,
      name: "Table 3",
      status: "idle",
    });
    expect(parsed.status).toBe("idle");

    const parsedStr = ChallongeStationSchema.parse({
      stationId: "table-3",
      name: "Table 3",
      currentMatch: null,
      status: "active",
    });
    expect(parsedStr.stationId).toBe("table-3");
  });

  test("rejette un status hors enum", () => {
    const res = ChallongeStationSchema.safeParse({
      stationId: 1,
      name: "T1",
      status: "running",
    });
    expect(res.success).toBe(false);
  });
});

// ─── Log entry ───────────────────────────────────────────────────────────────

describe("ChallongeLogEntrySchema", () => {
  test("parse une entrée de log minimale (raw optionnel)", () => {
    const parsed = ChallongeLogEntrySchema.parse({
      timestamp: "2026-05-29T10:00:00Z",
      type: "match_completed",
      message: "Match A terminé",
    });
    expect(parsed.raw).toBeUndefined();
    expect(parsed.matchId).toBeUndefined();
  });

  test("rejette une entrée sans message requis", () => {
    const res = ChallongeLogEntrySchema.safeParse({
      timestamp: "2026-05-29T10:00:00Z",
      type: "info",
    });
    expect(res.success).toBe(false);
  });
});

// ─── Tournament metadata ─────────────────────────────────────────────────────

describe("ChallongeTournamentMetadataSchema", () => {
  test("parse des métadonnées valides (dates ISO en string)", () => {
    const parsed = ChallongeTournamentMetadataSchema.parse({
      id: 5,
      name: "RPB Cup",
      url: "rpb-cup",
      state: "complete",
      type: "double elimination",
      participantsCount: 16,
      startedAt: "2026-05-01T09:00:00Z",
      completedAt: "2026-05-01T18:00:00Z",
      game: "Beyblade X",
      subdomain: null,
    });
    expect(parsed.participantsCount).toBe(16);
    expect(typeof parsed.startedAt).toBe("string");
  });

  test("rejette participantsCount manquant", () => {
    const res = ChallongeTournamentMetadataSchema.safeParse({
      id: 5,
      name: "RPB Cup",
      url: "rpb-cup",
      state: "complete",
      type: "single elimination",
      startedAt: null,
      completedAt: null,
    });
    expect(res.success).toBe(false);
  });
});

// ─── Tournament (composite) ──────────────────────────────────────────────────

describe("ChallongeTournamentSchema", () => {
  test("parse un tournoi composite minimal valide", () => {
    const parsed = ChallongeTournamentSchema.parse({
      metadata: {
        id: 7,
        name: "RPB Open",
        url: "rpb-open",
        state: "underway",
        type: "round robin",
        participantsCount: 2,
        startedAt: "2026-05-29T08:00:00Z",
        completedAt: null,
      },
      participants: [
        { id: 1, name: "A", seed: 1 },
        { id: 2, name: "B", seed: 2 },
      ],
      matches: [
        {
          id: 100,
          identifier: "A",
          round: 1,
          player1Id: 1,
          player2Id: 2,
          winnerId: null,
          loserId: null,
          scores: "0-0",
          sets: [],
          state: "open",
        },
      ],
      standings: [{ rank: 1, name: "A", wins: 0, losses: 0, stats: {} }],
      stations: [{ stationId: 1, name: "T1", status: "active" }],
      log: [
        {
          timestamp: "2026-05-29T08:01:00Z",
          type: "open",
          message: "Tournoi ouvert",
        },
      ],
      raw: { source: "challonge.json" },
    });
    expect(parsed.participants).toHaveLength(2);
    expect(parsed.matches[0]?.identifier).toBe("A");
    expect(parsed.standings).toHaveLength(1);
  });

  test("rejette un tournoi dont un participant imbriqué est invalide", () => {
    const res = ChallongeTournamentSchema.safeParse({
      metadata: {
        id: 7,
        name: "RPB Open",
        url: "rpb-open",
        state: "underway",
        type: "round robin",
        participantsCount: 1,
        startedAt: null,
        completedAt: null,
      },
      participants: [{ id: "not-a-number", name: "A", seed: 1 }],
      matches: [],
      standings: [],
      stations: [],
      log: [],
      raw: null,
    });
    expect(res.success).toBe(false);
  });

  test("rejette un tournoi sans metadata", () => {
    const res = ChallongeTournamentSchema.safeParse({
      participants: [],
      matches: [],
      standings: [],
      stations: [],
      log: [],
      raw: null,
    });
    expect(res.success).toBe(false);
  });
});

// ─── BracketSide ─────────────────────────────────────────────────────────────

describe("ChallongeBracketSideSchema", () => {
  test("accepte les valeurs d'enum et null", () => {
    expect(ChallongeBracketSideSchema.parse("WB")).toBe("WB");
    expect(ChallongeBracketSideSchema.parse("LB")).toBe("LB");
    expect(ChallongeBracketSideSchema.parse(null)).toBeNull();
  });

  test("rejette une valeur hors enum", () => {
    expect(ChallongeBracketSideSchema.safeParse("ZZ").success).toBe(false);
  });
});
