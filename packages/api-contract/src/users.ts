import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Profils / utilisateurs publics — surface consommée par la page profil publique
// (`/profile/[id]`), la carte profil et l'historique de matchs.
//
// Invariant timestamp (@rpbey/db) : la colonne `users.createdAt` est `mode:"date"`
// (objet Date) ; `profiles.createdAt/updatedAt` sont `mode:"string"` (ISO). La DAL
// normalise TOUT en ISO via `IsoDateSchema` avant l'envoi — le contrat ne voit
// jamais d'objet Date.

/** Profil joueur public (sous-ensemble non sensible de la table `profiles`). */
export const PublicProfileSchema = z.object({
  bladerName: z.string().nullish(),
  favoriteType: z.string().nullish(),
  experience: z.string().nullish(),
  bio: z.string().nullish(),
  wins: z.number().int(),
  losses: z.number().int(),
  tournamentWins: z.number().int(),
  rankingPoints: z.number().int(),
  challongeUsername: z.string().nullish(),
  twitterHandle: z.string().nullish(),
  tiktokHandle: z.string().nullish(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/** Compte joueur public + profil agrégé (réponse de `/api/v1/users/[id]`). */
export const PublicUserSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  image: z.string().nullish(),
  createdAt: IsoDateSchema.nullish(),
  discordTag: z.string().nullish(),
  nickname: z.string().nullish(),
  serverAvatar: z.string().nullish(),
  globalName: z.string().nullish(),
  roles: z.array(z.string()).nullish(),
  profile: PublicProfileSchema.nullable(),
  counts: z.object({
    tournaments: z.number().int().nonnegative(),
    matches: z.number().int().nonnegative(),
  }),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const PublicUserResponseSchema = z.object({
  user: PublicUserSchema.nullable(),
});
export type PublicUserResponse = z.infer<typeof PublicUserResponseSchema>;

/** Joueur minimal (référence dans un match). */
export const MatchPlayerSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  image: z.string().nullish(),
  bladerName: z.string().nullish(),
});
export type MatchPlayer = z.infer<typeof MatchPlayerSchema>;

/** Entrée d'historique de match (réponse de `/api/v1/users/[id]/matches`). */
export const UserMatchSchema = z.object({
  id: z.string(),
  tournamentId: z.string().nullish(),
  tournamentName: z.string().nullish(),
  round: z.number().int().nullish(),
  score: z.string().nullish(),
  state: z.string().nullish(),
  createdAt: IsoDateSchema.nullish(),
  player1: MatchPlayerSchema.nullable(),
  player2: MatchPlayerSchema.nullable(),
  winnerId: z.string().nullish(),
});
export type UserMatch = z.infer<typeof UserMatchSchema>;

export const UserMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type UserMatchesQuery = z.infer<typeof UserMatchesQuerySchema>;

export const UserMatchesResponseSchema = z.object({
  matches: z.array(UserMatchSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type UserMatchesResponse = z.infer<typeof UserMatchesResponseSchema>;
