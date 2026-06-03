/**
 * Tests purs des easings + du Tweener (`tween.ts`). Le Tweener est piloté par le
 * Ticker PixiJS via `deltaMS` — on injecte un faux ticker `{ deltaMS }`, aucune
 * dépendance GPU/DOM. On vérifie les invariants d'easing (bornes 0/1, monotonie)
 * et le cycle de vie d'une anim (onUpdate borné, onComplete + résolution de Promise).
 */
import { describe, expect, test } from "bun:test";
import { Ease, Tweener } from "./tween";

const ALL_EASINGS = Object.entries(Ease);

describe("Ease — points d'ancrage", () => {
  test("toute fonction d'easing passe par (0,0) et (1,1)", () => {
    for (const [name, fn] of ALL_EASINGS) {
      expect(fn(0)).toBeCloseTo(0, 6);
      expect(fn(1)).toBeCloseTo(1, 6);
      // sanity du nom pour un message d'échec lisible
      expect(typeof name).toBe("string");
    }
  });

  test("linear est l'identité", () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      expect(Ease.linear(t)).toBe(t);
    }
  });

  test("inCubic / outCubic monotones croissants sur [0,1]", () => {
    let prevIn = -Infinity;
    let prevOut = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const i = Ease.inCubic(t);
      const o = Ease.outCubic(t);
      expect(i).toBeGreaterThanOrEqual(prevIn - 1e-9);
      expect(o).toBeGreaterThanOrEqual(prevOut - 1e-9);
      prevIn = i;
      prevOut = o;
    }
  });

  test("inCubic ralenti au début, outCubic accéléré au début (mi-course)", () => {
    expect(Ease.inCubic(0.5)).toBeLessThan(0.5); // 0.125
    expect(Ease.outCubic(0.5)).toBeGreaterThan(0.5); // 0.875
  });

  test("outBack dépasse 1 (overshoot) près de la fin — caractéristique du back", () => {
    let max = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.02) max = Math.max(max, Ease.outBack(t));
    expect(max).toBeGreaterThan(1);
  });

  test("inOutCubic symétrique : f(t) + f(1-t) ≈ 1", () => {
    for (const t of [0.1, 0.3, 0.42, 0.5]) {
      expect(Ease.inOutCubic(t) + Ease.inOutCubic(1 - t)).toBeCloseTo(1, 6);
    }
  });
});

/** Faux ticker PixiJS minimal : seul `deltaMS` est lu par Tweener.update. */
function tick(tw: Tweener, deltaMS: number): void {
  tw.update({ deltaMS } as unknown as import("pixi.js").Ticker);
}

describe("Tweener — cycle de vie d'une anim", () => {
  test("onUpdate borné [0,1], appelé à 0 jamais > 1, onComplete une seule fois", async () => {
    const tw = new Tweener();
    const values: number[] = [];
    let completes = 0;
    const done = tw.add({
      duration: 100,
      ease: Ease.linear,
      onUpdate: (v) => values.push(v),
      onComplete: () => {
        completes++;
      },
    });

    // 100ms en 4 frames de 25ms → t = 0.25, 0.5, 0.75, 1.0
    tick(tw, 25);
    tick(tw, 25);
    tick(tw, 25);
    tick(tw, 25);
    // Frame supplémentaire : ne doit plus rien faire (anim done).
    tick(tw, 25);

    await done; // la Promise se résout via onComplete

    expect(completes).toBe(1);
    expect(values).toEqual([0.25, 0.5, 0.75, 1]);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test("clamp : un grand deltaMS termine l'anim sans dépasser 1", async () => {
    const tw = new Tweener();
    let last = -1;
    const done = tw.add({ duration: 100, onUpdate: (v) => (last = v) });
    tick(tw, 100_000); // dépasse largement la durée
    await done;
    expect(last).toBe(1);
  });

  test("delay : aucune progression tant que le delay n'est pas écoulé", async () => {
    const tw = new Tweener();
    const values: number[] = [];
    const done = tw.add({
      duration: 100,
      delay: 50,
      ease: Ease.linear,
      onUpdate: (v) => values.push(v),
    });
    tick(tw, 30); // delay 50 → reste 20, rien
    expect(values).toEqual([]);
    tick(tw, 30); // delay épuisé (reste -? ), elapsed avance
    tick(tw, 100); // termine
    await done;
    expect(values.length).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(1);
  });

  test("wait(ms) résout après la durée écoulée", async () => {
    const tw = new Tweener();
    let resolved = false;
    const p = tw.wait(50).then(() => {
      resolved = true;
    });
    tick(tw, 20);
    expect(resolved).toBe(false);
    tick(tw, 40); // total 60 ≥ 50
    await p;
    expect(resolved).toBe(true);
  });

  test("clear() vide les anims : plus aucun onUpdate après", () => {
    const tw = new Tweener();
    let updates = 0;
    void tw.add({ duration: 100, onUpdate: () => updates++ });
    tw.clear();
    tick(tw, 50);
    expect(updates).toBe(0);
  });

  test("duration plancher 1ms : add({duration:0}) ne divise pas par zéro", async () => {
    const tw = new Tweener();
    let last = NaN;
    const done = tw.add({ duration: 0, onUpdate: (v) => (last = v) });
    tick(tw, 1);
    await done;
    expect(Number.isFinite(last)).toBe(true);
    expect(last).toBe(1);
  });
});
