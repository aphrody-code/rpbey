/**
 * POST /api/admin/gacha/economy  — ajuste la currency d'un utilisateur (ADMIN_GIVE / ADMIN_TAKE)
 * GET  /api/admin/gacha/economy  — dernières transactions admin
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { adminAdjustCurrency, listAdminCurrencyTransactions } from "@/server/dal/gacha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId") ?? undefined;
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 50;
  const transactions = await listAdminCurrencyTransactions({ limit, userId });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: { userId: string; amount: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.userId || typeof body.amount !== "number") {
    return NextResponse.json({ error: "userId et amount requis" }, { status: 422 });
  }
  try {
    const result = await adminAdjustCurrency({
      userId: body.userId,
      amount: body.amount,
      note: body.note ?? `Ajustement admin`,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NO_PROFILE") {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
