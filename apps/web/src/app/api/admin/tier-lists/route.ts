/** POST /api/admin/tier-lists → créer une tier list — staff. */
import { TierListCreateInputSchema } from "@rpbey/api-contract";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { createTierList } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) {
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  }
  const raw = await request.json().catch(() => ({}));
  const parsed = TierListCreateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalide." },
      },
      { status: 422 },
    );
  }
  const slug = await createTierList(parsed.data, session.user.id);
  return Response.json({ ok: true, data: { slug } }, { status: 201 });
}
