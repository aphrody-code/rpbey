import { type NextRequest, NextResponse } from "next/server";

/**
 * `GET /api/assets/fancaps/<full|thumb>/<id>.jpg`
 *
 * Proxy same-origin des frames d'animé décoratives (fonds d'ambiance). Le but :
 * **le navigateur ne dépend QUE de `rpbey.fr`** — plus jamais de `cdn.rpbey.fr`
 * au runtime. La route récupère les octets côté serveur depuis l'origine d'asset
 * (`ASSET_ORIGIN`, B2/Cloudflare en interne) et les renvoie avec un cache
 * **immuable** : Vercel met en cache au edge (`s-maxage` + `immutable`), l'origine
 * n'est sollicitée qu'une fois par image, puis tout est servi depuis Vercel.
 *
 * `ASSET_ORIGIN` est une variable **serveur-only** (jamais exposée au client).
 * Défaut : l'origine historique. La changer (ex. vers un bucket dédié) ne touche
 * pas le code client.
 */

// Cache HTTP géré par les headers (immutable). On laisse Next router/cacher.

/**
 * Origine serveur des octets (jamais vue par le navigateur), configurable par env.
 * L'ancien hôte `cdn.rpbey.fr` est DÉCOMMISSIONNÉ : aucun défaut codé en dur.
 * Sans `ASSET_ORIGIN` (ex. bucket B2/Cloudflare), la route répond 404 et les
 * fonds d'ambiance décoratifs dégradent proprement.
 */
const ASSET_ORIGIN = (process.env.ASSET_ORIGIN ?? "").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 12_000;

const KIND_TO_PREFIX: Record<string, string> = {
  full: "fancaps-anime-full",
  thumb: "fancaps-anime",
};

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ kind: string; file: string }> },
) {
  // Sans origine d'asset configurée (cdn.rpbey.fr décommissionné), rien à proxifier.
  if (!ASSET_ORIGIN) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { kind, file } = await ctx.params;
  const prefix = KIND_TO_PREFIX[kind];
  // Garde-fou : seuls `full`/`thumb` + un nom de fichier image simple sont acceptés.
  if (!prefix || !/^[\w-]+\.(?:jpg|jpeg|png|webp)$/i.test(file)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const upstream = `${ASSET_ORIGIN}/${prefix}/${file}`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Cache de fetch Next : revalidation longue côté data-cache, le edge gère le reste.
      next: { revalidate: 31_536_000 },
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "upstream_error" }, { status: res.status || 502 });
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": IMMUTABLE,
      "X-Asset-Proxy": "fancaps",
    },
  });
}
