/**
 * extract-season-colors.ts — couleur dynamique par frame d'ambiance.
 *
 * Pour chaque image curée (servie par cdn.rpbey.fr), extrait la couleur DOMINANTE
 * (`sharp().stats().dominant`), la convertit en OKLCH, et dérive :
 *   - un ACCENT vibrant lisible sur fond sombre  → `oklch(L C H)` ;
 *   - une TEINTE de voile (`r g b` du dominant)   → pour nuancer le scrim sombre.
 * Sort un module TS généré consommé par `SectionFrameBg` (zéro extraction runtime,
 * zéro CORS canvas). Re-lancer si on change le set curé :
 *   bun apps/web/scripts/extract-season-colors.ts
 *
 * OKLab : conversion directe sRGB→OKLab (Björn Ottosson), pas de dépendance.
 */
import sharp from "sharp";

const CDN = "https://cdn.rpbey.fr";
const URLS: readonly string[] = [
  `${CDN}/fancaps-anime-full/29133604.jpg`,
  `${CDN}/fancaps-anime-full/29131028.jpg`,
  `${CDN}/fancaps-anime-full/29132373.jpg`,
  `${CDN}/static/data/rpb/seasons/metal-champion.png`,
  `${CDN}/static/data/rpb/seasons/metal-team.png`,
  `${CDN}/static/data/rpb/seasons/burst-clash.png`,
  `${CDN}/static/data/rpb/seasons/burst-valt.png`,
  `${CDN}/static/data/rpb/seasons/burst-aura.png`,
  `${CDN}/static/data/rpb/seasons/bakuten-team.png`,
  `${CDN}/static/data/rpb/seasons/bakuten-team2.png`,
];

const OUT = new URL("../src/lib/season-colors.generated.ts", import.meta.url).pathname;

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** sRGB (0-255) → OKLCH { L (0-1), C, H (deg) }. */
function rgbToOklch(r: number, g: number, b: number) {
  const lr = srgbToLinear(r),
    lg = srgbToLinear(g),
    lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.281718838 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r2 = (x: number) => Math.round(x * 1000) / 1000;

interface SeasonColor {
  /** Accent CSS prêt-à-l'emploi (vibrant, lisible sur sombre). */
  accent: string;
  /** Variante accent douce (halo). */
  accentSoft: string;
  /** Dominant brut `r g b` pour nuancer les voiles. */
  tint: string;
}

async function colorFor(url: string): Promise<SeasonColor> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const { dominant } = await sharp(buf).stats();
  const { r, g, b } = dominant;
  const { C, H } = rgbToOklch(r, g, b);
  // Accent : on garde la TEINTE de l'image ; L fixé pour le contraste sur sombre,
  // chroma borné (image grisâtre → accent sobre ; image vive → accent punchy).
  const chroma = clamp(C * 1.35, 0.05, 0.19);
  const accent = `oklch(0.74 ${r2(chroma)} ${Math.round(H)})`;
  const accentSoft = `oklch(0.62 ${r2(chroma * 0.85)} ${Math.round(H)})`;
  return { accent, accentSoft, tint: `${r} ${g} ${b}` };
}

const entries: [string, SeasonColor][] = [];
for (const u of URLS) {
  try {
    entries.push([u, await colorFor(u)]);
    console.log("ok", u, entries.at(-1)![1].accent);
  } catch (e) {
    console.warn("skip", u, (e as Error).message);
  }
}

const body = `// GÉNÉRÉ par apps/web/scripts/extract-season-colors.ts — NE PAS ÉDITER À LA MAIN.
// Couleur dynamique : accent OKLCH + teinte dérivés de la couleur dominante de chaque frame.
export interface SeasonColor {
  /** Accent CSS (vibrant, lisible sur fond sombre). */
  accent: string;
  /** Accent doux (halo / glow). */
  accentSoft: string;
  /** Dominant brut \`r g b\` (nuance des voiles). */
  tint: string;
}

export const SEASON_COLORS: Record<string, SeasonColor> = ${JSON.stringify(
  Object.fromEntries(entries),
  null,
  2,
)};
`;

await Bun.write(OUT, body);
console.log(`\nwrote ${OUT} (${entries.length} images)`);
