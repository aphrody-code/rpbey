import { z } from "zod";
import { IsoDateSchema } from "./envelope";

/**
 * Modération — surface PUBLIQUE, sans PII et sans session.
 *
 * Reflet des tables `warnings` / `tickets` / `reminders` (@rpbey/db), toutes en
 * `mode:"string"` (timestamps string ISO — aucune table auth ici, donc aucun
 * objet `Date` ne traverse le contrat).
 *
 * Choix de design : le contenu sensible (raison d'un warning, identité du
 * modérateur, message d'un ticket) reste hors-contrat tant que la lane `auth`
 * n'est pas migrée — ces lectures détaillées demeurent bot-only / session-gated.
 * Seuls des AGRÉGATS anonymisés (compteurs, distributions, dernière date) et un
 * compteur de warnings par `discordId` (déjà connu de l'appelant) sont exposés.
 */

/** Compteur de tickets ventilé par statut (clé = valeur libre `status`, ex. OPEN/CLOSED). */
export const TicketStatusBreakdownSchema = z.object({
  status: z.string(),
  count: z.number().int().nonnegative(),
});
export type TicketStatusBreakdown = z.infer<typeof TicketStatusBreakdownSchema>;

/** Compteur de tickets ventilé par type (catégorie d'ouverture). */
export const TicketTypeBreakdownSchema = z.object({
  type: z.string(),
  count: z.number().int().nonnegative(),
});
export type TicketTypeBreakdown = z.infer<typeof TicketTypeBreakdownSchema>;

/**
 * Cliché agrégé de l'activité de modération (anonymisé).
 * `lastWarningAt` / `lastTicketAt` = dates ISO de la dernière entrée, ou `null`.
 */
export const ModerationSummarySchema = z.object({
  warnings: z.object({
    total: z.number().int().nonnegative(),
    uniqueMembers: z.number().int().nonnegative(),
    lastWarningAt: IsoDateSchema.nullable(),
  }),
  tickets: z.object({
    total: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
    byStatus: z.array(TicketStatusBreakdownSchema),
    byType: z.array(TicketTypeBreakdownSchema),
    lastTicketAt: IsoDateSchema.nullable(),
  }),
  reminders: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    fired: z.number().int().nonnegative(),
  }),
});
export type ModerationSummary = z.infer<typeof ModerationSummarySchema>;

/** Query du compteur de warnings : `discordId` requis (déjà connu du client). */
export const WarningCountQuerySchema = z.object({
  discordId: z.string().min(1).max(64),
});
export type WarningCountQuery = z.infer<typeof WarningCountQuerySchema>;

/**
 * Compteur de warnings pour un membre Discord donné — aucune PII renvoyée
 * (pas de raison, pas de modérateur), seulement le total et la dernière date.
 */
export const WarningCountResponseSchema = z.object({
  discordId: z.string(),
  count: z.number().int().nonnegative(),
  lastWarningAt: IsoDateSchema.nullable(),
});
export type WarningCountResponse = z.infer<typeof WarningCountResponseSchema>;
