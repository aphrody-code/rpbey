import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Profils / utilisateurs publics — surface consommée par la page profil publique
// (`/profile/[id]`), la carte profil et l'historique de matchs.
//
// Invariant timestamp (@rpbey/db) : la colonne `users.createdAt` est `mode:"date"`
// (objet Date) ; `profiles.createdAt/updatedAt` sont `mode:"string"` (ISO). La DAL
// normalise TOUT en ISO via `IsoDateSchema` avant l'envoi — le contrat ne voit
// jamais d'objet Date.

/** Bey favori résolu (référence catalogue `beyblades`). */
export const FavoriteBeybladeSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().nullish(),
  beyType: z.string().nullish(),
});
export type FavoriteBeyblade = z.infer<typeof FavoriteBeybladeSchema>;

/** Deck favori résolu (référence `decks`). */
export const FavoriteDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type FavoriteDeck = z.infer<typeof FavoriteDeckSchema>;

/** Mini-carte de l'équipe d'un joueur (affichée sur son profil public). */
export const ProfileTeamSchema = z.object({
  slug: z.string(),
  tag: z.string(),
  name: z.string(),
  logoUrl: z.string().nullish(),
  role: z.string(),
});
export type ProfileTeam = z.infer<typeof ProfileTeamSchema>;

/**
 * Profil joueur public (sous-ensemble non sensible de la table `profiles`).
 * La localisation et les réseaux ne sont exposés que si le joueur l'a autorisé
 * (`showLocation` / `showSocials`) — la DAL applique le filtre avant l'envoi.
 */
export const PublicProfileSchema = z.object({
  bladerName: z.string().nullish(),
  displayName: z.string().nullish(),
  pronouns: z.string().nullish(),
  favoriteType: z.string().nullish(),
  favoriteSeason: z.string().nullish(),
  experience: z.string().nullish(),
  bio: z.string().nullish(),
  bannerImage: z.string().nullish(),
  accentColor: z.string().nullish(),
  wins: z.number().int(),
  losses: z.number().int(),
  tournamentWins: z.number().int(),
  rankingPoints: z.number().int(),
  duelRating: z.number().int(),
  challongeUsername: z.string().nullish(),
  // Localisation (présente seulement si `showLocation`).
  country: z.string().nullish(),
  region: z.string().nullish(),
  city: z.string().nullish(),
  // Réseaux (présents seulement si `showSocials`).
  twitterHandle: z.string().nullish(),
  tiktokHandle: z.string().nullish(),
  instagramHandle: z.string().nullish(),
  youtubeHandle: z.string().nullish(),
  twitchHandle: z.string().nullish(),
  discordHandle: z.string().nullish(),
  websiteUrl: z.string().nullish(),
  favoriteBeyblade: FavoriteBeybladeSchema.nullish(),
  favoriteDeck: FavoriteDeckSchema.nullish(),
  team: ProfileTeamSchema.nullish(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/**
 * Corps de mise à jour du profil de l'utilisateur connecté (`PATCH /api/profile`).
 * Tous les champs optionnels — patch partiel. Validé avant écriture par la DAL.
 */
/**
 * URL d'image stockée : URL absolue (CDN `https://cdn.rpbey.fr/...`) OU chemin
 * root-relatif legacy (`/uploads/...`). Tolérer le relatif évite un 422 quand un
 * profil pré-CDN est re-sauvegardé sans changer son avatar/bannière.
 */
const StoredImageUrlSchema = z
  .string()
  .max(500)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "URL d'image invalide",
  });

export const ProfileUpdateInputSchema = z.object({
  bladerName: z.string().trim().max(60).nullish(),
  displayName: z.string().trim().max(60).nullish(),
  pronouns: z.string().trim().max(40).nullish(),
  favoriteType: z.string().trim().max(40).nullish(),
  favoriteSeason: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).nullish(),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "LEGEND"]).nullish(),
  bio: z.string().trim().max(4000).nullish(),
  image: StoredImageUrlSchema.nullish(),
  bannerImage: StoredImageUrlSchema.nullish(),
  deckBoxImage: z.string().max(500).nullish(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  themePreference: z.enum(["system", "light", "dark"]).nullish(),
  profileVisibility: z.enum(["PUBLIC", "MEMBERS", "PRIVATE"]).nullish(),
  showLocation: z.boolean().nullish(),
  showSocials: z.boolean().nullish(),
  country: z.string().trim().max(80).nullish(),
  region: z.string().trim().max(80).nullish(),
  city: z.string().trim().max(80).nullish(),
  postalCode: z.string().trim().max(20).nullish(),
  addressLine: z.string().trim().max(200).nullish(),
  favoriteBeybladeId: z.string().max(40).nullish(),
  favoriteDeckId: z.string().max(40).nullish(),
  challongeUsername: z.string().trim().max(60).nullish(),
  twitterHandle: z.string().trim().max(60).nullish(),
  tiktokHandle: z.string().trim().max(60).nullish(),
  instagramHandle: z.string().trim().max(60).nullish(),
  youtubeHandle: z.string().trim().max(120).nullish(),
  twitchHandle: z.string().trim().max(60).nullish(),
  discordHandle: z.string().trim().max(60).nullish(),
  websiteUrl: z.url().nullish(),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;

/**
 * Données collectées à l'onboarding (juste après l'inscription). Écrit le profil,
 * pose `onboardedAt`, et peut définir le `username` du compte. `POST /api/onboarding`.
 */
export const OnboardingInputSchema = z.object({
  bladerName: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement.")
    .nullish(),
  image: z.url().nullish(),
  favoriteType: z.string().trim().max(40).nullish(),
  favoriteSeason: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).nullish(),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "LEGEND"]).nullish(),
  country: z.string().trim().max(80).nullish(),
  region: z.string().trim().max(80).nullish(),
  city: z.string().trim().max(80).nullish(),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

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
