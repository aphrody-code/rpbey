/** GET /api/teams/search-users?q=… → joueurs sans équipe (sélecteur d'invitation). */
import { searchInvitableUsers } from "@/server/dal/teams";
import { currentUserId, teamErrorResponse, unauthorized } from "@/server/api/teams-http";

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const users = await searchInvitableUsers(q, 10);
    return Response.json({ ok: true, data: { users } });
  } catch (e) {
    return teamErrorResponse(e);
  }
}
