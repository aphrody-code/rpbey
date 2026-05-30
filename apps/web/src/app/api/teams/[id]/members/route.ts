/**
 *  PATCH  /api/teams/[id]/members  → changer rôle / numéro / poste d'un membre
 *  DELETE /api/teams/[id]/members?userId=…  → exclure un membre
 */
import { TeamMemberUpdateInputSchema } from "@rpbey/api-contract";
import { kickMember, updateMember } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = TeamMemberUpdateInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Données invalides." } },
        { status: 422 },
      );
    }
    await updateMember(userId, id, parsed.data.userId, {
      role: parsed.data.role,
      jerseyNumber: parsed.data.jerseyNumber,
      position: parsed.data.position,
    });
    return Response.json({ ok: true, data: { updated: true } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    const targetUserId = new URL(request.url).searchParams.get("userId");
    if (!targetUserId) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "userId requis." } },
        { status: 422 },
      );
    }
    await kickMember(userId, id, targetUserId);
    return Response.json({ ok: true, data: { kicked: true } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
