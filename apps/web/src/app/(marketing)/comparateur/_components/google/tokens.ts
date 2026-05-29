// Tokens visuels dark Google extraits des captures de référence (ANALYSE.md §"Tokens dark extraits").
// Les accents RPB utilisent les CSS vars du ThemeRegistry pour rester multi-thème.

// Fond de page global (~#202124)
export const BG = "var(--rpb-bg, #202124)";
// Bandeau header SERP (légèrement plus sombre)
export const BG_DEEP = "#161719";
// Surface : barres, cartes Knowledge/sources (~#303134)
export const SURFACE = "var(--rpb-surface-main, #303134)";
// Survol surface : chips, boutons home (~#3c4043)
export const SURFACE_HOVER = "var(--rpb-surface-high, #3c4043)";
// Contour barre focus, séparateurs
export const BORDER = "#3c4043";
export const BORDER_FOCUS = "#5f6368";
// Texte primaire (titres, corps réponse IA)
export const TEXT_PRIMARY = "var(--rpb-text, #e8eaed)";
// Texte secondaire (snippets, URL/breadcrumb)
export const TEXT_SECONDARY = "var(--rpb-text-secondary, #bdc1c6)";
// Texte tertiaire (placeholder, méta discrète)
export const TEXT_TERTIARY = "#9aa0a6";
// Liens titres de résultats (bleu dark Google)
export const LINK_BLUE = "#8ab4f8";
// Liens visités
export const LINK_VISITED = "#c58af9";
// Accent RPB (primary du thème actif)
export const ACCENT = "var(--rpb-primary)";
// Second accent RPB (secondary du thème actif)
export const ACCENT2 = "var(--rpb-secondary)";

// Gradient "sparkle / IA" : bleu→violet→rose, recalé sur les vars RPB quand possible.
// Fallback Google exact : #4285f4 → #9b72cb → #d96570
export const GRADIENT_AI =
  "linear-gradient(135deg, var(--rpb-primary, #4285f4), #9b72cb, var(--rpb-secondary, #d96570))";

// Gradient texte pour le wordmark RPB
export const GRADIENT_WORDMARK =
  "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))";

// Survol icones (on-surface à 8 % d'opacité — rôle MD3 "state layer hover")
export const ICON_HOVER_BG = "color-mix(in srgb, var(--rpb-text, #e8eaed) 8%, transparent)";
// Contour avatar au hover (on-surface à 25 %)
export const AVATAR_HOVER_BORDER = "color-mix(in srgb, var(--rpb-text, #e8eaed) 25%, transparent)";

// Icone sur fond de gradient (cercle sparkle) — on-primary sémantique
export const ON_GRADIENT = "var(--rpb-primary-on-container, #fff)";
// Prix favorable (vert success — semantic positive)
export const PRICE_GOOD = "var(--rpb-price-good, #22c55e)";
// Overlay sombre sur surface image (~scrim MD3)
export const SURFACE_SCRIM = "color-mix(in srgb, #000 25%, transparent)";
// Fond de chip subtil sur surface (~on-surface 5%)
export const CHIP_BG = "color-mix(in srgb, var(--rpb-text, #e8eaed) 5%, transparent)";

// Dimensions canoniques de la barre de recherche
export const FIELD_BORDER_RADIUS = "24px";
export const FIELD_HEIGHT = "52px";
export const FIELD_MAX_WIDTH = "584px";
export const FIELD_MAX_WIDTH_AI = "760px";
