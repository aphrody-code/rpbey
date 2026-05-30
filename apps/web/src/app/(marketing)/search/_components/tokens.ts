// Tokens visuels /search — alias des rôles Material 3 (--md-sys-color-*).
// Le rendu réel passe par les CSS Modules + le scope `.m3-search` (m3.css) ;
// ces constantes restent disponibles pour tout usage en style inline et
// pointent désormais sur le système M3 (plus de palette « Google dark »).
// Aucun import @mui.

// Surfaces (échelle tonale M3)
export const BG = "var(--md-sys-color-surface)";
export const BG_DEEP = "var(--md-sys-color-surface-container-lowest)";
export const SURFACE = "var(--md-sys-color-surface-container)";
export const SURFACE_HOVER = "var(--md-sys-color-surface-container-high)";
// Contours
export const BORDER = "var(--md-sys-color-outline-variant)";
export const BORDER_FOCUS = "var(--md-sys-color-outline)";
// Textes
export const TEXT_PRIMARY = "var(--md-sys-color-on-surface)";
export const TEXT_SECONDARY = "var(--md-sys-color-on-surface-variant)";
export const TEXT_TERTIARY = "var(--md-sys-color-outline)";
// Liens — identité A : titre neutre, accent au survol
export const LINK_BLUE = "var(--md-sys-color-on-surface)";
export const LINK_VISITED = "var(--md-sys-color-on-surface-variant)";
// Accents marque (rouge RPB conservé via --rpb-primary runtime)
export const ACCENT = "var(--rpb-primary)";
export const ACCENT2 = "var(--md-sys-color-secondary)";
// Gradient sparkle IA (Gemini) — STRICTEMENT réservé à l'affordance IA
export const GRADIENT_AI = "var(--rpb-gradient-ai)";
// Gradient wordmark RPB
export const GRADIENT_WORDMARK =
  "linear-gradient(135deg, var(--rpb-primary), var(--md-sys-color-tertiary))";
// Survol icones (state layer hover MD3)
export const ICON_HOVER_BG = "color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)";
// Couleur on-gradient (icone sur fond sparkle)
export const ON_GRADIENT = "var(--md-sys-color-on-primary-container)";
// Prix favorable
export const PRICE_GOOD = "var(--rpb-price-good)";
// Overlay sombre (scrim image MD3)
export const SURFACE_SCRIM = "color-mix(in srgb, var(--md-sys-color-scrim) 35%, transparent)";
// Fond chip subtil
export const CHIP_BG = "color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent)";

// Dimensions canoniques barre de recherche
export const FIELD_BORDER_RADIUS = "var(--md-sys-shape-corner-full, 28px)";
export const FIELD_HEIGHT = "52px";
export const FIELD_MAX_WIDTH = "584px";
export const FIELD_MAX_WIDTH_AI = "760px";
