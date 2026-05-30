/**
 * GET  /api/admin/gacha/drops  — liste tous les drops
 * POST /api/admin/gacha/drops  — crée un drop
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { createGachaDrop, listGachaDrops, type GachaDropInput } from "@/server/dal/gacha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const drops = await listGachaDrops();
  return NextResponse.json(drops);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: GachaDropInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.slug || !body.name || !body.theme || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: "Champs requis : slug, name, theme, startDate, endDate" },
      { status: 422 },
    );
  }
  try {
    const drop = await createGachaDrop(body);
    return NextResponse.json(drop, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
