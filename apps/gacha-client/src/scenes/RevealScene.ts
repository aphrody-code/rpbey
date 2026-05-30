/**
 * Scène de révélation. Affiche soit une carte unique (pull ×1) centrée avec FX,
 * soit une grille de cartes (pull ×10). Coordonne CardView + Particles + Tweener.
 *
 * Le burst de particules SR+ est déclenché à la fin de la révélation de chaque
 * carte concernée (couleur = thème de rareté).
 */
import { Container, Graphics, Text, type Renderer } from "pixi.js";
import { snapDevice } from "../render/fit";
import { Ease, type Tweener } from "../render/tween";
import { BRAND, rarityTheme } from "../theme";
import { type GachaGameCard, isSrPlus, normalizeRarity, type PullResult } from "../types";
import { CardView } from "./CardView";
import { Particles } from "./Particles";

export class RevealScene extends Container {
  private scrim = new Graphics();
  private cardsLayer = new Container();
  private particles = new Particles();
  private hint: Text;
  private viewW = 0;
  private viewH = 0;
  private active: CardView[] = [];
  private onDismiss?: () => void;

  constructor(
    private readonly tw: Tweener,
    private readonly renderer: Renderer,
  ) {
    super();
    this.label = "reveal";
    this.visible = false;
    this.eventMode = "static";
    this.addChild(this.scrim);
    this.addChild(this.cardsLayer);
    this.addChild(this.particles);
    this.hint = new Text({
      text: "Touchez pour continuer",
      style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fill: BRAND.muted },
    });
    this.hint.anchor.set(0.5);
    this.hint.alpha = 0;
    this.addChild(this.hint);

    this.on("pointertap", () => this.dismiss());
  }

  layout(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.scrim.clear();
    this.scrim.rect(0, 0, w, h).fill({ color: BRAND.ink, alpha: 0.86 });
    this.hint.position.set(snapDevice(w / 2), snapDevice(h - Math.max(30, h * 0.06)));
  }

  /** Révèle une carte unique. */
  async showSingle(result: PullResult): Promise<void> {
    this.beginShow();
    const cardH = Math.min(this.viewH * 0.62, (this.viewW * 0.62) / (640 / 960));
    const cv = new CardView();
    cv.position.set(snapDevice(this.viewW / 2), snapDevice(this.viewH * 0.46));
    this.cardsLayer.addChild(cv);
    this.active.push(cv);
    await cv.setCard(result.card, cardH);
    await cv.reveal(this.tw, 60);
    this.maybeBurst(result.card, cv.x, cv.y);
    this.showHint();
  }

  /** Révèle une grille de cartes (pull ×10). */
  async showGrid(results: PullResult[]): Promise<void> {
    this.beginShow();
    const cards = results.filter((r) => r.card);
    const cols = cards.length <= 5 ? cards.length : 5;
    const rows = Math.ceil(cards.length / cols);
    const gap = Math.max(8, this.viewW * 0.015);
    const areaW = this.viewW * 0.92;
    const cellW = (areaW - gap * (cols - 1)) / cols;
    const cardH = cellW / (640 / 960);
    const totalH = cardH * rows + gap * (rows - 1);
    const startY = (this.viewH - totalH) / 2 + cardH / 2;
    const startX = (this.viewW - areaW) / 2 + cellW / 2;

    const reveals: Promise<void>[] = [];
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cv = new CardView();
      cv.position.set(
        snapDevice(startX + col * (cellW + gap)),
        snapDevice(startY + row * (cardH + gap)),
      );
      this.cardsLayer.addChild(cv);
      this.active.push(cv);
      await cv.setCard(r.card, cardH);
      const delay = i * 90;
      reveals.push(cv.reveal(this.tw, delay).then(() => this.maybeBurst(r.card, cv.x, cv.y)));
    }
    await Promise.all(reveals);
    this.showHint();
  }

  private beginShow(): void {
    this.clearCards();
    this.visible = true;
    this.alpha = 0;
    this.hint.alpha = 0;
    void this.tw.add({
      duration: 220,
      ease: Ease.outCubic,
      onUpdate: (v) => (this.alpha = v),
    });
  }

  private maybeBurst(card: GachaGameCard | null, x: number, y: number): void {
    if (!card) return;
    const rarity = normalizeRarity(card.rarity);
    if (!isSrPlus(rarity)) return;
    const t = rarityTheme(rarity);
    const count = Math.round(40 + t.intensity * 120);
    this.particles.burst(this.renderer, x, y, t.color, count);
  }

  private showHint(): void {
    void this.tw.add({
      duration: 400,
      delay: 200,
      ease: Ease.outCubic,
      onUpdate: (v) => (this.hint.alpha = v),
    });
  }

  /** Avance FX (shine + particules). À appeler chaque frame. */
  update(deltaMS: number): void {
    if (!this.visible) return;
    for (const cv of this.active) cv.tickShine(deltaMS);
    this.particles.update(deltaMS);
  }

  onceDismissed(cb: () => void): void {
    this.onDismiss = cb;
  }

  private dismiss(): void {
    if (!this.visible) return;
    void this.tw
      .add({ duration: 200, ease: Ease.inCubic, onUpdate: (v) => (this.alpha = 1 - v) })
      .then(() => {
        this.visible = false;
        this.clearCards();
        this.onDismiss?.();
      });
  }

  private clearCards(): void {
    for (const cv of this.active) {
      this.cardsLayer.removeChild(cv);
      cv.destroy({ children: true });
    }
    this.active.length = 0;
    this.particles.clear();
  }
}
