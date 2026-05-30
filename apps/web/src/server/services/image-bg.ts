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
 * Renvoie un WebP RGBA détouré, ou `null` si l'image doit rester telle quelle.
 * Best-effort total : toute exception → `null` (l'appelant sert l'original).
 */

const MAX_DIM = 768; // borne le coût CPU + la taille de sortie
const FUZZ = 38; // distance euclidienne RGB tolérée autour de la couleur de fond
const STD_MAX = 26; // écart-type des coins au-delà duquel le fond n'est pas uniforme
const LUM_MIN = 176; // luminance min du fond (cible = clair ; évite de trouer un fond sombre)
const MIN_CLEARED_PCT = 3; // sous ce taux d'effacement, on considère qu'il n'y avait pas de fond

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

    const fuzz2 = FUZZ * FUZZ;
    const near = (i: number): boolean => {
      const dr = val(i) - mr;
      const dg = val(i + 1) - mg;
      const db = val(i + 2) - mb;
      return dr * dr + dg * dg + db * db <= fuzz2;
    };

    // Flood-fill itératif (pile explicite) depuis tous les pixels de bord.
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
      if (!near(i)) continue;
      px[i + 3] = 0;
      cleared++;
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0 && !visited[p - 1]) stack.push(p - 1);
      if (x < W - 1 && !visited[p + 1]) stack.push(p + 1);
      if (y > 0 && !visited[p - W]) stack.push(p - W);
      if (y < H - 1 && !visited[p + W]) stack.push(p + W);
    }
    if ((100 * cleared) / (W * H) < MIN_CLEARED_PCT) return null;

    return await sharp(px, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 86, alphaQuality: 90 })
      .toBuffer();
  } catch {
    return null;
  }
}
