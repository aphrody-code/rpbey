import { AnalyticsTrackInputSchema, AnalyticsTrackResponseSchema } from "@rpbey/api-contract";
import { mutationRoute } from "@/server/api/handler";
import { anonSessionId, clientIpFromHeaders, recordEvent } from "@/server/dal/analytics";

/**
 * POST /api/v1/analytics — ingestion publique ANONYME d'un événement.
 *
 * Surface contractuelle de remplacement du beacon legacy `/api/analytics`, mais
 * SANS résolution de session (le couplage `@/lib/auth` reste hors du préfixe
 * enforced). L'IP brute n'est jamais persistée : le serveur dérive un id de
 * session anonyme tournant chaque jour depuis les en-têtes. Écriture best-effort
 * (jamais d'échec remonté au client) ; renvoie un accusé `{ accepted: true }`.
 */

export const POST = mutationRoute({
  body: AnalyticsTrackInputSchema,
  response: AnalyticsTrackResponseSchema,
  async handle({ body, request }) {
    const h = request.headers;
    const sessionId = anonSessionId(clientIpFromHeaders(h), h.get("user-agent"));

    await recordEvent({
      type: body.type,
      path: body.path ?? null,
      referrer: body.referrer ?? h.get("referer"),
      sessionId,
      userId: null,
      meta: body.meta ?? null,
    });

    return { accepted: true as const };
  },
});
