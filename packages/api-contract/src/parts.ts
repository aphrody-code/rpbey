import { z } from "zod";

// Pièces Beyblade (parts) — catalogue public consommé par le builder & le SDK.
// Reflet de la table `parts` (@rpbey/db). Stats stockées en TEXT, timestamps ISO.

export const PartSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  name: z.string(),
  type: z.string(),
  nameJp: z.string().nullish(),
  beyType: z.string().nullish(),
  weight: z.number().nullish(),
  attack: z.string().nullish(),
  defense: z.string().nullish(),
  stamina: z.string().nullish(),
  burst: z.string().nullish(),
  dash: z.string().nullish(),
  height: z.number().nullish(),
  protrusions: z.number().nullish(),
  gearRatio: z.string().nullish(),
  shaftWidth: z.string().nullish(),
  tipType: z.string().nullish(),
  releaseDate: z.string().nullish(),
  imageUrl: z.string().nullish(),
  rarity: z.string().nullish(),
  modelUrl: z.string().nullish(),
  textureUrl: z.string().nullish(),
  spinDirection: z.string().nullish(),
  system: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type Part = z.infer<typeof PartSchema>;

const csv = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  )
  .optional();

export const PartsQuerySchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(), // PartType | "ALL"
  systems: csv, // CSV → string[]
  spin: z.string().optional(),
  beyTypes: csv, // CSV → string[]
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type PartsQuery = z.infer<typeof PartsQuerySchema>;

export const PartsListResponseSchema = z.object({
  parts: z.array(PartSchema),
  total: z.number(),
  totalPages: z.number(),
});
export type PartsListResponse = z.infer<typeof PartsListResponseSchema>;

export const PartResponseSchema = z.object({
  part: PartSchema.nullable(),
});
export type PartResponse = z.infer<typeof PartResponseSchema>;
