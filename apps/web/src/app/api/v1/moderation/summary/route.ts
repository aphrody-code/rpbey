import { ModerationSummarySchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getModerationSummary } from "@/server/dal/moderation";

/**
 * GET /api/v1/moderation/summary — cliché agrégé ANONYMISÉ de la modération.
 *
 * Lecture publique sans session : compteurs de warnings/tickets/reminders et
 * distributions de tickets par statut/type. Aucune PII (raison, modérateur,
 * contenu) n'est exposée. Le détail sensible reste hors `/api/v1` jusqu'à la
 * migration de la lane `auth`.
 */

export const GET = getRoute({
  response: ModerationSummarySchema,
  async handle() {
    return getModerationSummary();
  },
});
