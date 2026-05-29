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
