/**
 * Tokens couleurs MD3-like pour la card OG tournoi Challonge.
 *
 * Les valeurs sont choisies pour matcher la DA Patreon RPB :
 * fond marine `#0c1730` + accent rose `#e91e63`. La palette `light` cible
 * les previews Discord/Twitter en mode clair (rare cote OG mais robuste).
 */

export type OgTheme = "light" | "dark";

export interface OgPalette {
  background: string;
  backgroundAccent: string;
  surface: string;
  surfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  secondary: string;
  tertiary: string;
  onSurface: string;
  onSurfaceVariant: string;
  muted: string;
  gold: string;
  silver: string;
  bronze: string;
  live: string;
  success: string;
  error: string;
}

export const PALETTES: Record<OgTheme, OgPalette> = {
  dark: {
    background: "#0c1730",
    backgroundAccent: "#1a2547",
    surface: "rgba(255, 255, 255, 0.06)",
    surfaceVariant: "rgba(255, 255, 255, 0.04)",
    outline: "rgba(255, 255, 255, 0.18)",
    outlineVariant: "rgba(255, 255, 255, 0.10)",
    primary: "#e91e63",
    primaryContainer: "rgba(233, 30, 99, 0.18)",
    onPrimary: "#ffffff",
    secondary: "#ec407a",
    tertiary: "#ffd54f",
    onSurface: "#f5f6fa",
    onSurfaceVariant: "#c2c8d6",
    muted: "#8a90a3",
    gold: "#ffd54f",
    silver: "#c0c8d4",
    bronze: "#cd7f32",
    live: "#ff5252",
    success: "#66bb6a",
    error: "#ef5350",
  },
  light: {
    background: "#fdf2f6",
    backgroundAccent: "#ffffff",
    surface: "#ffffff",
    surfaceVariant: "#f3e6ec",
    outline: "rgba(12, 23, 48, 0.16)",
    outlineVariant: "rgba(12, 23, 48, 0.08)",
    primary: "#c2185b",
    primaryContainer: "rgba(194, 24, 91, 0.12)",
    onPrimary: "#ffffff",
    secondary: "#ad1457",
    tertiary: "#f57c00",
    onSurface: "#1a1623",
    onSurfaceVariant: "#534956",
    muted: "#7a6f7d",
    gold: "#f5b700",
    silver: "#a3a8b5",
    bronze: "#9e5b27",
    live: "#d32f2f",
    success: "#2e7d32",
    error: "#c62828",
  },
};

export function getPalette(theme: OgTheme): OgPalette {
  return PALETTES[theme] ?? PALETTES.dark;
}
