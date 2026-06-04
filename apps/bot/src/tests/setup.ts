import "reflect-metadata";
import { mock } from "bun:test";

// ── @aphrody/canvas mock (test-only) ──────────────────────────────────────────
// Le binding natif Skia de @aphrody/canvas (skia.linux-x64-gnu.node) est compilé
// contre GLIBC_2.43 (Ubuntu 26.04). Les runners GitHub Actions hébergés sont plus
// anciens → `require('./skia.linux-x64-gnu.node')` jette
//   « /lib/x86_64-linux-gnu/libm.so.6: version GLIBC_2.43 not found » (ERR_DLOPEN_FAILED).
// Or plusieurs modules du bot (canvas-utils, meta-canvas, canvas/primitives)
// importent @aphrody/canvas au TOP-LEVEL : l'import se déclenche dès qu'un test
// charge un de ces modules (ou un de leurs dépendants, ex. RankingGroup), AVANT
// que les mocks au point d'appel ne s'appliquent → "Unhandled error between tests".
//
// On mocke donc @aphrody/canvas ICI, dans le preload (bunfig.toml [test].preload),
// AVANT tout import de code applicatif. Le binding natif ne se charge jamais sous
// test. Le rendu réel reste intact hors tests (image bot FROM ubuntu:26.04).
//
// Surface couverte = ce que le bot importe réellement :
//   createCanvas, loadImage, GlobalFonts (.registerFromPath / .register).
// Le contexte 2D renvoyé est un no-op chaînable (toute méthode = () => undefined,
// measureText → { width }, create*Gradient → { addColorStop }) pour qu'un éventuel
// chemin non-mocké au point d'appel ne crashe pas.

function makeGradient() {
  return { addColorStop: () => undefined };
}

function makeContext() {
  const ctx: Record<string, unknown> = {
    // propriétés d'état (assignables, lues parfois)
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    filter: "none",
    // gradients → objet avec addColorStop
    createLinearGradient: makeGradient,
    createRadialGradient: makeGradient,
    createConicGradient: makeGradient,
    // mesure de texte
    measureText: (t: string) => ({ width: (t?.length ?? 0) * 6 }),
  };
  // Toute autre méthode du contexte (fillRect, drawImage, beginPath, arc,
  // roundRect, save, restore, clip, stroke, fill, translate, transform, …)
  // devient un no-op renvoyant undefined.
  return new Proxy(ctx, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
}

function createCanvas(width: number, height: number) {
  return {
    width,
    height,
    getContext: () => makeContext(),
    toBuffer: () => Buffer.from([]),
    toDataURL: () => "data:image/png;base64,",
    encode: async () => new Uint8Array(),
  };
}

const GlobalFonts = {
  registerFromPath: () => true,
  register: () => true,
  has: () => false,
  get families() {
    return [] as { family: string }[];
  },
};

mock.module("@aphrody/canvas", () => ({
  createCanvas,
  loadImage: async () => ({ width: 1, height: 1 }),
  GlobalFonts,
  Image: class {},
  Path2D: class {},
  Canvas: class {},
}));
