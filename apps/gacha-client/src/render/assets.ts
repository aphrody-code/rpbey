/**
 * Chargement des textures via `Assets.load` (PixiJS v8). Deux profils :
 *
 *  - `loadFrameTexture` (anime/photographique) → scaleMode "linear" +
 *    `autoGenerateMipmaps: true`. Le downscale d'une frame HD (1280×720) vers la
 *    taille viewport passe par les mip-levels → pas de scintillement/aliasing,
 *    bords lisses. C'est le défaut pour TOUT ce qui est capture d'anime.
 *
 *  - `loadPixelTexture` (rétro / pixel-art) → scaleMode "nearest", pas de
 *    mipmaps : chaque texel reste net et carré à l'upscale, look rétro voulu.
 *
 * `Texture.from(url)` ne télécharge PAS en v8 (lit seulement le cache) → on
 * passe TOUJOURS par `Assets.load`. Les URL de frames n'ont pas forcément
 * d'extension (proxy) → on force `parser: "texture"`.
 */
import { Assets, type Texture } from "pixi.js";

const inflight = new Map<string, Promise<Texture | null>>();

async function load(
  url: string,
  scaleMode: "linear" | "nearest",
  mipmaps: boolean,
): Promise<Texture | null> {
  const key = `${scaleMode}:${url}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = Assets.load<Texture>({
    src: url,
    parser: "texture",
    data: { scaleMode, autoGenerateMipmaps: mipmaps },
  })
    .then((tex) => tex ?? null)
    .catch((err: unknown) => {
      console.warn("[assets] échec chargement", url, err);
      return null;
    });

  inflight.set(key, p);
  return p;
}

/** Frame d'anime (photographique) : linear + mipmaps → downscale propre. */
export function loadFrameTexture(url: string): Promise<Texture | null> {
  return load(url, "linear", true);
}

/** Image carte (rendu OG photographique) : linear + mipmaps. */
export function loadCardTexture(url: string): Promise<Texture | null> {
  return load(url, "linear", true);
}

/** Texture rétro / pixel-art : nearest, pas de mipmaps → upscale net. */
export function loadPixelTexture(url: string): Promise<Texture | null> {
  return load(url, "nearest", false);
}

/** Libère une texture (et sa source GPU) si plus utilisée. */
export function unloadTexture(url: string): void {
  for (const mode of ["linear", "nearest"] as const) {
    inflight.delete(`${mode}:${url}`);
  }
  void Assets.unload(url).catch(() => {});
}
