import { z } from "zod";
import { IsoDateSchema } from "./envelope";

/**
 * Analytics — ingestion d'événements (pageviews + événements métier) et cliché
 * agrégé pour le dashboard admin. Reflet de la table `analytics_events`
 * (@rpbey/db), `createdAt` en string ISO (mode:"string", table non-auth).
 *
 * L'ingestion publique (`POST /api/v1/analytics`) est ANONYME : aucune session
 * n'est résolue ici (le couplage `@/lib/auth` reste hors du préfixe enforced).
 * Le serveur dérive lui-même un id de session anonyme tournant chaque jour.
 */

/** Corps d'ingestion d'un événement (beacon client / instrumentation). */
export const AnalyticsTrackInputSchema = z.object({
  type: z.string().min(1).max(64).default("pageview"),
  path: z.string().max(512).nullish(),
  referrer: z.string().max(512).nullish(),
  meta: z.record(z.string(), z.unknown()).nullish(),
});
export type AnalyticsTrackInput = z.infer<typeof AnalyticsTrackInputSchema>;

/** Réponse d'ingestion : accusé minimal (l'écriture est best-effort). */
export const AnalyticsTrackResponseSchema = z.object({
  accepted: z.literal(true),
});
export type AnalyticsTrackResponse = z.infer<typeof AnalyticsTrackResponseSchema>;

/** Une ligne d'événement récente exposée par le cliché admin. */
export const AnalyticsRecentEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  path: z.string().nullable(),
  userId: z.string().nullable(),
  createdAt: IsoDateSchema,
});
export type AnalyticsRecentEvent = z.infer<typeof AnalyticsRecentEventSchema>;

/** Cliché agrégé (pageviews, top pages/referrers, événements récents). */
export const AnalyticsSummarySchema = z.object({
  liveVisitors: z.number().int().nonnegative(),
  pageviewsToday: z.number().int().nonnegative(),
  pageviews7d: z.number().int().nonnegative(),
  eventsToday: z.number().int().nonnegative(),
  topPages: z.array(z.object({ path: z.string(), views: z.number().int().nonnegative() })),
  topReferrers: z.array(z.object({ referrer: z.string(), count: z.number().int().nonnegative() })),
  recentEvents: z.array(AnalyticsRecentEventSchema),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
