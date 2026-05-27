export const APP_NAME = 'RPB Dashboard';
export const APP_DESCRIPTION =
  'Le dashboard officiel de la République Populaire du Beyblade';

export const DISCORD_INVITE_URL = 'https://discord.gg/9ENMe2hQyU';

export const ROUTES = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  // Admin
  ADMIN: '/admin',
  ADMIN_DISCORD: '/admin/discord',
  ADMIN_TWITCH: '/admin/twitch',
  ADMIN_TOURNAMENTS: '/admin/tournaments',
  ADMIN_USERS: '/admin/users',
  ADMIN_STATS: '/admin/stats',
  ADMIN_SETTINGS: '/admin/settings',
  // Streaming
  TV: '/tv',
  // Public
  TOURNAMENTS: '/tournaments',
  RANKINGS: '/rankings',
  PROFILE: '/dashboard/profile',
} as const;

/** Discord IDs that always have superadmin access regardless of DB role. */
export const SUPERADMIN_DISCORD_IDS = ['790281823212273734'] as const;

/** Static brand colors for server-side / canvas contexts (no theme). */
export const RPB_BRAND = {
  red: '#dc2626',
  gold: '#fbbf24',
} as const;

/**
 * Theme-aware CSS variable references for client components.
 * Use these instead of hardcoded hex values.
 */
export const RPB_COLORS = {
  primary: 'var(--rpb-primary)',
  secondary: 'var(--rpb-secondary)',
  background: 'var(--rpb-bg)',
  paper: 'var(--rpb-paper)',
  surface: 'var(--rpb-surface-main)',
} as const;
