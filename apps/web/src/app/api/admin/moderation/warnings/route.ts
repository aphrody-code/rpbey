/**
 * GET /api/admin/moderation/warnings — liste paginée des warnings
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { listWarnings } from "@/server/dal/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;
  const pageSize = sp.get("pageSize") ? Number(sp.get("pageSize")) : 25;
  const search = sp.get("search") ?? "";
  const result = await listWarnings({ page, pageSize, search });
  return NextResponse.json(result);
}
