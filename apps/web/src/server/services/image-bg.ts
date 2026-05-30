import "server-only";
import sharp from "sharp";

/**
 * Détourage du **fond de studio uniforme et clair** (blanc / crème / gris clair)
 * des images produits scrappées, par **flood-fill depuis les bords**.
 *
 * Seuls les pixels de fond *connectés au bord* deviennent transparents : les
 * zones claires **internes** au produit (logos, reflets, plastique blanc) sont
 * préservées — là où un simple seuillage global les troue. La couleur de fond
 * est estimée aux 4 coins (agnostique blanc/crème/gris), avec garde-fous : on ne
 * touche pas une image déjà détourée, un fond non uniforme (photo lifestyle) ou
 * un fond sombre/coloré (cible = fond clair uniquement).
 *
 * Qualité (v2) : alpha en **rampe douce** entre `FUZZ_INNER` (→ transparent) et
 * `FUZZ_OUTER` (→ opaque) au lieu d'un seuil binaire — ça **anti-alias** le bord
 * et écrase le **halo blanc** du contour. Puis **feather** du canal alpha (léger
 * flou) pour des bords nets et lisses, et **despill** (on retire la dominante de
 * fond résiduelle sur les pixels semi-transparents du contour).
 *
 * Renvoie un WebP RGBA détouré, ou `null` si l'image doit rester telle quelle.
 * Best-effort total : toute exception → `null` (l'appelant sert l'original).
 *
 * ⚠️ `ALGO_VERSION` est inclus dans la clé de cache disque côté route `/api/img`
 *    → tout changement d'algo invalide automatiquement le cache.
 */

export const ALGO_VERSION = 2;

const MAX_DIM = 768; // borne le coût CPU + la taille de sortie
const FUZZ_INNER = 30; // distance RGB en-deçà de laquelle le pixel est PLEINEMENT effacé
const FUZZ_OUTER = 60; // distance au-delà de laquelle on garde le pixel (frontière du produit)
const STD_MAX = 26; // écart-type des coins au-delà duquel le fond n'est pas uniforme
const LUM_MIN = 176; // luminance min du fond (cible = clair ; évite de trouer un fond sombre)
const MIN_CLEARED_PCT = 3; // sous ce taux d'effacement, on considère qu'il n'y avait pas de fond
const DESPILL = 0.6; // force du retrait de dominante de fond sur le contour semi-transparent (0..1)

export async function removeUniformLightBackground(input: Buffer): Promise<Buffer | null> {
  try {
    const pre = sharp(input, { failOn: "none" }).rotate();
    const meta = await pre.metadata();
    const sized =
      typeof meta.width === "number" && meta.width > MAX_DIM ? pre.resize({ width: MAX_DIM }) : pre;
    const { data, info } = await sized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;
    if (W < 8 || H < 8) return null;
    const px = data; // Buffer RGBA
    const val = (i: number): number => px[i] ?? 0;
    const at = (x: number, y: number) => (y * W + x) * 4;

    // Couleur de fond estimée aux 4 coins + détection « déjà transparent ».
    const corners: Array<[number, number]> = [
      [0, 0],
      [W - 1, 0],
      [0, H - 1],
      [W - 1, H - 1],
    ];
    const cr: number[] = [];
    const cg: number[] = [];
    const cb: number[] = [];
    let transparent = 0;
    for (const [x, y] of corners) {
      const i = at(x, y);
      cr.push(val(i));
      cg.push(val(i + 1));
      cb.push(val(i + 2));
      if (val(i + 3) < 128) transparent++;
    }
    if (transparent >= 3) return null; // image déjà détourée

    const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);
    const mr = sum(cr) / cr.length;
    const mg = sum(cg) / cg.length;
    const mb = sum(cb) / cb.length;
    const variance =
      (cr.reduce((s, v) => s + (v - mr) ** 2, 0) +
        cg.reduce((s, v) => s + (v - mg) ** 2, 0) +
        cb.reduce((s, v) => s + (v - mb) ** 2, 0)) /
      4;
    const std = Math.sqrt(variance);
    const lum = 0.299 * mr + 0.587 * mg + 0.114 * mb;
    if (std > STD_MAX || lum < LUM_MIN) return null; // fond non uniforme ou sombre

    const inner2 = FUZZ_INNER * FUZZ_INNER;
    const outer2 = FUZZ_OUTER * FUZZ_OUTER;
    const band = FUZZ_OUTER - FUZZ_INNER;
    // distance² du pixel i à la couleur de fond.
    const dist2 = (i: number): number => {
      const dr = val(i) - mr;
      const dg = val(i + 1) - mg;
      const db = val(i + 2) - mb;
      return dr * dr + dg * dg + db * db;
    };

    // Flood-fill itératif (pile explicite) depuis tous les pixels de bord.
    // On propage tant que d < FUZZ_OUTER (fond + contour anti-aliasé), et on pose
    // un alpha en RAMPE : 0 sous FUZZ_INNER, 255 au-delà de FUZZ_OUTER, linéaire entre.
    const visited = new Uint8Array(W * H);
    const stack: number[] = [];
    for (let x = 0; x < W; x++) {
      stack.push(x, (H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      stack.push(y * W, y * W + (W - 1));
    }
    let cleared = 0;
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined || visited[p]) continue;
      visited[p] = 1;
      const i = p * 4;
      const d2 = dist2(i);
      if (d2 >= outer2) continue; // produit : on garde, on n'étend pas
      // Rampe d'alpha (anti-aliasing du bord).
      let a = 0;
      if (d2 > inner2) {
        const d = Math.sqrt(d2);
        a = Math.round((255 * (d - FUZZ_INNER)) / band);
      }
      if (a < px[i + 3]!) {
        // Despill : sur le contour semi-transparent, « un-premultiply » contre le
        // fond → on retire sa contribution (C = af·F + (1-af)·B ⇒ F = (C-(1-af)·B)/af),
        // blendé à DESPILL. Supprime la frange claire du contour.
        if (a > 0 && a < 255) {
          const af = a / 255;
          const unb = (c: number, m: number): number => {
            const f = (c - (1 - af) * m) / af;
            return Math.max(0, Math.min(255, Math.round(c + DESPILL * (f - c))));
          };
          px[i] = unb(val(i), mr);
          px[i + 1] = unb(val(i + 1), mg);
          px[i + 2] = unb(val(i + 2), mb);
        }
        px[i + 3] = a;
        cleared++;
      }
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0 && !visited[p - 1]) stack.push(p - 1);
      if (x < W - 1 && !visited[p + 1]) stack.push(p + 1);
      if (y > 0 && !visited[p - W]) stack.push(p - W);
      if (y < H - 1 && !visited[p + W]) stack.push(p + W);
    }
    if ((100 * cleared) / (W * H) < MIN_CLEARED_PCT) return null;

    // Feather : léger flou du SEUL canal alpha → bords lisses, anti-jaggies +
    // atténue le halo résiduel. Les canaux RGB restent intacts (pas de bavure).
    const featheredAlpha = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
      .extractChannel(3)
      .blur(0.7)
      .raw()
      .toBuffer();
    const rgb = Buffer.allocUnsafe(W * H * 3);
    for (let p = 0; p < W * H; p++) {
      rgb[p * 3] = px[p * 4]!;
      rgb[p * 3 + 1] = px[p * 4 + 1]!;
      rgb[p * 3 + 2] = px[p * 4 + 2]!;
    }
    return await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .joinChannel(featheredAlpha, { raw: { width: W, height: H, channels: 1 } })
      .webp({ quality: 88, alphaQuality: 92, effort: 4 })
      .toBuffer();
  } catch {
    return null;
  }
}
