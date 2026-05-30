/**
 *  PATCH  /api/teams/[id]  → éditer l'équipe (capitaine / co-capitaine)
 *  DELETE /api/teams/[id]  → dissoudre l'équipe (capitaine uniquement)
 */
import { TeamUpdateInputSchema } from "@rpbey/api-contract";
import { deleteTeam, updateTeam } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = TeamUpdateInputSchema.safeParse(raw);
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
    const team = await updateTeam(userId, id, parsed.data);
    return Response.json({ ok: true, data: { team } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    await deleteTeam(userId, id);
    return Response.json({ ok: true, data: { deleted: true } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
