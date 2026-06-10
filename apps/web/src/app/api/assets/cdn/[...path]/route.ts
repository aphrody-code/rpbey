import { type NextRequest, NextResponse } from "next/server";

/**
 * `GET /api/assets/cdn/<path...>` — proxy same-origin générique de secours pour
 * les assets historiquement servis par `cdn.rpbey.fr` (hors frames fancaps, qui
 * passent par `/api/assets/fancaps/...`). Même principe : **le navigateur ne voit
 * que `rpbey.fr`**, les octets sont récupérés côté serveur depuis `ASSET_ORIGIN`
 * et renvoyés en cache immuable (mise en cache au edge Vercel).
 *
 * Allowlist d'extensions image/média stricte (défense anti-SSRF : pas de
 * traversal, pas d'hôte arbitraire — l'origine est figée serveur-side).
 */

// Origine serveur des octets, configurable par env. L'ancien hôte `cdn.rpbey.fr`
// est DÉCOMMISSIONNÉ : aucun défaut codé en dur. Sans `ASSET_ORIGIN` configuré,
// la route répond 404 (les assets sont rapatriés dans `public/`) plutôt que de
// fetcher un hôte mort.
const ASSET_ORIGIN = (process.env.ASSET_ORIGIN ?? "").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 12_000;
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";
const ALLOWED_EXT = /\.(?:jpe?g|png|webp|gif|svg|avif|mp4|webm|json|glb|woff2?|ttf|otf)$/i;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  // Sans origine d'asset configurée (cdn.rpbey.fr décommissionné), rien à proxifier.
  if (!ASSET_ORIGIN) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { path } = await ctx.params;
  const rel = (path ?? []).join("/");
  // Anti-traversal + allowlist d'extension.
  if (!rel || rel.includes("..") || !ALLOWED_EXT.test(rel)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const upstream = `${ASSET_ORIGIN}/${rel}`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 31_536_000 },
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "upstream_error" }, { status: res.status || 502 });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": IMMUTABLE,
      "X-Asset-Proxy": "cdn",
    },
  });
}
