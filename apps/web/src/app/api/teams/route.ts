/**
 * Équipes — route authentifiée (session better-auth). Hors `/api/v1` (la lecture
 * publique est exposée par `/api/v1/teams`). Tout l'accès DB passe par la DAL.
 *
 *  GET  /api/teams  → équipe + rôle de l'utilisateur connecté + invitations reçues
 *  POST /api/teams  → créer une équipe (le créateur en devient capitaine)
 */
import { TeamCreateInputSchema } from "@rpbey/api-contract";
import { createTeam, getMyInvites, getMyTeam } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const [mine, invites] = await Promise.all([getMyTeam(userId), getMyInvites(userId)]);
    return Response.json({
      ok: true,
      data: { team: mine?.team ?? null, role: mine?.role ?? null, invites },
    });
  } catch (e) {
    return teamErrorResponse(e);
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = TeamCreateInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "bad_request",
            message: parsed.error.issues[0]?.message ?? "Données invalides.",
          },
        },
        { status: 422 },
      );
    }
    const team = await createTeam(userId, parsed.data);
    return Response.json({ ok: true, data: { team } }, { status: 201 });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
