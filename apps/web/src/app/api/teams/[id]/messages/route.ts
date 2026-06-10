/**
 *  GET  /api/teams/[id]/messages?before=ISO&limit=N  → chat d'équipe (membres)
 *  POST /api/teams/[id]/messages                     → poster un message / partage
 */
import { TeamMessageInputSchema } from "@rpbey/api-contract";
import { getMessages, isTeamMember, postMessage } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    if (!(await isTeamMember(userId, id))) {
      return Response.json(
        { ok: false, error: { code: "forbidden", message: "Réservé aux membres." } },
        { status: 403 },
      );
    }
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const limitRaw = Number(url.searchParams.get("limit") ?? "40");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 40;
    const data = await getMessages(id, { limit, before });
    return Response.json({ ok: true, data });
  } catch (e) {
    return teamErrorResponse(e);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = TeamMessageInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Message invalide." } },
        { status: 422 },
      );
    }
    const message = await postMessage(userId, id, {
      content: parsed.data.content,
      kind: parsed.data.kind,
      refId: parsed.data.refId ?? null,
    });
    return Response.json({ ok: true, data: { message } }, { status: 201 });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
