/** POST /api/teams/[id]/invite → inviter un joueur (capitaine / co-capitaine). */
import { TeamInviteInputSchema } from "@rpbey/api-contract";
import { inviteToTeam } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = TeamInviteInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Données invalides." } },
        { status: 422 },
      );
    }
    await inviteToTeam(userId, id, parsed.data.userId, parsed.data.message ?? null);
    return Response.json({ ok: true, data: { invited: true } }, { status: 201 });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
