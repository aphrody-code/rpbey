import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// CMS — contenu éditorial (content blocks) & staff (notre-équipe).
// Reflet des tables `content_blocks` et `staff_members` (@rpbey/db).
// Timestamps en mode:"string" → toujours ISO sur le fil (cf. IsoDateSchema).

export const ContentBlockSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().nullish(),
  type: z.string(),
  content: z.string(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const ContentBlockListResponseSchema = z.object({
  blocks: z.array(ContentBlockSchema),
});
export type ContentBlockListResponse = z.infer<typeof ContentBlockListResponseSchema>;

/** Query `/api/v1/cms/content` : résolution d'un bloc par slug (optionnel). */
export const ContentQuerySchema = z.object({
  slug: z.string().optional(),
});
export type ContentQuery = z.infer<typeof ContentQuerySchema>;

export const StaffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  teamId: z.string(),
  imageUrl: z.string().nullish(),
  discordId: z.string().nullish(),
  displayIndex: z.number().nullish(),
  isActive: z.boolean().nullish(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const StaffListResponseSchema = z.object({
  members: z.array(StaffMemberSchema),
});
export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;
