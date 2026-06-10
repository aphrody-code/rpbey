/** POST /api/teams/invites/[inviteId] → répondre à une invitation ({ accept: boolean }). */
import { z } from "zod";
import { respondToInvite } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

const BodySchema = z.object({ accept: z.boolean() });

export async function POST(request: Request, ctx: { params: Promise<{ inviteId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { inviteId } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Champ `accept` requis." } },
        { status: 422 },
      );
    }
    const result = await respondToInvite(userId, inviteId, parsed.data.accept);
    return Response.json({ ok: true, data: result });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
