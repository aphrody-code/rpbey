import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Tournois — brackets / matches / pools / participants.
// Reflet des tables `tournaments`, `tournament_participants`, `tournament_matches`
// (@rpbey/db, mode:"string" → timestamps ISO). Surface publique consommée par les
// pages marketing, l'admin (lecture) et le SDK. Les mutations Challonge restent
// hors contrat (route handlers dédiés, payloads ad-hoc).

export const TournamentStatusSchema = z.enum([
  "UPCOMING",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "CHECKIN",
  "UNDERWAY",
  "COMPLETE",
  "CANCELLED",
  "ARCHIVED",
]);
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

/** Catégorie (série) d'un tournoi — jointure publique légère. */
export const TournamentCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullish(),
  logoUrl: z.string().nullish(),
});
export type TournamentCategory = z.infer<typeof TournamentCategorySchema>;

/** Ligne `tournaments` exposée sur le fil (timestamps normalisés ISO par la DAL). */
export const TournamentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  date: IsoDateSchema,
  location: z.string().nullish(),
  format: z.string(),
  maxPlayers: z.number(),
  status: TournamentStatusSchema,
  challongeId: z.string().nullish(),
  challongeUrl: z.string().nullish(),
  challongeState: z.string().nullish(),
  posterUrl: z.string().nullish(),
  categoryId: z.string().nullish(),
  weight: z.number().nullish(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type Tournament = z.infer<typeof TournamentSchema>;

/** Carte de tournoi pour la liste publique (compteurs + catégorie résolue). */
export const TournamentCardSchema = TournamentSchema.extend({
  category: TournamentCategorySchema.nullable(),
  participantsCount: z.number(),
  matchesCount: z.number(),
});
export type TournamentCard = z.infer<typeof TournamentCardSchema>;

export const TournamentsQuerySchema = z.object({
  status: TournamentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type TournamentsQuery = z.infer<typeof TournamentsQuerySchema>;

export const TournamentsListResponseSchema = z.object({
  items: z.array(TournamentCardSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export type TournamentsListResponse = z.infer<typeof TournamentsListResponseSchema>;

// ── Participants & matches (lecture publique) ──

/** Profil joueur minimal résolu sur un participant/match. */
export const TournamentPlayerSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  bladerName: z.string().nullish(),
  imageUrl: z.string().nullish(),
});
export type TournamentPlayer = z.infer<typeof TournamentPlayerSchema>;

export const TournamentParticipantSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  userId: z.string().nullish(),
  playerName: z.string().nullish(),
  seed: z.number().nullish(),
  finalPlacement: z.number().nullish(),
  challongeParticipantId: z.string().nullish(),
  player: TournamentPlayerSchema.nullable(),
});
export type TournamentParticipant = z.infer<typeof TournamentParticipantSchema>;

export const TournamentMatchSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  challongeMatchId: z.string().nullish(),
  round: z.number(),
  state: z.string().nullish(),
  score: z.string().nullish(),
  player1Id: z.string().nullish(),
  player2Id: z.string().nullish(),
  winnerId: z.string().nullish(),
  player1: TournamentPlayerSchema.nullable(),
  player2: TournamentPlayerSchema.nullable(),
  winner: TournamentPlayerSchema.nullable(),
});
export type TournamentMatch = z.infer<typeof TournamentMatchSchema>;

export const TournamentParticipantsResponseSchema = z.object({
  items: z.array(TournamentParticipantSchema),
});
export type TournamentParticipantsResponse = z.infer<typeof TournamentParticipantsResponseSchema>;

export const TournamentMatchesResponseSchema = z.object({
  items: z.array(TournamentMatchSchema),
});
export type TournamentMatchesResponse = z.infer<typeof TournamentMatchesResponseSchema>;

/** Détail d'un tournoi : ligne + participants + matches. */
export const TournamentDetailResponseSchema = z.object({
  tournament: TournamentSchema.nullable(),
  participants: z.array(TournamentParticipantSchema),
  matches: z.array(TournamentMatchSchema),
});
export type TournamentDetailResponse = z.infer<typeof TournamentDetailResponseSchema>;
