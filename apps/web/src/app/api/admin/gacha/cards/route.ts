/**
 * GET  /api/admin/gacha/cards  — liste toutes les cartes (filtres: search, rarity, dropId, activeOnly, page)
 * POST /api/admin/gacha/cards  — crée une carte
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { createGachaCard, listGachaCards, type GachaCardInput } from "@/server/dal/gacha";
import type { CardRarity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const result = await listGachaCards({
    search: sp.get("search") ?? undefined,
    rarity: (sp.get("rarity") as CardRarity) || undefined,
    dropId: sp.get("dropId") ?? undefined,
    activeOnly: sp.get("activeOnly") === "true" ? true : undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 100,
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: GachaCardInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.slug || !body.name || !body.series || !body.rarity) {
    return NextResponse.json(
      { error: "Champs requis : slug, name, series, rarity" },
      { status: 422 },
    );
  }
  try {
    const card = await createGachaCard(body);
    return NextResponse.json(card, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
