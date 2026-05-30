/** PATCH /api/admin/awards/[year] → éditer une édition (vidéo, publication, votes) — staff. */
import { AwardsEditionUpdateInputSchema } from "@rpbey/api-contract";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { updateEdition } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ year: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) {
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  }
  const { year } = await ctx.params;
  const y = Number(year);
  if (!Number.isInteger(y)) {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: "Année invalide." } },
      { status: 422 },
    );
  }
  const raw = await request.json().catch(() => ({}));
  const parsed = AwardsEditionUpdateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: "Données invalides." } },
      { status: 422 },
    );
  }
  await updateEdition(y, parsed.data);
  return Response.json({ ok: true, data: { updated: true } });
}
