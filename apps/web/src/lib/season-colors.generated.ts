// GÉNÉRÉ par apps/web/scripts/extract-season-colors.ts — NE PAS ÉDITER À LA MAIN.
// Couleur dynamique : accent OKLCH + teinte dérivés de la couleur dominante de chaque frame.
export interface SeasonColor {
  /** Accent CSS (vibrant, lisible sur fond sombre). */
  accent: string;
  /** Accent doux (halo / glow). */
  accentSoft: string;
  /** Dominant brut `r g b` (nuance des voiles). */
  tint: string;
}

export const SEASON_COLORS: Record<string, SeasonColor> = {
  "/fancaps/29133604.jpg": {
    "accent": "oklch(0.74 0.05 90)",
    "accentSoft": "oklch(0.62 0.043 90)",
    "tint": "40 40 40"
  },
  "/fancaps/29131028.jpg": {
    "accent": "oklch(0.74 0.05 248)",
    "accentSoft": "oklch(0.62 0.043 248)",
    "tint": "152 168 184"
  },
  "/fancaps/29132373.jpg": {
    "accent": "oklch(0.74 0.081 39)",
    "accentSoft": "oklch(0.62 0.069 39)",
    "tint": "232 184 168"
  },
  "/seasons/metal-champion.png": {
    "accent": "oklch(0.74 0.05 249)",
    "accentSoft": "oklch(0.62 0.043 249)",
    "tint": "72 88 104"
  },
  "/seasons/metal-team.png": {
    "accent": "oklch(0.74 0.05 90)",
    "accentSoft": "oklch(0.62 0.043 90)",
    "tint": "8 8 8"
  },
  "/seasons/burst-clash.png": {
    "accent": "oklch(0.74 0.05 66)",
    "accentSoft": "oklch(0.62 0.043 66)",
    "tint": "72 56 40"
  },
  "/seasons/burst-valt.png": {
    "accent": "oklch(0.74 0.05 17)",
    "accentSoft": "oklch(0.62 0.043 17)",
    "tint": "248 232 232"
  },
  "/seasons/burst-aura.png": {
    "accent": "oklch(0.74 0.055 327)",
    "accentSoft": "oklch(0.62 0.047 327)",
    "tint": "24 8 24"
  },
  "/seasons/bakuten-team.png": {
    "accent": "oklch(0.74 0.05 90)",
    "accentSoft": "oklch(0.62 0.043 90)",
    "tint": "8 8 8"
  },
  "/seasons/bakuten-team2.png": {
    "accent": "oklch(0.74 0.05 90)",
    "accentSoft": "oklch(0.62 0.043 90)",
    "tint": "8 8 8"
  }
};
