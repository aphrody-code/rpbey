/**
 *  GET  /api/admin/polls → tout le contenu (sondages + tier lists) — staff
 *  POST /api/admin/polls → créer un sondage — staff
 */
import { PollCreateInputSchema } from "@rpbey/api-contract";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { createPoll, listAdminContent } from "@/server/dal/polls";

async function requireStaffUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isStaffUser(session.user)) return null;
  return session.user;
}

export async function GET() {
  const user = await requireStaffUser();
  if (!user)
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  const data = await listAdminContent();
  return Response.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await requireStaffUser();
  if (!user)
    return Response.json(
      { ok: false, error: { code: "forbidden", message: "Staff requis." } },
      { status: 403 },
    );
  const raw = await request.json().catch(() => ({}));
  const parsed = PollCreateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalide." },
      },
      { status: 422 },
    );
  }
  const slug = await createPoll(parsed.data, user.id);
  return Response.json({ ok: true, data: { slug } }, { status: 201 });
}
