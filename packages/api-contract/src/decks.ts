import { z } from "zod";
import { IsoDateSchema } from "./envelope";
import { PartSchema } from "./parts";

// Decks / combos — reflet des tables `decks` + `deck_items` (@rpbey/db).
// Timestamps en mode:"string" (ISO) côté store ; le contrat les voit toujours ISO.
// Lecture publique : carte de deck partageable (read-only) consommée par le SDK / les RSC.
// Les mutations (création/édition/activation/suppression) restent à leur path legacy
// authentifié `/api/decks` (session better-auth) tant que la lane auth n'est pas migrée.

/** Pièce résolue dans un item de deck (peut être absente si l'externalId n'existe plus). */
const DeckPartSchema = PartSchema.nullable();

/** Item de deck (un Beyblade composé) avec ses pièces résolues. */
export const DeckItemSchema = z.object({
  id: z.string(),
  deckId: z.string(),
  position: z.number().int(),
  beyId: z.string().nullish(),
  bladeId: z.string().nullish(),
  overBladeId: z.string().nullish(),
  ratchetId: z.string().nullish(),
  bitId: z.string().nullish(),
  lockChipId: z.string().nullish(),
  assistBladeId: z.string().nullish(),
  blade: DeckPartSchema,
  overBlade: DeckPartSchema,
  ratchet: DeckPartSchema,
  bit: DeckPartSchema,
  lockChip: DeckPartSchema,
  assistBlade: DeckPartSchema,
});
export type DeckItem = z.infer<typeof DeckItemSchema>;

/** Deck complet avec ses items (forme remappée Prisma-style `items`). */
export const DeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  userId: z.string(),
  ownerName: z.string().nullish(),
  createdAt: IsoDateSchema.nullish(),
  updatedAt: IsoDateSchema.nullish(),
  items: z.array(DeckItemSchema),
});
export type Deck = z.infer<typeof DeckSchema>;

/** Query d'un deck unique partageable : `?id=<deckId>`. */
export const DeckQuerySchema = z.object({
  id: z.string().min(1),
});
export type DeckQuery = z.infer<typeof DeckQuerySchema>;

export const DeckResponseSchema = z.object({
  deck: DeckSchema.nullable(),
});
export type DeckResponse = z.infer<typeof DeckResponseSchema>;

/** Combo brut (blade + ratchet + bit) résolu pour la carte combo publique. */
export const ComboQuerySchema = z.object({
  blade: z.string().min(1),
  ratchet: z.string().min(1),
  bit: z.string().min(1),
});
export type ComboQuery = z.infer<typeof ComboQuerySchema>;

export const ComboResponseSchema = z.object({
  blade: PartSchema.nullable(),
  ratchet: PartSchema.nullable(),
  bit: PartSchema.nullable(),
});
export type ComboResponse = z.infer<typeof ComboResponseSchema>;
