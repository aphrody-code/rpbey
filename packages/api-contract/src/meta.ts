import { z } from "zod";

// Méta-analyse hebdomadaire des pièces Beyblade X (résultats tournois WBO).

export const PartStatsSchema = z.object({
  attack: z.number(),
  defense: z.number(),
  stamina: z.number(),
  dash: z.number(),
  burst: z.number(),
});
export type PartStats = z.infer<typeof PartStatsSchema>;

export const SynergyItemSchema = z.object({
  name: z.string(),
  score: z.number(),
  imageUrl: z.string().optional(),
});
export type SynergyItem = z.infer<typeof SynergyItemSchema>;

export const ComponentDataSchema = z.object({
  name: z.string(),
  score: z.number(),
  position_change: z.union([z.number(), z.literal("NEW")]),
  synergy: z.array(SynergyItemSchema),
  stats: PartStatsSchema.optional(),
  imageUrl: z.string().optional(),
});
export type ComponentData = z.infer<typeof ComponentDataSchema>;

export const CategoryDataSchema = z.object({
  category: z.string(),
  components: z.array(ComponentDataSchema),
});
export type CategoryData = z.infer<typeof CategoryDataSchema>;

export const PeriodMetadataSchema = z.object({
  dataSource: z.string(),
  weekId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  eventsScanned: z.number(),
  partsAnalyzed: z.number(),
});
export type PeriodMetadata = z.infer<typeof PeriodMetadataSchema>;

export const PeriodDataSchema = z.object({
  metadata: PeriodMetadataSchema,
  categories: z.array(CategoryDataSchema),
});
export type PeriodData = z.infer<typeof PeriodDataSchema>;

export const BbxWeeklyDataSchema = z.object({
  scrapedAt: z.string(),
  periods: z.object({
    "2weeks": PeriodDataSchema,
    "4weeks": PeriodDataSchema,
  }),
});
export type BbxWeeklyData = z.infer<typeof BbxWeeklyDataSchema>;

/** Réponse `/api/v1/meta` : la méta enrichie, ou `null` si pas encore scrapée. */
export const MetaResponseSchema = z.object({
  data: BbxWeeklyDataSchema.nullable(),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;
