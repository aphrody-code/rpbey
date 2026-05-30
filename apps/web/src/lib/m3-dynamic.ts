"use client";

// Material You runtime — dérive et applique un thème M3 depuis une couleur seed,
// via @aphrody-code/m3-tokens. Utilisé pour reteinter le knowledge panel autour
// de la couleur dominante du produit affiché (effet « Material You » signature).
import { applyDynamicColor, schemeFromSeed } from "@aphrody-code/m3-tokens/dynamic-color";

export { applyDynamicColor };

// Ensemble des clés de rôle (pour pouvoir révoquer le thème inline proprement).
const ROLE_KEYS = Object.keys(schemeFromSeed("#000000", { dark: true }));

/** Révoque un thème dynamique posé sur `target` (restaure la cascade). */
export function clearDynamicColor(target: HTMLElement | null): void {
  if (!target) return;
  for (const k of ROLE_KEYS) target.style.removeProperty(k);
}

/**
 * Extrait une couleur dominante « vive » d'une image (échantillon 24×24).
 * Retourne `null` si l'image est cross-origin non-CORS (canvas tainted), trop
 * terne, ou en erreur — l'appelant garde alors le thème de marque.
 */
export function dominantColorFromImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || !src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const w = (c.width = 24);
        const h = (c.height = 24);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h); // throws si tainted (CORS)
        let best: [number, number, number] | null = null;
        let bestScore = -1;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          if ((data[i + 3] ?? 0) < 200) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = (max + min) / 2;
          if (lum < 28 || lum > 232) continue; // ignore fonds quasi noir/blanc
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = sat * (1 - Math.abs(lum - 140) / 140);
          if (score > bestScore) {
            bestScore = score;
            best = [r, g, b];
          }
        }
        if (!best || bestScore < 0.18) return resolve(null); // trop terne
        const hex = `#${best.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        resolve(hex);
      } catch {
        resolve(null); // canvas tainted (cross-origin) → fallback marque
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
