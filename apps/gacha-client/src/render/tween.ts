/**
 * Tweens maison pilotés par le Ticker PixiJS (aucune lib externe). Un Tweener
 * accumule des animations actives et les avance avec `deltaMS` chaque frame.
 * Suffisant pour les FX de révélation (fade, scale, translate, pulse).
 */
import type { Ticker } from "pixi.js";

export type Easing = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} satisfies Record<string, Easing>;

interface Anim {
  elapsed: number;
  duration: number;
  delay: number;
  ease: Easing;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
  done: boolean;
}

export interface TweenOpts {
  duration: number;
  delay?: number;
  ease?: Easing;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
}

export class Tweener {
  private anims: Anim[] = [];

  add(opts: TweenOpts): Promise<void> {
    return new Promise((resolve) => {
      this.anims.push({
        elapsed: 0,
        duration: Math.max(1, opts.duration),
        delay: opts.delay ?? 0,
        ease: opts.ease ?? Ease.linear,
        onUpdate: opts.onUpdate,
        onComplete: () => {
          opts.onComplete?.();
          resolve();
        },
        done: false,
      });
    });
  }

  /** À brancher sur `app.ticker.add`. */
  update = (ticker: Ticker): void => {
    const dt = ticker.deltaMS;
    for (const a of this.anims) {
      if (a.done) continue;
      if (a.delay > 0) {
        a.delay -= dt;
        if (a.delay > 0) continue;
      }
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.onUpdate(a.ease(t));
      if (t >= 1) {
        a.done = true;
        a.onComplete?.();
      }
    }
    if (this.anims.length > 64) this.anims = this.anims.filter((a) => !a.done);
  };

  /** Pause N ms (utile pour séquencer). */
  wait(ms: number): Promise<void> {
    return this.add({ duration: ms, onUpdate: () => {} });
  }

  clear(): void {
    this.anims.length = 0;
  }
}
