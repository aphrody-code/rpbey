/**
 *  PATCH  /api/admin/polls/[slug] → éditer (featured/closed/question…) — staff
 *  DELETE /api/admin/polls/[slug] → supprimer — staff
 */
import { PollAdminUpdateInputSchema } from "@rpbey/api-contract";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { deletePoll, updatePollAdmin } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function staff() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user && isStaffUser(session.user) ? session.user : null;
}
function forbidden() {
  return Response.json(
    { ok: false, error: { code: "forbidden", message: "Staff requis." } },
    { status: 403 },
  );
}

export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!(await staff())) return forbidden();
  const { slug } = await ctx.params;
  const raw = await request.json().catch(() => ({}));
  const parsed = PollAdminUpdateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: "Invalide." } },
      { status: 422 },
    );
  }
  await updatePollAdmin(slug, parsed.data);
  return Response.json({ ok: true, data: { updated: true } });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!(await staff())) return forbidden();
  const { slug } = await ctx.params;
  await deletePoll(slug);
  return Response.json({ ok: true, data: { deleted: true } });
}
