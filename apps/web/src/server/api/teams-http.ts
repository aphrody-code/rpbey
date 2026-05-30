import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { TeamError } from "@/server/dal/teams";

/** Session better-auth de la requête courante, ou null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** Réponse 401 enveloppée standard. */
export function unauthorized(): Response {
  return Response.json(
    { ok: false, error: { code: "unauthorized", message: "Connexion requise." } },
    { status: 401 },
  );
}

/** Mappe une `TeamError` (ou erreur inconnue) vers une réponse enveloppée. */
export function teamErrorResponse(e: unknown): Response {
  if (e instanceof TeamError) {
    const status =
      e.code === "not_found"
        ? 404
        : e.code === "forbidden"
          ? 403
          : e.code === "conflict" || e.code === "already_in_team" || e.code === "tag_taken"
            ? 409
            : 400;
    return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status });
  }
  console.error("[api/teams] error:", e);
  return Response.json(
    { ok: false, error: { code: "internal", message: "Erreur interne" } },
    { status: 500 },
  );
}
