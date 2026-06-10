import { WarningCountQuerySchema, WarningCountResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getWarningCount } from "@/server/dal/moderation";

/**
 * GET /api/v1/moderation/warnings/count?discordId=… — compteur de warnings d'un
 * membre Discord, SANS PII.
 *
 * Lecture publique sans session : renvoie seulement le total et la date du
 * dernier warning. Ni la raison ni l'identité du modérateur ne sont exposées.
 */

export const GET = getRoute({
  query: WarningCountQuerySchema,
  response: WarningCountResponseSchema,
  async handle({ query }) {
    return getWarningCount(query.discordId);
  },
});
