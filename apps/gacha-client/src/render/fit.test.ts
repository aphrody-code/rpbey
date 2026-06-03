/**
 * Tests purs des helpers de placement pixel-perfect (`fit.ts`). En contexte Bun
 * `window` est undefined → `dpr()` renvoie 1 (chemin serveur déterministe), donc
 * `snapDevice` arrondit à l'entier. On vérifie : aspect préservé (scale uniforme),
 * snapping, cadrage 16:9, et le no-op défensif sur dimensions ≤ 0.
 *
 * `fitCover`/`fitContain` mutent un Sprite PixiJS : on fournit un faux sprite
 * minimal exposant uniquement les champs touchés (anchor/scale/position/roundPixels).
 */
import { describe, expect, test } from "bun:test";
import { dpr, fitContain, fitCover, rect16x9, snapDevice } from "./fit";

interface Vec2 {
  x: number;
  y: number;
  set(a: number, b?: number): void;
}
function vec2(): Vec2 {
  return {
    x: 0,
    y: 0,
    set(a: number, b?: number) {
      this.x = a;
      this.y = b ?? a;
    },
  };
}
function fakeSprite() {
  return {
    anchor: vec2(),
    scale: vec2(),
    position: vec2(),
    roundPixels: false,
  };
}

describe("dpr / snapDevice (window absent → ratio 1)", () => {
  test("dpr() clampé renvoie 1 sans window", () => {
    expect(dpr()).toBe(1);
  });

  test("snapDevice à ratio=1 arrondit à l'entier", () => {
    expect(snapDevice(100.3, 1)).toBe(100);
    expect(snapDevice(100.6, 1)).toBe(101);
    expect(snapDevice(0, 1)).toBe(0);
  });

  test("snapDevice à ratio=2 snappe sur la demi-unité CSS", () => {
    // 100.3 css * 2 = 200.6 → 201 device → 100.5 css
    expect(snapDevice(100.3, 2)).toBe(100.5);
    expect(snapDevice(50, 2)).toBe(50);
  });
});

describe("fitCover / fitContain — aspect uniforme", () => {
  test("cover choisit le plus GRAND scale (remplit, déborde sur l'axe long)", () => {
    const s = fakeSprite();
    // texture 100×100, zone 200×400 → scaleX=2, scaleY=4 → cover = max = 4
    fitCover(s, { texW: 100, texH: 100, areaW: 200, areaH: 400 });
    expect(s.scale.x).toBe(4);
    expect(s.scale.y).toBe(4); // uniforme : pas d'étirement
    expect(s.anchor.x).toBe(0.5);
    expect(s.roundPixels).toBe(true);
    // centre de la zone (snappé, ratio 1)
    expect(s.position.x).toBe(100); // areaX 0 + 200/2
    expect(s.position.y).toBe(200); // areaY 0 + 400/2
  });

  test("contain choisit le plus PETIT scale (tient entier, letterbox)", () => {
    const s = fakeSprite();
    // texture 100×100, zone 200×400 → contain = min(2,4) = 2
    fitContain(s, { texW: 100, texH: 100, areaW: 200, areaH: 400 });
    expect(s.scale.x).toBe(2);
    expect(s.scale.y).toBe(2);
  });

  test("offset areaX/areaY décale le centre", () => {
    const s = fakeSprite();
    fitContain(s, { texW: 10, texH: 10, areaW: 100, areaH: 100, areaX: 50, areaY: 20 });
    expect(s.position.x).toBe(100); // 50 + 100/2
    expect(s.position.y).toBe(70); // 20 + 100/2
  });

  test("no-op défensif : dimensions ≤ 0 → sprite intouché", () => {
    const s = fakeSprite();
    fitCover(s, { texW: 0, texH: 100, areaW: 200, areaH: 200 });
    expect(s.scale.x).toBe(0); // valeur initiale, jamais set
    expect(s.roundPixels).toBe(false);

    fitContain(s, { texW: 100, texH: 100, areaW: -1, areaH: 200 });
    expect(s.roundPixels).toBe(false);
  });
});

describe("rect16x9 — plus grand 16:9 centré", () => {
  test("zone plus large que 16:9 → bridée par la hauteur, centrée en X", () => {
    // areaW=320 areaH=100 : 16:9 de hauteur 100 → w=177.7… ; centré
    const r = rect16x9(320, 100);
    expect(r.h).toBe(snapDevice(100, 1)); // hauteur pleine
    expect(r.w).toBeCloseTo(snapDevice((100 * 16) / 9, 1), 0);
    expect(r.w).toBeLessThanOrEqual(320);
    // centré horizontalement : x = (320 - w)/2 > 0
    expect(r.x).toBeGreaterThan(0);
    expect(r.y).toBe(0);
  });

  test("zone exactement 16:9 → remplit tout, x=y=0", () => {
    const r = rect16x9(1280, 720);
    expect(r.w).toBe(1280);
    expect(r.h).toBe(720);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  test("zone plus haute que 16:9 → bridée par la largeur, centrée en Y", () => {
    const r = rect16x9(160, 1000);
    expect(r.w).toBe(160);
    expect(r.h).toBeCloseTo((160 * 9) / 16, 0); // 90
    expect(r.y).toBeGreaterThan(0); // letterbox vertical
    expect(r.x).toBe(0);
  });

  test("ratio résultant ≈ 16/9 dans tous les cas", () => {
    for (const [w, h] of [
      [320, 100],
      [1280, 720],
      [160, 1000],
      [800, 600],
    ]) {
      const r = rect16x9(w, h);
      expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
    }
  });
});
