/**
 * Helpers communs aux routes REST refacto Vercel (W2B).
 *
 * Centralise CORS, parsing JSON safe, réponses d'erreur typées et un wrapper
 * `withAuth` qui délègue au middleware Bearer de `../server.ts`.
 */
import { bearerAuthenticate } from "../server.js";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

export function errorResponse(code: string, message: string, status = 500): Response {
  return jsonResponse({ error: message, code }, { status });
}

export const optionsHandler = () => new Response(null, { status: 204, headers: CORS_HEADERS });

/**
 * Lit le body JSON. Limite stricte à 1 MB. Retourne `null` + Response 4xx en
 * cas d'échec (à propager directement par le handler appelant).
 */
export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes = 1024 * 1024,
): Promise<{ body: T; error: null } | { body: null; error: Response }> {
  const cl = Number(req.headers.get("content-length") ?? "0");
  if (cl > maxBytes) {
    return {
      body: null,
      error: errorResponse("PAYLOAD_TOO_LARGE", `body must be ≤${maxBytes} bytes`, 413),
    };
  }
  try {
    const txt = await req.text();
    if (!txt.trim()) return { body: {} as T, error: null };
    const parsed = JSON.parse(txt) as T;
    return { body: parsed, error: null };
  } catch {
    return {
      body: null,
      error: errorResponse("BAD_REQUEST", "invalid JSON body", 400),
    };
  }
}

/**
 * Enrobe un handler avec auth Bearer. Tous les endpoints W2B passent par là.
 */
export function withAuth<P extends Record<string, string>>(
  handler: (req: Request & { params: P }) => Promise<Response> | Response,
) {
  return async (req: Request & { params: P }): Promise<Response> => {
    const authError = bearerAuthenticate(req);
    if (authError) return authError;
    try {
      return await handler(req);
    } catch (err) {
      console.error("[api] handler error", err);
      return errorResponse("INTERNAL", err instanceof Error ? err.message : String(err), 500);
    }
  };
}

/** Slug helper — accepts `B_TS4`, `fr/B_TS4`, full URL. */
export function extractSlug(input: string): string {
  let s = input
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^\//, "")
    .replace(/\/+$/, "");
  s = s.replace(/^(fr|en|es|de|ja|pt)\//, "");
  return s;
}
