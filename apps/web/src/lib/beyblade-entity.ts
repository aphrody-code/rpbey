/**
 * Module canonique d'entité Beyblade — **source de vérité UNIQUE** pour identifier
 * et qualifier une pièce/blade à travers les ~15 sources de données du corpus
 * (catalogue, pièces DB, beys encyclopédiques, méta WBO, combos, discussions).
 *
 * Avant ce module, trois faits étaient dupliqués (et donc désynchronisables) :
 *  - une `normalizeName` ad-hoc dans `bx-catalog.ts`, `meta.ts` et `search-rank.ts` ;
 *  - les tables de tier blade/ratchet/bit dans `global-search.ts` ET
 *    `recommendation-engine.ts` (deux copies à maintenir à la main) ;
 *  - le parsing « Blade Ratchet Bit » d'un libellé de combo.
 *
 * Ici on consolide : une **clé canonique** (normalisation + repli JP→EN
 * conservateur, sans jamais fusionner deux blades distinctes), les **tables de
 * tier** uniques, et un **parseur de combo**. Pur — partagé client + serveur
 * (aucun import server-only), réutilisable par le ranker, l'index, la reco et l'UI.
 */

export type Tier = "S" | "A" | "B" | "C";

/** Rang numérique d'un tier (S le plus fort) — tri / comparaison. */
export const TIER_RANK: Record<Tier, number> = { S: 4, A: 3, B: 2, C: 1 };

/** Couleur canonique d'un tier (réutilisée par les badges UI pour rester cohérents). */
export const TIER_COLOR: Record<Tier, string> = {
  S: "#ef4444", // rouge — méta dominante
  A: "#f59e0b", // ambre
  B: "#3b82f6", // bleu
  C: "#6b7280", // gris — hors méta
};

/**
 * Repli japonais → anglais. Chaque entrée mappe un nom **katakana** vers le nom
 * EN de **la même blade** (jamais une blade différente — Wizard Rod ≠ Wizard
 * Arrow restent deux entités). Appliqué avant compactage pour que la recherche
 * cross-lingue résolve sur la même clé canonique.
 */
const JP_TO_EN: Record<string, string> = {
  ウィザードロッド: "wizard rod",
  ウィザードアロー: "wizard arrow",
  フェニックスウイング: "phoenix wing",
  コバルトドレイク: "cobalt drake",
  コバルトドラグーン: "cobalt dragoon",
  シャークエッジ: "shark edge",
  ドランソード: "dran sword",
  ドランバスター: "dran buster",
  ドランダガー: "dran dagger",
  ドランブレイブ: "dran brave",
  ヘルズサイズ: "hells scythe",
  ヘルズチェーン: "hells chain",
  ヘルズハンマー: "hells hammer",
  レオンクロー: "leon claw",
  レオンクレスト: "leon crest",
  ヴァイスタイガー: "weiss tiger",
  ユニコーンスティング: "unicorn sting",
  ナイトシールド: "knight shield",
  ナイトランス: "knight lance",
  ティラノビート: "tyranno beat",
  ブラックシェル: "black shell",
  バイパーテイル: "viper tail",
  ワイバーンゲイル: "wyvern gale",
  スフィンクスカウル: "sphinx cowl",
  シノビシャドー: "shinobi shadow",
  サムライセイバー: "samurai saber",
  ライノホーン: "rhino horn",
  ペガサスブラスト: "pegasus blast",
};

/** Mots de remplissage retirés d'un nom avant compactage (marques, packagings). */
const FILLER_RE = /\b(beyblade|bey|toupie|takara|tomy|booster|starter|pack|deck|set|bx|ux|cx)\b/g;

/**
 * **Clé canonique** d'un nom de pièce/blade : minuscule, sans accents (NFKD),
 * repli JP→EN, mots-marques retirés, puis tout caractère non-alphanumérique
 * supprimé. Deux libellés de la même entité convergent (« Wizard Rod »,
 * « wizard-rod », « ウィザードロッド » → `wizardrod`) sans fusionner des entités
 * distinctes. Renvoie `""` pour une entrée vide/non significative.
 */
export function canonicalKey(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  let s = trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const jp = JP_TO_EN[trimmed] ?? JP_TO_EN[s];
  if (jp) s = jp;
  s = s.replace(FILLER_RE, " ");
  return s.replace(/[^a-z0-9]+/g, "");
}

// ── Tables de tier (consolidées depuis global-search + recommendation-engine) ──

const BLADE_TIER_SRC: Record<string, Tier> = {
  "wizard rod": "S",
  "phoenix wing": "S",
  "cobalt dragoon": "S",
  "shark edge": "A",
  "shark scale": "A",
  "dran buster": "A",
  "tyranno beat": "A",
  "hells chain": "A",
  "hells scythe": "B",
  "unicorn sting": "B",
  "weiss tiger": "B",
  "knight shield": "B",
  "dran sword": "B",
  "knight lance": "B",
  "leon claw": "B",
  "viper tail": "B",
};

const RATCHET_TIER_SRC: Record<string, Tier> = {
  "9-60": "S",
  "5-60": "S",
  "3-60": "A",
  "1-60": "A",
  "7-60": "A",
  "4-60": "B",
  "0-60": "B",
  "3-80": "B",
  "5-80": "B",
};

const BIT_TIER_SRC: Record<string, Tier> = {
  ball: "S",
  orb: "S",
  hexa: "S",
  level: "S",
  "low rush": "S",
  rush: "A",
  flat: "A",
  point: "A",
  "gear point": "A",
  elevate: "B",
  needle: "B",
  taper: "B",
};

/** Abréviations de bit (lettre → nom complet), pour résoudre un code combo (ex. `3-60F`). */
export const BIT_ABBREVIATIONS: Record<string, string> = {
  F: "Flat",
  LF: "Low Flat",
  B: "Ball",
  O: "Orb",
  HN: "High Needle",
  GP: "Gear Point",
  GF: "Gear Flat",
  DB: "Disc Ball",
  T: "Taper",
  N: "Needle",
  H: "Hexa",
  L: "Level",
  LR: "Low Rush",
  R: "Rush",
  E: "Elevate",
  K: "Kick",
  P: "Point",
  U: "Unite",
  M: "Metal",
  Q: "Quake",
  S: "Savage",
  C: "Charge",
  A: "Assault",
  D: "Dual",
  G: "Guard",
};

export type PartType = "BLADE" | "RATCHET" | "BIT";

function toCanonMap(src: Record<string, Tier>): Map<string, Tier> {
  const m = new Map<string, Tier>();
  for (const [name, tier] of Object.entries(src)) m.set(canonicalKey(name), tier);
  return m;
}

const BLADE_TIERS = toCanonMap(BLADE_TIER_SRC);
const RATCHET_TIERS = toCanonMap(RATCHET_TIER_SRC);
const BIT_TIERS = toCanonMap(BIT_TIER_SRC);

const TIER_TABLES: Record<PartType, Map<string, Tier>> = {
  BLADE: BLADE_TIERS,
  RATCHET: RATCHET_TIERS,
  BIT: BIT_TIERS,
};

/**
 * Tier WBO d'une pièce par sa clé canonique, ou `null` si non répertoriée.
 * Sans `type`, on essaie blade → ratchet → bit (première correspondance).
 * Repli sur l'abréviation de bit (`F`, `3-60F`…) si le nom direct échoue.
 */
export function lookupTier(name: string, type?: PartType): Tier | null {
  const key = canonicalKey(name);
  if (!key) return null;
  const tables = type ? [TIER_TABLES[type]] : [BLADE_TIERS, RATCHET_TIERS, BIT_TIERS];
  for (const table of tables) {
    const direct = table.get(key);
    if (direct) return direct;
  }
  // Bit donné en abréviation (ex. "F", "LF") → nom complet.
  if (!type || type === "BIT") {
    const upper = name.trim().toUpperCase();
    const full = BIT_ABBREVIATIONS[upper];
    if (full) {
      const t = BIT_TIERS.get(canonicalKey(full));
      if (t) return t;
    }
  }
  return null;
}

/** Composants d'un combo extraits d'un libellé « Blade 3-60 F ». */
export interface ComboParts {
  blade: string;
  ratchet: string | null;
  bit: string | null;
}

const RATCHET_RE = /\b(\d-\d{2})\b/;
const COMBO_CODE_RE = /\b(\d-\d{2})\s*([A-Z]{1,3})\b/i;

/**
 * Découpe un libellé de combo en composants. Le ratchet est repéré par son
 * motif `chiffre-chiffres` (ex. `3-60`), le bit par les lettres qui suivent ou
 * le dernier token ; tout le reste à gauche du ratchet est la blade.
 */
export function parseCombo(label: string): ComboParts {
  const raw = label.trim();
  const ratMatch = raw.match(RATCHET_RE);
  if (!ratMatch || ratMatch.index === undefined) {
    return { blade: raw, ratchet: null, bit: null };
  }
  const ratchet = ratMatch[1] ?? null;
  const blade = raw.slice(0, ratMatch.index).trim();
  // Bit : code accolé (3-60F) ou token après le ratchet.
  const code = raw.match(COMBO_CODE_RE);
  let bit: string | null = null;
  if (code?.[2]) {
    bit = BIT_ABBREVIATIONS[code[2].toUpperCase()] ?? code[2];
  } else {
    const after = raw.slice(ratMatch.index + ratMatch[0].length).trim();
    if (after) bit = after.split(/\s+/)[0] ?? null;
  }
  return { blade: blade || raw, ratchet, bit };
}

/** Score méta combiné d'un combo (0-100) à partir des scores par composant. */
export function combinedComboScore(
  bladeScore: number | null,
  ratchetScore: number | null,
  bitScore: number | null,
): number {
  const parts = [bladeScore, ratchetScore, bitScore].filter(
    (s): s is number => typeof s === "number" && s > 0,
  );
  if (parts.length === 0) return 0;
  // La blade porte le combo : 60 % meilleur composant + 40 % moyenne des présents.
  const max = Math.max(...parts);
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.round(0.6 * max + 0.4 * avg);
}
