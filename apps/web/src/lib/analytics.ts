/**
 * Façade analytics (vague 5, migration API-first).
 *
 * Toute la logique (et l'unique accès `@rpbey/db`) vit désormais dans
 * `@/server/dal/analytics`. Ce fichier ne fait que ré-exporter, donc les ~5
 * appelants existants (`actions/analytics`, beacon `/api/analytics`, admin
 * stream/route, RSC admin, register tournoi) ne changent pas, mais le `db`
 * quitte `lib/`. server-only conservé : ces symboles tapent la base.
 */
import "server-only";

export {
  type AnalyticsEventType,
  type AnalyticsSummary,
  type TrackInput,
  anonSessionId,
  clientIpFromHeaders,
  getAnalyticsSummary,
  recordEvent,
} from "@/server/dal/analytics";
