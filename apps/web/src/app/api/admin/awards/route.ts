/** GET /api/admin/awards → toutes les éditions (staff). */
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { listAllEditions } from "@/server/dal/polls";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) {
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  }
  return Response.json({ ok: true, data: { editions: await listAllEditions() } });
}
