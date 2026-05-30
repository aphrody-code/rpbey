/** DELETE /api/admin/tier-lists/[slug] → supprimer une tier list — staff. */
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { deleteTierList } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) {
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  }
  const { slug } = await ctx.params;
  await deleteTierList(slug);
  return Response.json({ ok: true, data: { deleted: true } });
}
