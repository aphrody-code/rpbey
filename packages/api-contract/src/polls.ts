import { z } from "zod";
import { IsoDateSchema, PaginationMetaSchema } from "./envelope";

// Sondages (vote type Google Forms) + tier lists communautaires.
// Surface publique de lecture (v1) + entrées de mutation (vote / soumission tier list).
// Tiers fixes S > A > B > C > D > F (score 6..1 pour l'agrégat communautaire).

export const TIERS = ["S", "A", "B", "C", "D", "F"] as const;
export const TierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof TierSchema>;

export const POLL_KINDS = ["SINGLE", "MULTIPLE", "RATING"] as const;
export const PollKindSchema = z.enum(POLL_KINDS);
export type PollKind = z.infer<typeof PollKindSchema>;

export const TIER_LIST_KINDS = ["BEY", "CHARACTER", "SEASON"] as const;
export const TierListKindSchema = z.enum(TIER_LIST_KINDS);
export type TierListKind = z.infer<typeof TierListKindSchema>;

// --- Sondages ---------------------------------------------------------------------

export const PollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  imageUrl: z.string().nullish(),
  voteCount: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});
export type PollOption = z.infer<typeof PollOptionSchema>;

export const PollSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  question: z.string(),
  description: z.string().nullish(),
  kind: PollKindSchema,
  category: z.string().nullish(),
  season: z.string().nullish(),
  imageUrl: z.string().nullish(),
  isFeatured: z.boolean(),
  isClosed: z.boolean(),
  totalVotes: z.number().int().nonnegative(),
  optionCount: z.number().int().nonnegative(),
  createdAt: IsoDateSchema.nullish(),
});
export type PollSummary = z.infer<typeof PollSummarySchema>;

export const PollDetailSchema = PollSummarySchema.extend({
  options: z.array(PollOptionSchema),
  /** Identifiants des options déjà votées par le visiteur courant. */
  votedOptionIds: z.array(z.string()),
});
export type PollDetail = z.infer<typeof PollDetailSchema>;

export const PollsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
  category: z.string().trim().min(1).max(60).optional(),
  season: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).optional(),
  featured: z.coerce.boolean().optional(),
});
export type PollsListQuery = z.infer<typeof PollsListQuerySchema>;

export const PollsListResponseSchema = z.object({
  items: z.array(PollSummarySchema),
  pagination: PaginationMetaSchema,
});
export type PollsListResponse = z.infer<typeof PollsListResponseSchema>;

export const PollDetailResponseSchema = z.object({ poll: PollDetailSchema.nullable() });
export type PollDetailResponse = z.infer<typeof PollDetailResponseSchema>;

export const PollVoteInputSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1).max(20),
});
export type PollVoteInput = z.infer<typeof PollVoteInputSchema>;

// --- Tier lists -------------------------------------------------------------------

export const TierListSubjectSchema = z.object({
  id: z.string(),
  label: z.string(),
  imageUrl: z.string().nullish(),
  refType: z.string().nullish(),
  refId: z.string().nullish(),
});
export type TierListSubject = z.infer<typeof TierListSubjectSchema>;

export const TierListSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  kind: TierListKindSchema,
  season: z.string().nullish(),
  imageUrl: z.string().nullish(),
  isFeatured: z.boolean(),
  totalSubmissions: z.number().int().nonnegative(),
  subjectCount: z.number().int().nonnegative(),
  createdAt: IsoDateSchema.nullish(),
});
export type TierListSummary = z.infer<typeof TierListSummarySchema>;

/** Agrégat communautaire d'un sujet : tier moyen + répartition des placements. */
export const TierAggregateSchema = z.object({
  subjectId: z.string(),
  communityTier: TierSchema,
  averageScore: z.number(),
  placements: z.number().int().nonnegative(),
});
export type TierAggregate = z.infer<typeof TierAggregateSchema>;

export const TierListDetailSchema = TierListSummarySchema.extend({
  subjects: z.array(TierListSubjectSchema),
  /** Tier communautaire par sujet (agrégat de toutes les soumissions). */
  community: z.array(TierAggregateSchema),
  /** Placement du visiteur courant (subjectId → tier), vide s'il n'a pas voté. */
  myPlacements: z.record(z.string(), TierSchema),
});
export type TierListDetail = z.infer<typeof TierListDetailSchema>;

export const TierListsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
  kind: TierListKindSchema.optional(),
  season: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).optional(),
  featured: z.coerce.boolean().optional(),
});
export type TierListsListQuery = z.infer<typeof TierListsListQuerySchema>;

export const TierListsListResponseSchema = z.object({
  items: z.array(TierListSummarySchema),
  pagination: PaginationMetaSchema,
});
export type TierListsListResponse = z.infer<typeof TierListsListResponseSchema>;

export const TierListDetailResponseSchema = z.object({
  tierList: TierListDetailSchema.nullable(),
});
export type TierListDetailResponse = z.infer<typeof TierListDetailResponseSchema>;

export const TierListSubmitInputSchema = z.object({
  placements: z
    .array(z.object({ subjectId: z.string().min(1), tier: TierSchema }))
    .min(1)
    .max(500),
});
export type TierListSubmitInput = z.infer<typeof TierListSubmitInputSchema>;

// --- Administration (staff) -------------------------------------------------------

export const PollCreateInputSchema = z.object({
  question: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1000).nullish(),
  kind: PollKindSchema.default("SINGLE"),
  category: z.string().trim().max(80).nullish(),
  season: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).nullish(),
  imageUrl: z.url().nullish(),
  isFeatured: z.boolean().optional(),
  options: z
    .array(z.object({ label: z.string().trim().min(1).max(160), imageUrl: z.url().nullish() }))
    .min(2)
    .max(30),
});
export type PollCreateInput = z.infer<typeof PollCreateInputSchema>;

export const PollAdminUpdateInputSchema = z.object({
  question: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(1000).nullish(),
  category: z.string().trim().max(80).nullish(),
  isFeatured: z.boolean().optional(),
  isClosed: z.boolean().optional(),
});
export type PollAdminUpdateInput = z.infer<typeof PollAdminUpdateInputSchema>;

export const TierListCreateInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).nullish(),
  kind: TierListKindSchema.default("BEY"),
  season: z.enum(["ORIGINAL", "METAL", "BURST", "X"]).nullish(),
  imageUrl: z.url().nullish(),
  isFeatured: z.boolean().optional(),
  subjects: z
    .array(z.object({ label: z.string().trim().min(1).max(120), imageUrl: z.url().nullish() }))
    .min(3)
    .max(100),
});
export type TierListCreateInput = z.infer<typeof TierListCreateInputSchema>;

/** Vue admin : sondage + tier list (compteurs bruts, sans filtre featured). */
export const AdminContentResponseSchema = z.object({
  polls: z.array(PollSummarySchema),
  tierLists: z.array(TierListSummarySchema),
});
export type AdminContentResponse = z.infer<typeof AdminContentResponseSchema>;

// --- Beyblade Awards : éditions (vidéo de résultats + visibilité) -----------------

export const AwardsEditionSchema = z.object({
  year: z.number().int(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  videoUrl: z.string().nullish(),
  videoId: z.string().nullish(),
  pollCategory: z.string(),
  isPublished: z.boolean(),
  isVotingOpen: z.boolean(),
  categoryCount: z.number().int().nonnegative(),
  createdAt: IsoDateSchema.nullish(),
});
export type AwardsEdition = z.infer<typeof AwardsEditionSchema>;

export const AwardsEditionsResponseSchema = z.object({
  editions: z.array(AwardsEditionSchema),
});
export type AwardsEditionsResponse = z.infer<typeof AwardsEditionsResponseSchema>;

export const AwardsEditionUpdateInputSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullish(),
  videoUrl: z.string().trim().max(500).nullish(),
  isPublished: z.boolean().optional(),
  isVotingOpen: z.boolean().optional(),
});
export type AwardsEditionUpdateInput = z.infer<typeof AwardsEditionUpdateInputSchema>;

// --- Annuaire des membres (admin) -------------------------------------------------

export const DiscordMemberSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  username: z.string().nullish(),
  nickname: z.string().nullish(),
  globalName: z.string().nullish(),
  image: z.string().nullish(),
  discordTag: z.string().nullish(),
  roles: z.array(z.string()).nullish(),
});
export type DiscordMember = z.infer<typeof DiscordMemberSchema>;

export const XMemberSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullish(),
  followers: z.number().int().nullish(),
});
export type XMember = z.infer<typeof XMemberSchema>;

export const MemberDirectoryResponseSchema = z.object({
  discord: z.array(DiscordMemberSchema),
  x: z.array(XMemberSchema),
  xCommunityUrl: z.string(),
});
export type MemberDirectoryResponse = z.infer<typeof MemberDirectoryResponseSchema>;
