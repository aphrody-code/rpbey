/** POST /api/teams/leave → quitter son équipe (transfert/dissolution auto si capitaine). */
import { leaveTeam } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    await leaveTeam(userId);
    return Response.json({ ok: true, data: { left: true } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
