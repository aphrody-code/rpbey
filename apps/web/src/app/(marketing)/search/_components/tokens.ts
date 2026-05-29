// Tokens visuels dark Google — CSS vars RPB avec fallbacks Google dark exact.
// Aucun import @mui. Consommes directement dans les CSS Modules via var().

// Fond global (~#202124)
export const BG = "var(--rpb-bg, #202124)";
// Bandeau header SERP (plus sombre)
export const BG_DEEP = "#161719";
// Surface : barres, cartes (~#303134)
export const SURFACE = "var(--rpb-surface-main, #303134)";
// Survol surface
export const SURFACE_HOVER = "var(--rpb-surface-high, #3c4043)";
// Contours
export const BORDER = "#3c4043";
export const BORDER_FOCUS = "#5f6368";
// Textes
export const TEXT_PRIMARY = "var(--rpb-text, #e8eaed)";
export const TEXT_SECONDARY = "var(--rpb-text-secondary, #bdc1c6)";
export const TEXT_TERTIARY = "#9aa0a6";
// Liens
export const LINK_BLUE = "#8ab4f8";
export const LINK_VISITED = "#c58af9";
// Accents RPB
export const ACCENT = "var(--rpb-primary)";
export const ACCENT2 = "var(--rpb-secondary)";
// Gradient sparkle IA (Gemini) — STRICTEMENT réservé à l'affordance IA
export const GRADIENT_AI = "linear-gradient(90deg, #4285f4, #9b72cb, #d96570)";
// Gradient wordmark RPB
export const GRADIENT_WORDMARK =
  "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))";
// Survol icones (state layer hover MD3)
export const ICON_HOVER_BG = "color-mix(in srgb, var(--rpb-text, #e8eaed) 8%, transparent)";
// Couleur on-gradient (icone sur fond sparkle)
export const ON_GRADIENT = "var(--rpb-primary-on-container, #fff)";
// Prix favorable
export const PRICE_GOOD = "var(--rpb-price-good, #22c55e)";
// Overlay sombre (scrim image MD3)
export const SURFACE_SCRIM = "color-mix(in srgb, #000 25%, transparent)";
// Fond chip subtil
export const CHIP_BG = "color-mix(in srgb, var(--rpb-text, #e8eaed) 5%, transparent)";

// Dimensions canoniques barre de recherche
export const FIELD_BORDER_RADIUS = "24px";
export const FIELD_HEIGHT = "52px";
export const FIELD_MAX_WIDTH = "584px";
export const FIELD_MAX_WIDTH_AI = "760px";
