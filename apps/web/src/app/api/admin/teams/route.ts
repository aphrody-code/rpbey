/**
 * GET /api/admin/teams — liste toutes les équipes (admin)
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { listAdminTeams } from "@/server/dal/teams";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;
  const pageSize = sp.get("pageSize") ? Number(sp.get("pageSize")) : 25;
  const search = sp.get("search") ?? "";
  const result = await listAdminTeams({ page, pageSize, search });
  return NextResponse.json(result);
}
