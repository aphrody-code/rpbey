import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isAllowedImageHost } from "@/lib/img-proxy";
import { removeUniformLightBackground } from "@/server/services/image-bg";

/**
 * `GET /api/img?u=<url>` — proxy de détourage d'images produits scrappées.
 *
 * Récupère l'image distante (hôte **allowlisté**, défense anti-SSRF), retire le
 * fond de studio clair (`removeUniformLightBackground`), met en cache disque le
 * WebP transparent et le sert avec un cache navigateur immortel. Lazy : seules
 * les images réellement affichées sont traitées, puis servies instantanément.
 *
 * Dégradation gracieuse : hôte refusé → 403 ; fetch KO / image non détourable
 * (déjà transparente, fond non uniforme) → redirection 302 vers l'original
 * (l'image s'affiche quand même). Un marqueur `.skip` évite de retraiter.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_DIR = process.env.RPBEY_IMG_CACHE ?? join(homedir(), ".cache", "rpbey-img");
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo : au-delà ce n'est pas une vignette produit
const FETCH_TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const WEBP_HEADERS = {
  "Content-Type": "image/webp",
  "Cache-Control": "public, max-age=31536000, immutable",
};

/** `Uint8Array` adossé à un `ArrayBuffer` (BodyInit valide ; le Buffer Node, backé
 *  par un `ArrayBufferLike`, n'en est pas un). */
function bytes(b: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(b);
}

/** Redirection vers l'image d'origine (fond non retiré) avec cache modéré. */
function passthrough(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "public, max-age=86400" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new Response("bad protocol", { status: 400 });
  }
  if (!isAllowedImageHost(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  const key = createHash("sha256").update(u).digest("hex").slice(0, 32);
  const file = join(CACHE_DIR, `${key}.webp`);
  const skipMarker = join(CACHE_DIR, `${key}.skip`);

  // Cache hit.
  try {
    if (existsSync(file))
      return new Response(bytes(await readFile(file)), { headers: WEBP_HEADERS });
    if (existsSync(skipMarker)) return passthrough(u);
  } catch {
    // cache illisible → on régénère
  }

  // Récupération + détourage.
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return passthrough(u);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return passthrough(u);

    const out = await removeUniformLightBackground(buf);
    await mkdir(CACHE_DIR, { recursive: true });
    if (!out) {
      await writeFile(skipMarker, "");
      return passthrough(u);
    }
    await writeFile(file, out);
    return new Response(bytes(out), { headers: WEBP_HEADERS });
  } catch {
    return passthrough(u);
  }
}
