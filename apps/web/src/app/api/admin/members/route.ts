/** GET /api/admin/members?q= → annuaire membres Discord + communauté X (staff). */
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { listDiscordMembers, listXMembers } from "@/server/dal/polls";

const X_COMMUNITY_URL = "https://x.com/i/communities/1809671339109658814";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) {
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const [discord, x] = await Promise.all([listDiscordMembers(q), listXMembers(q)]);
  return Response.json({ ok: true, data: { discord, x, xCommunityUrl: X_COMMUNITY_URL } });
}
