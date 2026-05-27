/**
 * RPB Role Colors
 * Used for dynamic theming of logos, badges, and UI elements per role.
 */

export const RoleColors = {
  // Modération - Purple
  MODO: {
    hex: '#9b59b6',
    rgb: 'rgb(155, 89, 182)',
    name: 'Modérateur',
  },
  // Staff - Dark Blue
  STAFF: {
    hex: '#206694',
    rgb: 'rgb(32, 102, 148)',
    name: 'Staff',
  },
  // Administration - Green
  ADMIN: {
    hex: '#27a169',
    rgb: 'rgb(39, 161, 105)',
    name: 'Administrateur',
  },
  // Ressources Humaines - Blue
  RH: {
    hex: '#3498db',
    rgb: 'rgb(52, 152, 219)',
    name: 'Ressources Humaines',
  },
  // Arbitre - Amber
  ARBITRE: {
    hex: '#f59e0b',
    rgb: 'rgb(245, 158, 11)',
    name: 'Arbitre',
  },
  // Default RPB Colors (from constants)
  DEFAULT: {
    primary: '#dc2626', // RPB Red
    secondary: '#fbbf24', // RPB Gold
    accent: '#ea580c', // Orange (star outline)
  },
} as const;

export type RoleType = keyof typeof RoleColors;

/**
 * Get CSS filter to recolor an image to a specific role color
 * Useful for PNG/icon recoloring via CSS filters
 */
export function getRoleFilter(role: RoleType): string {
  // These filters approximate the target colors when applied to a white/light image
  const filters: Record<RoleType, string> = {
    MODO: 'brightness(0) saturate(100%) invert(37%) sepia(52%) saturate(747%) hue-rotate(238deg) brightness(87%) contrast(91%)',
    STAFF:
      'brightness(0) saturate(100%) invert(32%) sepia(98%) saturate(407%) hue-rotate(167deg) brightness(93%) contrast(87%)',
    ADMIN:
      'brightness(0) saturate(100%) invert(48%) sepia(69%) saturate(419%) hue-rotate(109deg) brightness(94%) contrast(87%)',
    RH: 'brightness(0) saturate(100%) invert(55%) sepia(57%) saturate(525%) hue-rotate(176deg) brightness(97%) contrast(89%)',
    ARBITRE:
      'brightness(0) saturate(100%) invert(67%) sepia(34%) saturate(4675%) hue-rotate(1deg) brightness(103%) contrast(96%)',
    DEFAULT: 'none',
  };
  return filters[role];
}

/**
 * Map Discord role IDs to our role types
 */
export const DiscordRoleMapping: Record<string, RoleType> = {
  '1319720685714804809': 'ADMIN',
  '1446871643753418793': 'RH',
  '1448458421702754474': 'MODO',
  '1331256093434712095': 'STAFF',
  '1460095694151876869': 'ARBITRE',
};

/**
 * Get role type from Discord role ID
 */
export function getRoleTypeFromDiscordId(roleId: string): RoleType {
  return DiscordRoleMapping[roleId] ?? 'DEFAULT';
}

/**
 * Standard logo variants used for animations and role-based displays
 */
export const LOGO_VARIANTS = [
  { src: '/logo.webp', color: '#dc2626', role: 'RPB' },
  { src: '/logo-admin.webp', color: '#27a169', role: 'ADMIN' },
  { src: '/logo-rh.webp', color: '#3498db', role: 'RH' },
  { src: '/logo-modo.webp', color: '#9b59b6', role: 'MODO' },
  { src: '/logo-staff.webp', color: '#206694', role: 'STAFF' },
] as const;
