/**
 * GET /api/admin/moderation/tickets — liste paginée des tickets
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { listTickets } from "@/server/dal/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;
  const pageSize = sp.get("pageSize") ? Number(sp.get("pageSize")) : 25;
  const status = sp.get("status") ?? undefined;
  const result = await listTickets({ page, pageSize, status });
  return NextResponse.json(result);
}
