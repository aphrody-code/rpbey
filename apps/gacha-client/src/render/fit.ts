/**
 * Helpers de placement PIXEL-PERFECT pour les frames d'anime (aspect natif
 * 16:9 = 1280×720, mais on lit l'aspect réel de la texture). Le but : afficher
 * une frame photographique nette en haute densité (DPR), SANS déformation, et en
 * snappant la géométrie à la grille de pixels DEVICE.
 *
 * Garanties pixel-perfect (cf. main.ts pour resolution/autoDensity) :
 *  1. L'Application est initialisée avec `resolution = devicePixelRatio` +
 *     `autoDensity = true` → 1 unité scène = 1 px CSS, le renderer dessine en px
 *     device. `roundPixels = true` (global) aligne chaque quad sur l'entier.
 *  2. fitCover/fitContain calculent un scale uniforme (même facteur X/Y) →
 *     ratio préservé, jamais d'étirement.
 *  3. La position finale est arrondie à l'entier de pixel DEVICE puis reconvertie
 *     en px CSS (`snapDevice`) — un offset fractionnaire de DPR causerait un
 *     filtrage bilinéaire flou ; on l'élimine.
 *  4. Les textures de frames sont chargées en scaleMode "linear" + mipmaps
 *     (assets.ts) → downscale propre, zéro scintillement à l'aliasing.
 */
import type { Sprite } from "pixi.js";

/** DPR effectif utilisé pour le snapping (clampé pour rester raisonnable). */
export function dpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 4));
}

/**
 * Arrondit une coordonnée CSS sur la grille de pixels DEVICE.
 * Exemple DPR=2 : 100.3 px CSS → 200.6 px device → 201 px device → 100.5 px CSS.
 * Le sprite tombe ainsi exactement sur un pixel physique → bord net.
 */
export function snapDevice(cssValue: number, ratio = dpr()): number {
  return Math.round(cssValue * ratio) / ratio;
}

interface FitOpts {
  /** Largeur de la texture source (px). */
  texW: number;
  /** Hauteur de la texture source (px). */
  texH: number;
  /** Largeur de la zone cible (px CSS). */
  areaW: number;
  /** Hauteur de la zone cible (px CSS). */
  areaH: number;
  /** Origine X de la zone cible (px CSS). 0 par défaut. */
  areaX?: number;
  /** Origine Y de la zone cible (px CSS). 0 par défaut. */
  areaY?: number;
}

/**
 * COVER : remplit toute la zone (déborde sur l'axe long, recentré). Idéal pour
 * un background plein écran : pas de letterbox, mais on perd les marges.
 */
export function fitCover(sprite: Sprite, opts: FitOpts): void {
  apply(sprite, opts, Math.max);
}

/**
 * CONTAIN : la frame entière tient dans la zone (letterbox sur l'axe court).
 * Idéal pour montrer la frame complète (carte, focus) sans rogner.
 */
export function fitContain(sprite: Sprite, opts: FitOpts): void {
  apply(sprite, opts, Math.min);
}

function apply(sprite: Sprite, opts: FitOpts, choose: (a: number, b: number) => number): void {
  const { texW, texH, areaW, areaH, areaX = 0, areaY = 0 } = opts;
  if (texW <= 0 || texH <= 0 || areaW <= 0 || areaH <= 0) return;

  const ratio = dpr();
  // Scale uniforme → aspect natif strictement préservé.
  const scale = choose(areaW / texW, areaH / texH);
  sprite.anchor.set(0.5);
  sprite.scale.set(scale);

  // Centre de la zone, snappé à la grille device pour un rendu net.
  const cx = snapDevice(areaX + areaW / 2, ratio);
  const cy = snapDevice(areaY + areaH / 2, ratio);
  sprite.position.set(cx, cy);
  sprite.roundPixels = true;
}

/**
 * Aspect cible 16:9 (1280×720) : renvoie le plus grand rectangle 16:9 centré
 * dans la zone donnée. Utile pour cadrer une scène en respectant le format anime
 * même quand le viewport Discord est carré ou portrait.
 */
export function rect16x9(
  areaW: number,
  areaH: number,
): { x: number; y: number; w: number; h: number } {
  const target = 16 / 9;
  let w = areaW;
  let h = w / target;
  if (h > areaH) {
    h = areaH;
    w = h * target;
  }
  const ratio = dpr();
  return {
    x: snapDevice((areaW - w) / 2, ratio),
    y: snapDevice((areaH - h) / 2, ratio),
    w: snapDevice(w, ratio),
    h: snapDevice(h, ratio),
  };
}
