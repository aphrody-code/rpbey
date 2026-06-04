/**
 * Résolution d'URL d'asset — **self-contained Vercel**, zéro dépendance
 * `cdn.rpbey.fr` au runtime navigateur.
 *
 * Le corpus `data/anime-frames/*.json` (fonds d'ambiance décoratifs) référence
 * historiquement des images `https://cdn.rpbey.fr/fancaps-anime[-full]/<id>.jpg`
 * (re-hébergées dans un bucket Backblaze B2 fronté Cloudflare). Pour supprimer
 * toute dépendance à l'hôte `cdn.rpbey.fr`, on réécrit ces URLs vers une origine
 * servie par NOUS :
 *
 *   - Par défaut (`NEXT_PUBLIC_ASSET_BASE` vide) → route same-origin Vercel
 *     `/api/assets/fancaps/<full|thumb>/<id>.jpg` (cf. `app/api/assets/...`),
 *     qui streame les octets depuis l'origine en cache immuable. Le navigateur ne
 *     voit que `rpbey.fr`.
 *   - Si `NEXT_PUBLIC_ASSET_BASE` est défini (ex. un miroir Vercel Blob), on
 *     préfixe ce base + chemin Vercel-Blob `fancaps/...`.
 *
 * Toute autre URL (wikia, fandom, fancaps.net direct, http(s) tiers) est
 * renvoyée telle quelle.
 */

const CDN_HOST = "cdn.rpbey.fr";

/** Base d'asset configurable (Blob/miroir). Vide → route proxy same-origin. */
const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/$/, "");

/** Maps a `cdn.rpbey.fr` fancaps path → notre chemin canonique `fancaps/<kind>/<id>.jpg`. */
function fancapsCanonical(pathname: string): string | null {
  // /fancaps-anime-full/<id>.jpg  → fancaps/full/<id>.jpg
  // /fancaps-anime/<id>.jpg       → fancaps/thumb/<id>.jpg
  // /fancaps-full/<id>.jpg        → fancaps/full/<id>.jpg
  // /fancaps/<id>.jpg             → fancaps/thumb/<id>.jpg
  const m = pathname.match(/^\/(fancaps(?:-anime)?(?:-full)?)\/([^/]+\.(?:jpg|jpeg|png|webp))$/i);
  if (!m) return null;
  const seg = m[1]!.toLowerCase();
  const file = m[2]!;
  const kind = seg.includes("full") ? "full" : "thumb";
  return `fancaps/${kind}/${file}`;
}

/**
 * Réécrit une URL d'image d'ambiance pour qu'elle résolve depuis NOTRE origine
 * (Vercel) au lieu de `cdn.rpbey.fr`. Idempotent et sûr sur les URLs tierces.
 */
export function rewriteAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // chemin relatif déjà local → tel quel
  }
  if (parsed.hostname !== CDN_HOST) return url; // hôte tiers (wikia/fandom/…) inchangé

  const canonical = fancapsCanonical(parsed.pathname);
  if (canonical) {
    // /api/assets/fancaps/<kind>/<id>.jpg (same-origin) ou base Blob configurée.
    return ASSET_BASE ? `${ASSET_BASE}/${canonical}` : `/api/assets/${canonical}`;
  }

  // Autres assets cdn (ex. /static/...) → route proxy générique same-origin.
  const rest = parsed.pathname.replace(/^\//, "");
  return ASSET_BASE ? `${ASSET_BASE}/${rest}` : `/api/assets/cdn/${rest}`;
}
