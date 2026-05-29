import { z } from "zod";

import type {
  BracketSide,
  ScrapedLogEntry,
  ScrapedMatch,
  ScrapedParticipant,
  ScrapedStanding,
  ScrapedStation,
  ScrapedTournament,
  ScrapedTournamentMetadata,
} from "./types";

// Schémas Zod réutilisables pour les données Challonge scrapées (consommés côté
// apps/web DAL/SDK comme validateurs runtime).
//
// Règle de cohérence : `types.ts` est la SOURCE DE FORME ; ces schémas sont le
// validateur runtime. L'inférence Zod (`z.infer<…>`) DOIT rester mutuellement
// assignable avec l'interface TS correspondante — verrouillé en bas de fichier
// par des assertions d'assignabilité bidirectionnelle (compile-time). Si l'une
// d'elles casse, AJUSTER le schéma pour coller à `types.ts`, jamais l'inverse.
//
// Conventions de mapping interface → Zod :
//   - `champ: T`            → z.<T>()              (clé requise)
//   - `champ?: T`           → z.<T>().optional()   (clé optionnelle, T | undefined)
//   - `champ?: T | null`    → z.<T>().nullish()    (clé optionnelle, T | null | undefined)
//   - `champ: any`          → z.any()              (absorbe l'optionalité, OK)
//   - dates ISO 8601        → z.string()           (jamais z.date() — tout est string ici)
//
// ZÉRO import bxc : ce module doit rester bundlable (apps/web).

// ─── BracketSide ─────────────────────────────────────────────────────────────

/** Côté de bracket (double-élim). Reflète `BracketSide = "WB" | "LB" | "GF" | "RR" | null`. */
export const ChallongeBracketSideSchema = z.enum(["WB", "LB", "GF", "RR"]).nullable();

// ─── Participant ─────────────────────────────────────────────────────────────

/** Validateur runtime de `ScrapedParticipant`. */
export const ChallongeParticipantSchema = z.object({
  id: z.number(),
  name: z.string(),
  seed: z.number(),
  ordinalSeed: z.number().optional(),
  challongeUsername: z.string().nullish(),
  challongeProfileUrl: z.string().nullish(),
  challongeUserId: z.number().nullish(),
  emailHash: z.string().nullish(),
  portraitUrl: z.string().nullish(),
  finalRank: z.number().nullish(),
  clinched: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type ChallongeParticipant = z.infer<typeof ChallongeParticipantSchema>;

// ─── Match ───────────────────────────────────────────────────────────────────

/** Validateur runtime de `ScrapedMatch` (inclut les coords SVG optionnelles x/y). */
export const ChallongeMatchSchema = z.object({
  id: z.number(),
  identifier: z.string(),
  round: z.number(),
  bracketSide: ChallongeBracketSideSchema.optional(),
  player1Id: z.number().nullable(),
  player2Id: z.number().nullable(),
  winnerId: z.number().nullable(),
  loserId: z.number().nullable(),
  scores: z.string(),
  sets: z.array(z.tuple([z.number(), z.number()])),
  state: z.string(),
  forfeited: z.boolean().nullish(),
  optional: z.boolean().nullish(),
  startedAt: z.string().nullish(),
  underwayAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  attachmentCount: z.number().nullish(),
  hasAttachment: z.boolean().nullish(),
  suggestedPlayOrder: z.number().nullish(),
  groupId: z.number().nullish(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type ChallongeMatch = z.infer<typeof ChallongeMatchSchema>;

// ─── Standing ────────────────────────────────────────────────────────────────

/** Validateur runtime de `ScrapedStanding`. `stats` est libre (z.any). */
export const ChallongeStandingSchema = z.object({
  rank: z.number(),
  name: z.string(),
  challongeUsername: z.string().nullish(),
  challongeProfileUrl: z.string().nullish(),
  wins: z.number(),
  losses: z.number(),
  stats: z.any(),
});
export type ChallongeStanding = z.infer<typeof ChallongeStandingSchema>;

// ─── Station ─────────────────────────────────────────────────────────────────

/** Match courant affiché sur une station (sous-objet de `ScrapedStation`). */
const ChallongeStationCurrentMatchSchema = z.object({
  matchId: z.number(),
  identifier: z.string(),
  round: z.number(),
  player1: z.string().nullable(),
  player2: z.string().nullable(),
  scores: z.string(),
  sets: z.array(z.array(z.number())).optional(),
  state: z.string(),
});

/** Validateur runtime de `ScrapedStation`. */
export const ChallongeStationSchema = z.object({
  stationId: z.union([z.number(), z.string()]),
  name: z.string(),
  currentMatch: ChallongeStationCurrentMatchSchema.nullish(),
  status: z.enum(["idle", "active", "paused"]),
});
export type ChallongeStation = z.infer<typeof ChallongeStationSchema>;

// ─── Log entry ───────────────────────────────────────────────────────────────

/** Validateur runtime de `ScrapedLogEntry`. */
export const ChallongeLogEntrySchema = z.object({
  timestamp: z.string(),
  type: z.string(),
  message: z.string(),
  matchId: z.number().optional(),
  matchIdentifier: z.string().optional(),
  who: z.string().optional(),
  // `raw?: any` est OPTIONNEL dans ScrapedLogEntry (contrairement à
  // ScrapedStanding.stats / ScrapedTournament.raw qui sont requis).
  raw: z.any().optional(),
});
export type ChallongeLogEntry = z.infer<typeof ChallongeLogEntrySchema>;

// ─── Tournament metadata ─────────────────────────────────────────────────────

/** Validateur runtime de `ScrapedTournamentMetadata` (dates ISO en string). */
export const ChallongeTournamentMetadataSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  state: z.string(),
  type: z.string(),
  participantsCount: z.number(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  game: z.string().nullish(),
  subdomain: z.string().nullish(),
});
export type ChallongeTournamentMetadata = z.infer<typeof ChallongeTournamentMetadataSchema>;

// ─── Tournament (composite) ──────────────────────────────────────────────────

/** Validateur runtime de `ScrapedTournament` — composition des schémas ci-dessus. */
export const ChallongeTournamentSchema = z.object({
  metadata: ChallongeTournamentMetadataSchema,
  participants: z.array(ChallongeParticipantSchema),
  matches: z.array(ChallongeMatchSchema),
  standings: z.array(ChallongeStandingSchema),
  stations: z.array(ChallongeStationSchema),
  log: z.array(ChallongeLogEntrySchema),
  raw: z.any(),
});
export type ChallongeTournament = z.infer<typeof ChallongeTournamentSchema>;

// ─── Cohérence type ↔ schéma (compile-time, bidirectionnelle) ────────────────
//
// `types.ts` est la source de forme. Ces fonctions identité forcent que chaque
// type inféré et son interface soient MUTUELLEMENT assignables. Toute divergence
// de forme (clé manquante, optionalité ou nullabilité incorrecte, mauvais type)
// devient une erreur tsc → corriger le schéma. `void` consomme les fonctions
// pour qu'elles ne déclenchent pas de warning "unused".

const _assertParticipantForward = (v: ChallongeParticipant): ScrapedParticipant => v;
const _assertParticipantBackward = (v: ScrapedParticipant): ChallongeParticipant => v;

const _assertMatchForward = (v: ChallongeMatch): ScrapedMatch => v;
const _assertMatchBackward = (v: ScrapedMatch): ChallongeMatch => v;

const _assertStandingForward = (v: ChallongeStanding): ScrapedStanding => v;
const _assertStandingBackward = (v: ScrapedStanding): ChallongeStanding => v;

const _assertStationForward = (v: ChallongeStation): ScrapedStation => v;
const _assertStationBackward = (v: ScrapedStation): ChallongeStation => v;

const _assertLogEntryForward = (v: ChallongeLogEntry): ScrapedLogEntry => v;
const _assertLogEntryBackward = (v: ScrapedLogEntry): ChallongeLogEntry => v;

const _assertMetadataForward = (v: ChallongeTournamentMetadata): ScrapedTournamentMetadata => v;
const _assertMetadataBackward = (v: ScrapedTournamentMetadata): ChallongeTournamentMetadata => v;

const _assertTournamentForward = (v: ChallongeTournament): ScrapedTournament => v;
const _assertTournamentBackward = (v: ScrapedTournament): ChallongeTournament => v;

const _assertBracketSideForward = (v: z.infer<typeof ChallongeBracketSideSchema>): BracketSide => v;
const _assertBracketSideBackward = (v: BracketSide): z.infer<typeof ChallongeBracketSideSchema> =>
  v;

void [
  _assertParticipantForward,
  _assertParticipantBackward,
  _assertMatchForward,
  _assertMatchBackward,
  _assertStandingForward,
  _assertStandingBackward,
  _assertStationForward,
  _assertStationBackward,
  _assertLogEntryForward,
  _assertLogEntryBackward,
  _assertMetadataForward,
  _assertMetadataBackward,
  _assertTournamentForward,
  _assertTournamentBackward,
  _assertBracketSideForward,
  _assertBracketSideBackward,
];
