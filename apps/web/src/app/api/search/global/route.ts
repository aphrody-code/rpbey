import { NextResponse } from "next/server";
import { getSearchCorpus } from "@/server/services/search-corpus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Route legacy — conserve la forme `{ success, count, data }` pour le front actuel.
 * La logique vit désormais dans le service partagé `buildGlobalSearchIndex`
 * (également exposé sous `/api/v1/search` avec l'enveloppe standardisée).
 */
export async function GET() {
  try {
    const data = await getSearchCorpus();
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    console.error("Global search API error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
