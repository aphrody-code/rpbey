import { NextResponse } from "next/server";
import { getSearchCorpus } from "@/server/services/search-corpus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Index de recherche unifié `{ success, count, data }` — chargé UNE fois par la
 * page /search puis ranké 100 % côté client (résultats instantanés, zéro
 * aller-retour par frappe). La logique vit dans `buildGlobalSearchIndex`
 * (également exposé sous `/api/v1/search` avec l'enveloppe standardisée).
 *
 * Mise en cache CDN + navigateur : le corpus évolue lentement (memo serveur 60 s,
 * Redis 1 h) et il est identique pour tous → on le rend cacheable pour que le
 * chargement de l'index (~1 Mo brotli) soit instantané en visite répétée /
 * navigation SPA (Vercel edge HIT au lieu de re-streamer à chaque montage).
 */
const INDEX_CACHE_CONTROL = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  try {
    const data = await getSearchCorpus();
    return NextResponse.json(
      { success: true, count: data.length, data },
      { headers: { "Cache-Control": INDEX_CACHE_CONTROL } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    console.error("Global search API error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
