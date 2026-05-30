import { z } from "zod";
import { IsoDateSchema, PaginationMetaSchema } from "./envelope";

// Système d'équipes communautaires (clans). Surface publique de lecture (liste,
// détail, leaderboard, membres) + schémas d'entrée des mutations authentifiées
// (création, édition, invitations, chat).
//
// Invariant timestamp (@rpbey/db) : toutes les colonnes `teams*` sont `mode:"string"`
// (ISO). La DAL normalise en ISO avant l'envoi — le contrat ne voit jamais de Date.

export const TEAM_ROLES = ["CAPTAIN", "CO_CAPTAIN", "MEMBER"] as const;
export const TeamRoleSchema = z.enum(TEAM_ROLES);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const TEAM_INVITE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"] as const;
export const TeamInviteStatusSchema = z.enum(TEAM_INVITE_STATUSES);
export type TeamInviteStatus = z.infer<typeof TeamInviteStatusSchema>;

export const TEAM_MESSAGE_KINDS = ["TEXT", "SHARE_DECK", "SHARE_BEY", "SYSTEM"] as const;
export const TeamMessageKindSchema = z.enum(TEAM_MESSAGE_KINDS);
export type TeamMessageKind = z.infer<typeof TeamMessageKindSchema>;

/** Liens sociaux d'une équipe (réutilisé en lecture et écriture). */
export const TeamSocialsSchema = z.object({
  twitterHandle: z.string().nullish(),
  instagramHandle: z.string().nullish(),
  youtubeHandle: z.string().nullish(),
  twitchHandle: z.string().nullish(),
  discordInvite: z.string().nullish(),
  websiteUrl: z.string().nullish(),
});
export type TeamSocials = z.infer<typeof TeamSocialsSchema>;

/** Carte d'équipe (liste / leaderboard) — sans membres ni description longue. */
export const TeamSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  tag: z.string(),
  name: z.string(),
  logoUrl: z.string().nullish(),
  bannerUrl: z.string().nullish(),
  accentColor: z.string().nullish(),
  region: z.string().nullish(),
  isVerified: z.boolean(),
  isRecruiting: z.boolean(),
  isPublic: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  totalPoints: z.number().int(),
  totalWins: z.number().int(),
  totalLosses: z.number().int(),
  totalTournamentWins: z.number().int(),
  captainId: z.string(),
  createdAt: IsoDateSchema.nullish(),
});
export type TeamSummary = z.infer<typeof TeamSummarySchema>;

/** Membre d'une équipe (agrégat compte + profil compétitif). */
export const TeamMemberSchema = z.object({
  userId: z.string(),
  name: z.string().nullish(),
  image: z.string().nullish(),
  bladerName: z.string().nullish(),
  role: TeamRoleSchema,
  jerseyNumber: z.number().int().nullish(),
  position: z.string().nullish(),
  joinedAt: IsoDateSchema.nullish(),
  rankingPoints: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  tournamentWins: z.number().int(),
  duelRating: z.number().int(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/** Détail public complet d'une équipe (page `/equipes/[slug]`). */
export const TeamDetailSchema = TeamSummarySchema.extend({
  description: z.string().nullish(),
  socials: TeamSocialsSchema,
  foundedAt: IsoDateSchema.nullish(),
  members: z.array(TeamMemberSchema),
});
export type TeamDetail = z.infer<typeof TeamDetailSchema>;

// --- Requêtes / réponses de lecture publique (v1) ---------------------------------

export const TeamsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
  q: z.string().trim().min(1).max(80).optional(),
  region: z.string().trim().min(1).max(80).optional(),
  recruiting: z.coerce.boolean().optional(),
  sort: z.enum(["points", "members", "recent", "wins"]).default("points"),
});
export type TeamsListQuery = z.infer<typeof TeamsListQuerySchema>;

export const TeamsListResponseSchema = z.object({
  items: z.array(TeamSummarySchema),
  pagination: PaginationMetaSchema,
});
export type TeamsListResponse = z.infer<typeof TeamsListResponseSchema>;

export const TeamDetailResponseSchema = z.object({
  team: TeamDetailSchema.nullable(),
});
export type TeamDetailResponse = z.infer<typeof TeamDetailResponseSchema>;

export const TeamMembersResponseSchema = z.object({
  members: z.array(TeamMemberSchema),
});
export type TeamMembersResponse = z.infer<typeof TeamMembersResponseSchema>;

export const TeamLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type TeamLeaderboardQuery = z.infer<typeof TeamLeaderboardQuerySchema>;

export const TeamLeaderboardResponseSchema = z.object({
  teams: z.array(TeamSummarySchema),
});
export type TeamLeaderboardResponse = z.infer<typeof TeamLeaderboardResponseSchema>;

// --- Entrées de mutation (routes authentifiées hors v1) ---------------------------

const handle = z.string().trim().max(120).nullish();

export const TeamCreateInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tag: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z0-9]+$/, "Le tag doit être alphanumérique (2-6 caractères)."),
  description: z.string().trim().max(2000).nullish(),
  region: z.string().trim().max(80).nullish(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  logoUrl: z.url().nullish(),
  bannerUrl: z.url().nullish(),
  isRecruiting: z.boolean().optional(),
  twitterHandle: handle,
  instagramHandle: handle,
  youtubeHandle: handle,
  twitchHandle: handle,
  discordInvite: z.string().trim().max(200).nullish(),
  websiteUrl: z.url().nullish(),
});
export type TeamCreateInput = z.infer<typeof TeamCreateInputSchema>;

export const TeamUpdateInputSchema = TeamCreateInputSchema.partial().omit({ tag: true });
export type TeamUpdateInput = z.infer<typeof TeamUpdateInputSchema>;

export const TeamCreateResponseSchema = z.object({ team: TeamDetailSchema });
export type TeamCreateResponse = z.infer<typeof TeamCreateResponseSchema>;

export const TeamInviteInputSchema = z.object({
  userId: z.string().min(1),
  message: z.string().trim().max(500).nullish(),
});
export type TeamInviteInput = z.infer<typeof TeamInviteInputSchema>;

export const TeamMemberUpdateInputSchema = z.object({
  userId: z.string().min(1),
  role: TeamRoleSchema.optional(),
  jerseyNumber: z.number().int().min(0).max(999).nullish(),
  position: z.string().trim().max(60).nullish(),
});
export type TeamMemberUpdateInput = z.infer<typeof TeamMemberUpdateInputSchema>;

export const TeamMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  kind: TeamMessageKindSchema.default("TEXT"),
  refId: z.string().max(120).nullish(),
});
export type TeamMessageInput = z.infer<typeof TeamMessageInputSchema>;

export const TeamMessageSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  authorName: z.string().nullish(),
  authorImage: z.string().nullish(),
  authorBladerName: z.string().nullish(),
  content: z.string(),
  kind: TeamMessageKindSchema,
  refId: z.string().nullish(),
  createdAt: IsoDateSchema,
  editedAt: IsoDateSchema.nullish(),
});
export type TeamMessage = z.infer<typeof TeamMessageSchema>;

export const TeamMessagesResponseSchema = z.object({
  messages: z.array(TeamMessageSchema),
  nextCursor: z.string().nullish(),
});
export type TeamMessagesResponse = z.infer<typeof TeamMessagesResponseSchema>;

/** Invitation reçue par l'utilisateur connecté (vue « mes invitations »). */
export const TeamInviteSchema = z.object({
  id: z.string(),
  status: TeamInviteStatusSchema,
  message: z.string().nullish(),
  createdAt: IsoDateSchema,
  team: TeamSummarySchema,
  invitedByName: z.string().nullish(),
});
export type TeamInvite = z.infer<typeof TeamInviteSchema>;
