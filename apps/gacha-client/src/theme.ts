/**
 * Thème visuel par rareté — couleurs (halo/glow/particules), nombre d'étoiles,
 * intensité des FX. Aligné sur la carte OG du web (`app/api/gacha/card/route.tsx`).
 *
 * Identité de marque rpbey : aurore rouge (#e23b5a) ↔ bleu (#3b6ee2). Le fond de
 * scène utilise ces deux pôles, les raretés montent en chaleur/saturation.
 */
import type { Rarity } from "./types";

export interface RarityTheme {
  /** Couleur principale (halo, bordure carte, particules). */
  color: number;
  /** Couleur d'accent secondaire (dégradé, shine). */
  accent: number;
  /** Nombre d'étoiles affichées sous la carte. */
  stars: number;
  /** Libellé FR. */
  label: string;
  /** Intensité globale des FX [0..1] (taille halo, densité particules). */
  intensity: number;
}

export const RARITY_THEME: Record<Rarity, RarityTheme> = {
  COMMON: { color: 0x9aa3b8, accent: 0xc9d0e0, stars: 1, label: "Commune", intensity: 0.15 },
  RARE: { color: 0x4d8cff, accent: 0x9cc0ff, stars: 2, label: "Rare", intensity: 0.4 },
  SUPER_RARE: {
    color: 0xa64dff,
    accent: 0xd9a6ff,
    stars: 3,
    label: "Super Rare",
    intensity: 0.7,
  },
  LEGENDARY: {
    color: 0xffb01f,
    accent: 0xffe39c,
    stars: 4,
    label: "Légendaire",
    intensity: 0.9,
  },
  SECRET: { color: 0xff2e57, accent: 0xff9db1, stars: 5, label: "Secrète", intensity: 1 },
};

/** Couleurs de l'aurore de marque (fond de scène). */
export const BRAND = {
  red: 0xe23b5a,
  blue: 0x3b6ee2,
  ink: 0x07070c,
  surface: 0x10121f,
  text: 0xeef0fb,
  muted: 0x9aa0b8,
  gold: 0xffcf5c,
} as const;

export function rarityTheme(r: Rarity): RarityTheme {
  return RARITY_THEME[r];
}
