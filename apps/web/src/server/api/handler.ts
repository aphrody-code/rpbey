import "server-only";
import { z } from "zod";
import type { ApiError } from "@rpbey/api-contract";

/**
 * Wrapper de Route Handler typé pour la surface `/api/v1` (Next.js 16, Web `Request`/`Response`).
 * - valide la query string contre un schéma Zod (422 si invalide) ;
 * - valide la sortie contre le schéma de réponse du contrat (drift = 500) ;
 * - enveloppe tout dans `{ ok, data } | { ok, error }`.
 */

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function jsonErr(error: ApiError, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

export function getRoute<R extends z.ZodType, Q extends z.ZodType = z.ZodType>(opts: {
  query?: Q;
  response: R;
  handle: (ctx: { query: z.infer<Q>; request: Request }) => Promise<z.infer<R>>;
}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    let query: unknown;
    if (opts.query) {
      const url = new URL(request.url);
      const parsed = opts.query.safeParse(Object.fromEntries(url.searchParams.entries()));
      if (!parsed.success) {
        return jsonErr({ code: "bad_request", message: z.prettifyError(parsed.error) }, 422);
      }
      query = parsed.data;
    }

    try {
      const data = await opts.handle({ query: query as z.infer<Q>, request });
      const validated = opts.response.parse(data);
      return jsonOk(validated);
    } catch (e) {
      console.error("[api/v1] handler error:", e);
      const message = e instanceof Error ? e.message : "internal error";
      return jsonErr({ code: "internal", message }, 500);
    }
  };
}
