/**
 * Orchestrateur : initialise l'Application PixiJS pixel-perfect, monte les scènes
 * (fond / HUD / révélation), authentifie (Discord ou mock), rejoint la room
 * Colyseus, et câble les actions de pull.
 *
 * Pixel-perfect — l'init applique :
 *   resolution = devicePixelRatio (rendu en px device, image nette en HD),
 *   autoDensity = true            (canvas dimensionné en px CSS),
 *   antialias = true, roundPixels = true (alignement entier des quads),
 *   preference = "webgl", backgroundAlpha = 1.
 * Combiné aux helpers fitCover/fitContain (scale uniforme + snap device) et au
 * scaleMode linear+mipmaps des frames, les captures d'anime s'affichent sans
 * déformation ni scintillement à toute densité.
 */
import { Application, type Renderer, TextureStyle } from "pixi.js";
import { authenticate, type Session } from "./net/auth";
import { api, setBearer } from "./net/api";
import { GachaRoomClient } from "./net/room";
import { dpr } from "./render/fit";
import { Tweener } from "./render/tween";
import { Background } from "./scenes/Background";
import { Hud } from "./scenes/Hud";
import { RevealScene } from "./scenes/RevealScene";
import { rarityTheme } from "./theme";
import { type DailyResult, type MultiPullResult, normalizeRarity, type PullResult } from "./types";

export class GachaApp {
  private app = new Application();
  private tw = new Tweener();
  private bg!: Background;
  private hud!: Hud;
  private reveal!: RevealScene;
  private room!: GachaRoomClient;
  private session: Session | null = null;
  private busy = false;
  private name = "Blader";

  async start(mount: HTMLElement): Promise<void> {
    // Filtrage par défaut linéaire (cohérent avec les frames photographiques).
    TextureStyle.defaultOptions.scaleMode = "linear";

    await this.app.init({
      resizeTo: window,
      resolution: dpr(),
      autoDensity: true,
      antialias: true,
      backgroundAlpha: 1,
      preference: "webgl",
      roundPixels: true,
    });
    mount.appendChild(this.app.canvas);

    const renderer = this.app.renderer as Renderer;

    this.bg = new Background();
    this.app.stage.addChild(this.bg);

    this.hud = new Hud({
      onPull: () => void this.doPull(),
      onPull10: () => void this.doPull10(),
      onDaily: () => void this.doDaily(),
    });
    this.app.stage.addChild(this.hud);

    this.reveal = new RevealScene(this.tw, renderer);
    this.reveal.onceDismissed(() => this.hud.setBusy(false));
    this.app.stage.addChild(this.reveal);

    this.app.ticker.add(this.tw.update);
    this.app.ticker.add((t) => this.reveal.update(t.deltaMS));

    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Fond (best-effort, asynchrone).
    void this.bg.loadFrame();

    await this.boot();
  }

  private resize(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.bg.layout(w, h);
    this.hud.layout(w, h);
    this.reveal.layout(w, h);
  }

  private async boot(): Promise<void> {
    try {
      this.session = await authenticate();
      this.name = this.session.name;
      setBearer(this.session.bearer);
      this.hud.setHud(this.name, 0, 0);

      this.room = new GachaRoomClient({
        onHud: (hud) => {
          this.name = hud.name || this.name;
          this.hud.setHud(this.name, hud.currency, hud.pity);
        },
        onPull: (r) => void this.onPullResult(r),
        onDaily: (r) => this.onDailyResult(r),
        onError: (msg) => {
          this.hud.setStatus(msg);
          this.hud.setBusy(false);
          this.busy = false;
        },
      });
      await this.room.join(this.session.jwt, this.session.userId, this.session.channelId);
      this.room.refreshBalance();
      finishBoot();
    } catch (err) {
      this.hud.setStatus(`Erreur: ${(err as Error).message}`);
      finishBoot();
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────────

  private async doPull(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.hud.setBusy(true);
    this.hud.setStatus("");
    if (this.room.connected) {
      this.room.pull(); // réponse via onPull
    } else {
      try {
        const r = await api.pull();
        await this.onPullResult(r);
      } catch (err) {
        this.fail(err);
      }
    }
  }

  private async doPull10(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.hud.setBusy(true);
    this.hud.setStatus("");
    try {
      const r: MultiPullResult = await api.pull10();
      this.hud.setHud(this.name, r.newBalance, 0);
      await this.reveal.showGrid(r.results);
      this.room.refreshBalance();
      // setBusy(false) au dismiss.
    } catch (err) {
      this.fail(err);
    }
  }

  private async doDaily(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.hud.setBusy(true);
    if (this.room.connected) {
      this.room.daily();
    } else {
      try {
        const r = await api.daily();
        this.onDailyResult(r);
      } catch (err) {
        this.fail(err);
      }
    }
  }

  private async onPullResult(r: PullResult): Promise<void> {
    this.hud.setHud(this.name, r.newBalance, r.pityCount);
    const rarity = r.rarity ? normalizeRarity(r.rarity) : null;
    if (rarity) this.hud.setStatus(`${rarityTheme(rarity).label} !`);
    await this.reveal.showSingle(r);
    // busy levé au dismiss de la scène.
  }

  private onDailyResult(r: DailyResult): void {
    this.hud.setHud(this.name, r.newBalance, 0);
    this.hud.setStatus(r.message || `+${r.totalGain} 🪙 (streak ${r.streakAfter})`);
    this.busy = false;
    this.hud.setBusy(false);
  }

  private fail(err: unknown): void {
    this.hud.setStatus(`Erreur: ${(err as Error).message}`);
    this.busy = false;
    this.hud.setBusy(false);
  }
}

function finishBoot(): void {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.classList.add("hidden");
    setTimeout(() => boot.remove(), 500);
  }
}
