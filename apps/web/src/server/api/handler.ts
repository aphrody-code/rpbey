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
      // Log complet côté serveur, message GÉNÉRIQUE côté client : ne jamais
      // exposer `e.message` brut (peut fuiter du SQL/Zod/chemins internes).
      console.error("[api/v1] handler error:", e);
      return jsonErr({ code: "internal", message: "Erreur interne" }, 500);
    }
  };
}

/**
 * Wrapper de Route Handler de MUTATION (POST/PUT/PATCH/DELETE) typé :
 * - valide le corps JSON contre `body` (Zod, 422 si invalide) ;
 * - valide la sortie contre `response` (drift = 500) ;
 * - même enveloppe `{ ok, data } | { ok, error }`.
 * `status` permet 201 sur création. Un corps absent/illisible → `{}` (laisse Zod trancher).
 */
export function mutationRoute<
  R extends z.ZodType,
  B extends z.ZodType = z.ZodType,
  Q extends z.ZodType = z.ZodType,
>(opts: {
  body?: B;
  query?: Q;
  response: R;
  status?: number;
  handle: (ctx: { body: z.infer<B>; query: z.infer<Q>; request: Request }) => Promise<z.infer<R>>;
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

    let body: unknown = {};
    if (opts.body) {
      const raw = await request.json().catch(() => ({}));
      const parsed = opts.body.safeParse(raw);
      if (!parsed.success) {
        return jsonErr({ code: "bad_request", message: z.prettifyError(parsed.error) }, 422);
      }
      body = parsed.data;
    }

    try {
      const data = await opts.handle({
        body: body as z.infer<B>,
        query: query as z.infer<Q>,
        request,
      });
      const validated = opts.response.parse(data);
      return jsonOk(validated, { status: opts.status ?? 200 });
    } catch (e) {
      // Log complet côté serveur, message GÉNÉRIQUE côté client : ne jamais
      // exposer `e.message` brut (peut fuiter du SQL/Zod/chemins internes).
      console.error("[api/v1] mutation error:", e);
      return jsonErr({ code: "internal", message: "Erreur interne" }, 500);
    }
  };
}

/** Alias sémantiques de `mutationRoute` (POST=création 201 par défaut, PATCH/PUT/DELETE=200). */
export function postRoute<
  R extends z.ZodType,
  B extends z.ZodType = z.ZodType,
  Q extends z.ZodType = z.ZodType,
>(opts: Parameters<typeof mutationRoute<R, B, Q>>[0]) {
  return mutationRoute<R, B, Q>({ status: 201, ...opts });
}
export const patchRoute = mutationRoute;
export const putRoute = mutationRoute;
export const deleteRoute = mutationRoute;
