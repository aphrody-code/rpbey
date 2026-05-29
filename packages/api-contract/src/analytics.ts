import { z } from "zod";

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

// Le cliché agrégé admin (summary + événements récents) reste servi par le path
// legacy /api/admin/analytics (session-gated via @/lib/auth) jusqu'à la migration
// de la lane auth — pas de schéma de contrat tant qu'aucune route /api/v1 ne le
// consomme (éviter une surface de contrat morte).
