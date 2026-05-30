/**
 * HUD : solde (currency), pity, nom du joueur, et les boutons de pull (×1, ×10,
 * daily). Texte via BitmapText eût été idéal pour des updates fréquents, mais le
 * solde change rarement (par pull) → `Text` avec garde de valeur suffit et évite
 * de générer un atlas de glyphes. Boutons = Graphics interactifs (eventMode).
 */
import { Container, Graphics, Text } from "pixi.js";
import { snapDevice } from "../render/fit";
import { BRAND } from "../theme";

export interface HudCallbacks {
  onPull: () => void;
  onPull10: () => void;
  onDaily: () => void;
}

class Button extends Container {
  private bg = new Graphics();
  private labelText = new Text({ text: "", style: { fill: BRAND.text } });
  private baseColor: number;
  private enabled = true;

  constructor(text: string, color: number, onTap: () => void) {
    super();
    this.baseColor = color;
    this.addChild(this.bg);
    this.labelText.text = text;
    this.labelText.anchor.set(0.5);
    this.labelText.roundPixels = true;
    this.addChild(this.labelText);
    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointertap", () => {
      if (this.enabled) onTap();
    });
    this.on("pointerover", () => (this.bg.tint = 0xdddddd));
    this.on("pointerout", () => (this.bg.tint = 0xffffff));
    this.on("pointerdown", () => this.scale.set(0.96));
    this.on("pointerup", () => this.scale.set(1));
    this.on("pointerupoutside", () => this.scale.set(1));
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.alpha = on ? 1 : 0.4;
    this.cursor = on ? "pointer" : "default";
  }

  resize(w: number, h: number, fontSize: number): void {
    this.bg.clear();
    this.bg.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: this.baseColor });
    this.labelText.style.fontSize = fontSize;
    this.labelText.style.fontFamily = "system-ui, sans-serif";
    this.labelText.style.fontWeight = "700";
  }
}

export class Hud extends Container {
  private panel = new Graphics();
  private balanceText: Text;
  private pityText: Text;
  private nameText: Text;
  private statusText: Text;
  private btnPull: Button;
  private btnPull10: Button;
  private btnDaily: Button;
  private viewW = 0;
  private viewH = 0;

  constructor(cb: HudCallbacks) {
    super();
    this.label = "hud";
    this.addChild(this.panel);

    this.nameText = mkText("", BRAND.text, "700");
    this.balanceText = mkText("— 🪙", BRAND.gold, "800");
    this.pityText = mkText("Pity 0", BRAND.muted, "600");
    this.statusText = mkText("", BRAND.muted, "500");
    this.statusText.anchor.set(0.5, 0);
    this.addChild(this.nameText, this.balanceText, this.pityText, this.statusText);

    this.btnPull = new Button("Tirer ×1  (50)", BRAND.red, cb.onPull);
    this.btnPull10 = new Button("Tirer ×10  (450)", BRAND.blue, cb.onPull10);
    this.btnDaily = new Button("Daily", 0x2a2d40, cb.onDaily);
    this.addChild(this.btnPull, this.btnPull10, this.btnDaily);
  }

  setHud(name: string, currency: number, pity: number): void {
    if (this.nameText.text !== name) this.nameText.text = name;
    const bal = `${currency.toLocaleString("fr-FR")} 🪙`;
    if (this.balanceText.text !== bal) this.balanceText.text = bal;
    const pityLabel = `Pity ${pity}`;
    if (this.pityText.text !== pityLabel) this.pityText.text = pityLabel;
  }

  setStatus(msg: string): void {
    this.statusText.text = msg;
    this.layoutStatus();
  }

  setBusy(busy: boolean): void {
    this.btnPull.setEnabled(!busy);
    this.btnPull10.setEnabled(!busy);
    this.btnDaily.setEnabled(!busy);
  }

  layout(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    const pad = Math.max(12, w * 0.03);
    const top = Math.max(10, h * 0.02);

    // Bandeau haut (nom + solde + pity).
    this.panel.clear();
    const barH = snapDevice(Math.max(48, h * 0.08));
    this.panel
      .roundRect(pad, top, w - pad * 2, barH, barH / 2)
      .fill({ color: BRAND.surface, alpha: 0.82 });

    const midY = snapDevice(top + barH / 2);
    this.nameText.anchor.set(0, 0.5);
    this.nameText.position.set(snapDevice(pad + barH * 0.4), midY);
    this.nameText.style.fontSize = Math.max(13, barH * 0.3);

    this.balanceText.anchor.set(1, 0.5);
    this.balanceText.position.set(snapDevice(w - pad - barH * 0.4), midY);
    this.balanceText.style.fontSize = Math.max(14, barH * 0.34);

    this.pityText.anchor.set(0.5, 0.5);
    this.pityText.position.set(snapDevice(w / 2), midY);
    this.pityText.style.fontSize = Math.max(11, barH * 0.26);

    // Boutons en bas.
    const btnH = snapDevice(Math.max(46, h * 0.08));
    const fs = Math.max(13, btnH * 0.34);
    const gap = Math.max(10, w * 0.02);
    const bottomY = snapDevice(h - top - btnH / 2);

    const mainW = Math.min(w - pad * 2, 520);
    const pullW = (mainW - gap) * 0.5;
    this.btnPull.resize(pullW, btnH, fs);
    this.btnPull10.resize(pullW, btnH, fs);
    const leftX = snapDevice(w / 2 - mainW / 2 + pullW / 2);
    const rightX = snapDevice(w / 2 + mainW / 2 - pullW / 2);
    this.btnPull.position.set(leftX, bottomY);
    this.btnPull10.position.set(rightX, bottomY);

    const dailyY = snapDevice(bottomY - btnH - gap);
    this.btnDaily.resize(Math.min(200, mainW * 0.5), btnH * 0.86, fs * 0.92);
    this.btnDaily.position.set(snapDevice(w / 2), dailyY);

    this.layoutStatus();
  }

  private layoutStatus(): void {
    this.statusText.position.set(snapDevice(this.viewW / 2), snapDevice(this.viewH * 0.18));
    this.statusText.style.fontSize = Math.max(12, this.viewH * 0.022);
  }
}

type Weight = "500" | "600" | "700" | "800";

function mkText(text: string, color: number, weight: Weight): Text {
  const t = new Text({
    text,
    style: { fontFamily: "system-ui, sans-serif", fontSize: 16, fill: color, fontWeight: weight },
  });
  t.roundPixels = true;
  return t;
}
