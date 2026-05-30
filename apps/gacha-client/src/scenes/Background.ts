/**
 * Fond de scène : aurore de marque (rouge ↔ bleu) sous une frame d'anime
 * notable, nette en haute densité. La frame couvre tout le viewport (fitCover),
 * légèrement assombrie + flou de marque pour rester lisible derrière le HUD/les
 * cartes. Pixel-perfect : fitCover snappe la position à la grille device.
 */
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { fetchNotableFrames } from "../net/api";
import { loadFrameTexture } from "../render/assets";
import { fitCover } from "../render/fit";
import { BRAND } from "../theme";

export class Background extends Container {
  private aurora = new Graphics();
  private frameSprite: Sprite | null = null;
  private frameTex: Texture | null = null;
  private scrim = new Graphics();
  private viewW = 0;
  private viewH = 0;

  constructor() {
    super();
    this.label = "background";
    this.addChild(this.aurora);
    this.addChild(this.scrim);
  }

  /** Charge une frame notable aléatoire en tâche de fond (best-effort). */
  async loadFrame(): Promise<void> {
    try {
      const { frames } = await fetchNotableFrames({ limit: 24 });
      if (frames.length === 0) return;
      const pick = frames[Math.floor(Math.random() * frames.length)]!;
      const tex = await loadFrameTexture(pick.imageUrl);
      if (!tex) return;
      this.frameTex = tex;
      const sprite = new Sprite(tex);
      sprite.alpha = 0.55;
      this.frameSprite = sprite;
      // Sous le scrim, au-dessus de l'aurore.
      this.addChildAt(sprite, 1);
      this.layout(this.viewW, this.viewH);
    } catch (err) {
      console.warn("[bg] frame indisponible", err);
    }
  }

  layout(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    if (w <= 0 || h <= 0) return;

    // Aurore : deux disques radiaux de marque aux coins opposés.
    this.aurora.clear();
    this.aurora.rect(0, 0, w, h).fill({ color: BRAND.ink });
    this.aurora
      .circle(w * 0.18, h * 0.12, Math.max(w, h) * 0.55)
      .fill({ color: BRAND.red, alpha: 0.22 });
    this.aurora
      .circle(w * 0.86, h * 0.92, Math.max(w, h) * 0.6)
      .fill({ color: BRAND.blue, alpha: 0.2 });

    if (this.frameSprite && this.frameTex) {
      fitCover(this.frameSprite, {
        texW: this.frameTex.width,
        texH: this.frameTex.height,
        areaW: w,
        areaH: h,
      });
    }

    // Scrim : assombrit le centre/bas pour la lisibilité du contenu.
    this.scrim.clear();
    this.scrim.rect(0, 0, w, h).fill({ color: BRAND.ink, alpha: 0.42 });
  }
}
