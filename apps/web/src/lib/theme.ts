'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { fontFamily } from './fonts';

// ----------------------------------------------------------------------
// Type Augmentation
// ----------------------------------------------------------------------

declare module '@mui/material/styles' {
  interface Palette {
    surface: {
      lowest: string;
      low: string;
      main: string;
      high: string;
      highest: string;
    };
  }
  interface PaletteOptions {
    surface?: {
      lowest: string;
      low: string;
      main: string;
      high: string;
      highest: string;
    };
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
  interface PaletteColor {
    container?: string;
    onContainer?: string;
  }
  interface ColorSchemeOverrides {
    blue: true;
  }
}

declare module '@mui/material/Card' {
  interface CardPropsVariantOverrides {
    filled: true;
    elevated: true;
  }
}

declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides {
    filled: true;
    elevated: true;
  }
}

// ----------------------------------------------------------------------
// Constants (Material Design 3 & Brand Colors)
// ----------------------------------------------------------------------

const RPB_RED = '#dc2626'; // RPB Brand Red
const RPB_GOLD = '#fbbf24'; // RPB Brand Gold

// M3 Dark Surface Tones
const SURFACE_DARK = {
  lowest: '#0F0F0F',
  low: '#1D1B1B',
  main: '#211F1F',
  high: '#2B2929',
  highest: '#363434',
};

// Tournament Mode Colors
const TOURNAMENT_SKY = '#60A5FA';
const TOURNAMENT_BG = '#0f172a';
const TOURNAMENT_PAPER = '#1e293b';

// ----------------------------------------------------------------------
// Base Theme Options
// ----------------------------------------------------------------------

const commonOptions: ThemeOptions = {
  typography: {
    fontFamily,
    h1: {
      fontSize: '3rem',
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: '-0.03em',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
      fontVariationSettings: '"wght" 800, "opsz" 48, "wdth" 100',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
      '@media (max-width:600px)': {
        fontSize: '1.35rem',
      },
      fontVariationSettings: '"wght" 700, "opsz" 40, "wdth" 100',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.2,
      '@media (max-width:600px)': {
        fontSize: '1.2rem',
      },
      fontVariationSettings: '"wght" 600, "opsz" 32',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.25,
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
      fontVariationSettings: '"wght" 600, "opsz" 28',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.3,
      '@media (max-width:600px)': {
        fontSize: '0.95rem',
      },
      fontVariationSettings: '"wght" 500, "opsz" 24',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '0.85rem',
      },
      fontVariationSettings: '"wght" 500, "opsz" 20',
    },
    subtitle1: {
      fontSize: '0.925rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.85rem',
      },
      fontVariationSettings: '"wght" 500, "opsz" 16',
    },
    subtitle2: {
      fontSize: '0.825rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.75rem',
      },
      fontVariationSettings: '"wght" 500, "opsz" 14',
    },
    body1: {
      fontSize: '0.925rem',
      fontWeight: 400,
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.85rem',
      },
      fontVariationSettings: '"wght" 400, "opsz" 14',
    },
    body2: {
      fontSize: '0.825rem',
      fontWeight: 400,
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.75rem',
      },
      fontVariationSettings: '"wght" 400, "opsz" 12',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.04em',
      textTransform: 'none',
      fontVariationSettings: '"wght" 600, "opsz" 14',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.5,
      fontVariationSettings: '"wght" 400, "opsz" 12',
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontVariationSettings: '"wght" 600, "opsz" 12',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          padding: '10px 24px',
          fontWeight: 600,
          minHeight: 44,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          '&:last-child': {
            paddingBottom: 24,
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        variant: 'filled',
      },
      variants: [
        {
          props: { variant: 'elevated' },
          style: {
            backgroundColor: 'var(--rpb-surface-low)',
            boxShadow:
              '0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px rgba(0, 0, 0, 0.3)',
            border: 'none',
          },
        },
        {
          props: { variant: 'filled' },
          style: {
            backgroundColor: 'var(--rpb-surface-main)',
            boxShadow: 'none',
            border: 'none',
          },
        },
        {
          props: { variant: 'outlined' },
          style: {
            backgroundColor: 'var(--rpb-surface-lowest)',
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
        },
      ],
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          transition: 'all 0.2s ease-in-out',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'color-mix(in srgb, var(--rpb-bg) 80%, transparent)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'auto',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--rpb-surface-main)',
          height: 80,
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
          '&::-webkit-scrollbar': { height: '6px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          // Responsive padding for better mobile experience
          paddingLeft: '16px',
          paddingRight: '16px',
          '@media (min-width:600px)': {
            paddingLeft: '24px',
            paddingRight: '24px',
          },
          '@media (min-width:1200px)': {
            paddingLeft: '32px',
            paddingRight: '32px',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
      },
    },
  },
};

// ----------------------------------------------------------------------
// Theme Creation
// ----------------------------------------------------------------------

export const redTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: RPB_RED,
      container: '#8C0009',
      onContainer: '#FFDAD9',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: RPB_GOLD,
      container: '#534600',
      onContainer: '#FFE135',
      contrastText: '#000000',
    },
    background: {
      default: SURFACE_DARK.lowest,
      paper: SURFACE_DARK.main,
    },
    surface: SURFACE_DARK,
    text: {
      primary: '#F5F2F2',
      secondary: '#D1C4C4',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
});

export const blueTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: TOURNAMENT_SKY,
      container: '#1e3a8a',
      onContainer: '#dbeafe',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#93c5fd',
      container: '#1e40af',
      onContainer: '#eff6ff',
      contrastText: '#FFFFFF',
    },
    background: {
      default: TOURNAMENT_BG,
      paper: TOURNAMENT_PAPER,
    },
    surface: {
      lowest: '#020617',
      low: '#0f172a',
      main: '#1e293b',
      high: '#334155',
      highest: '#475569',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.1)',
  },
});

// For backward compatibility if needed, though we should prefer the exports above
export const theme = redTheme;

export type { ThemeMode } from '@/components/theme/ThemeRegistry';
