import { z } from "zod";

/**
 * Enveloppe de réponse unique pour toute la surface REST `/api/v1`.
 * Remplace les formes ad-hoc hétérogènes (`{success,...}` / `{error}` / `{data}`).
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Construit le schéma Zod de l'enveloppe de succès pour un payload donné. */
export function okEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ ok: z.literal(true), data });
}

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ApiErrorSchema,
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export type OkEnvelope<T> = { ok: true; data: T };
export type ApiEnvelope<T> = OkEnvelope<T> | ErrorEnvelope;

/**
 * Scalaire date sur le fil : TOUJOURS une string ISO 8601.
 * Respecte l'invariant `@rpbey/db` — les colonnes auth (`mode:"date"`) comme les
 * autres (`mode:"string"`) sont normalisées en ISO par la DAL avant l'envoi, donc
 * le contrat ne voit jamais d'objet `Date`. Validation permissive (string) pour
 * ne rejeter aucune valeur ISO réelle du store.
 */
export const IsoDateSchema = z.string().describe("ISO 8601 date-time string");
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Métadonnées de pagination communes aux listes paginées. */
export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  pageCount: z.number().int().nonnegative(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/** Query string standard de pagination (valeurs coercées depuis l'URL). */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Schéma d'une réponse de liste paginée `{ items, pagination }` pour un item donné. */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    pagination: PaginationMetaSchema,
  });
}
