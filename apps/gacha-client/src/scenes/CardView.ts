/**
 * Vue d'une carte révélée : image carte (rendu OG du web) cadrée en CONTAIN
 * (aspect préservé, pixel-perfect), bordure colorée par rareté, étoiles, et FX
 * (halo, shine holographique, particules) modulés par la rareté.
 *
 * La carte OG fait 640×960 (ratio 2:3). On la charge en linear+mipmaps pour un
 * downscale net, et on la cadre dans un rectangle 2:3 calculé à la taille voulue.
 */
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { cardImageUrl } from "../net/api";
import { loadCardTexture } from "../render/assets";
import { snapDevice } from "../render/fit";
import { Ease, type Tweener } from "../render/tween";
import { BRAND, rarityTheme } from "../theme";
import { type GachaGameCard, normalizeRarity, type Rarity } from "../types";

const CARD_RATIO = 640 / 960; // largeur / hauteur

export class CardView extends Container {
  private halo = new Graphics();
  private frame = new Graphics();
  private shine = new Graphics();
  private artSprite: Sprite | null = null;
  private artMask = new Graphics();
  private stars = new Container();
  private rarity: Rarity = "COMMON";
  private cardW = 0;
  private cardH = 0;
  private shinePhase = 0;

  constructor() {
    super();
    this.label = "card-view";
    this.addChild(this.halo);
    this.addChild(this.frame);
    this.addChild(this.artMask);
    this.addChild(this.shine);
    this.addChild(this.stars);
  }

  /** (Re)construit la carte à la hauteur cible (px CSS). */
  async setCard(card: GachaGameCard | null, targetHeight: number): Promise<void> {
    this.rarity = normalizeRarity(card?.rarity);
    this.cardH = snapDevice(targetHeight);
    this.cardW = snapDevice(this.cardH * CARD_RATIO);
    this.drawFrame();
    this.drawStars();
    this.drawHalo();
    await this.loadArt(card);
  }

  private async loadArt(card: GachaGameCard | null): Promise<void> {
    if (this.artSprite) {
      this.removeChild(this.artSprite);
      this.artSprite.destroy();
      this.artSprite = null;
    }
    const src = card?.imageUrl || (card ? cardImageUrl(card.id) : null);
    if (!src) return;
    const tex: Texture | null = await loadCardTexture(src);
    if (!tex) return;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    // CONTAIN dans le cadre intérieur (marge de 6 px CSS pour la bordure).
    const innerW = this.cardW - 12;
    const innerH = this.cardH - 12;
    const scale = Math.min(innerW / tex.width, innerH / tex.height);
    sprite.scale.set(scale);
    sprite.position.set(0, 0);
    sprite.roundPixels = true;

    // Masque arrondi pour que l'art respecte les coins de la carte.
    this.artMask.clear();
    this.artMask.roundRect(-innerW / 2, -innerH / 2, innerW, innerH, 14).fill({ color: 0xffffff });
    sprite.mask = this.artMask;

    this.artSprite = sprite;
    // Sous la bordure/shine, au-dessus du halo.
    this.addChildAt(sprite, 2);
  }

  private drawHalo(): void {
    const t = rarityTheme(this.rarity);
    this.halo.clear();
    const r = (Math.max(this.cardW, this.cardH) / 2) * (1 + t.intensity);
    // Halo radial approximé par anneaux concentriques décroissants.
    const rings = 5;
    for (let i = rings; i >= 1; i--) {
      const frac = i / rings;
      this.halo
        .circle(0, 0, r * frac)
        .fill({ color: t.color, alpha: 0.05 * t.intensity * (1.2 - frac) });
    }
  }

  private drawFrame(): void {
    const t = rarityTheme(this.rarity);
    this.frame.clear();
    // Fond carte.
    this.frame
      .roundRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 18)
      .fill({ color: BRAND.surface });
    // Bordure colorée rareté (double trait pour SR+).
    this.frame
      .roundRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 18)
      .stroke({ width: 3, color: t.color, alpha: 0.95 });
    if (t.intensity >= 0.7) {
      this.frame
        .roundRect(-this.cardW / 2 + 4, -this.cardH / 2 + 4, this.cardW - 8, this.cardH - 8, 14)
        .stroke({ width: 1.5, color: t.accent, alpha: 0.6 });
    }
    this.shine.clear();
  }

  private drawStars(): void {
    this.stars.removeChildren();
    const t = rarityTheme(this.rarity);
    const txt = new Text({
      text: "★".repeat(t.stars),
      style: {
        fontFamily: "system-ui, sans-serif",
        fontSize: Math.max(14, this.cardH * 0.05),
        fill: t.accent,
        fontWeight: "700",
      },
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    txt.position.set(0, this.cardH / 2 + Math.max(14, this.cardH * 0.05));
    this.stars.addChild(txt);
  }

  /** Shine holographique animé (bande diagonale qui balaie la carte). */
  tickShine(deltaMS: number): void {
    const t = rarityTheme(this.rarity);
    if (t.intensity < 0.4) return; // pas de shine sur common/rare faible
    this.shinePhase = (this.shinePhase + deltaMS * 0.0004) % 1;
    const x = (-0.5 + this.shinePhase * 1.5) * this.cardW;
    this.shine.clear();
    this.shine
      .moveTo(x, -this.cardH / 2)
      .lineTo(x + this.cardW * 0.18, -this.cardH / 2)
      .lineTo(x + this.cardW * 0.18 - this.cardH * 0.4, this.cardH / 2)
      .lineTo(x - this.cardH * 0.4, this.cardH / 2)
      .closePath()
      .fill({ color: t.accent, alpha: 0.12 * t.intensity });
    this.shine.mask = this.artMask;
  }

  /** Animation d'entrée (flip-in + pop), résolue à la fin. */
  reveal(tw: Tweener, delay = 0): Promise<void> {
    this.scale.set(0.6);
    this.alpha = 0;
    this.rotation = -0.08;
    const fade = tw.add({
      duration: 280,
      delay,
      ease: Ease.outCubic,
      onUpdate: (v) => (this.alpha = v),
    });
    const pop = tw.add({
      duration: 520,
      delay,
      ease: Ease.outBack,
      onUpdate: (v) => {
        this.scale.set(0.6 + 0.4 * v);
        this.rotation = -0.08 * (1 - v);
      },
    });
    return Promise.all([fade, pop]).then(() => {});
  }
}
