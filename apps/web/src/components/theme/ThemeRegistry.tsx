'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import * as React from 'react';
import 'dayjs/locale/fr';
import { ToastProvider } from '@/components/ui/Toast';
import { blueTheme, redTheme } from '@/lib/theme';

export type ThemeMode = 'red' | 'blue';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  backgroundImage: string;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined,
);

export function useThemeMode() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeRegistry');
  }
  return context;
}

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = React.useState<ThemeMode>('red');
  // Load theme from localStorage on mount
  React.useEffect(() => {
    const savedMode = localStorage.getItem('rpb-theme-mode');
    // Migrate legacy values
    if (savedMode === 'dark') {
      setModeState('red');
      localStorage.setItem('rpb-theme-mode', 'red');
    } else if (savedMode === 'tournament') {
      setModeState('blue');
      localStorage.setItem('rpb-theme-mode', 'blue');
    } else if (savedMode === 'red' || savedMode === 'blue') {
      setModeState(savedMode);
    }
  }, []);

  const setTheme = React.useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('rpb-theme-mode', newMode);
  }, []);

  const toggleTheme = React.useCallback(() => {
    const newMode = mode === 'red' ? 'blue' : 'red';
    setTheme(newMode);
  }, [mode, setTheme]);

  const backgroundImage = '/rap-bg.webp';

  const activeTheme = mode === 'blue' ? blueTheme : redTheme;

  // Apply theme colors to body + CSS variables for global reach
  React.useEffect(() => {
    const p = activeTheme.palette;
    const root = document.documentElement;
    document.body.style.backgroundColor = p.background.default;
    document.body.style.color = p.text.primary;
    document.body.style.transition =
      'background-color 0.3s ease, color 0.3s ease';

    // Helper: hex → "r, g, b" string for rgba() usage
    const hexToRgb = (hex: string) => {
      const n = Number.parseInt(hex.replace('#', ''), 16);
      return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    };

    // CSS custom properties so hardcoded colors can reference the theme
    root.style.setProperty('--rpb-primary', p.primary.main);
    root.style.setProperty('--rpb-primary-rgb', hexToRgb(p.primary.main));
    root.style.setProperty('--rpb-secondary', p.secondary.main);
    root.style.setProperty('--rpb-secondary-rgb', hexToRgb(p.secondary.main));
    root.style.setProperty('--rpb-bg', p.background.default);
    root.style.setProperty('--rpb-paper', p.background.paper);
    root.style.setProperty('--rpb-text', p.text.primary);
    root.style.setProperty('--rpb-text-secondary', p.text.secondary);
    root.style.setProperty('--rpb-divider', p.divider);
    // Surface tones
    root.style.setProperty('--rpb-surface-lowest', p.surface.lowest);
    root.style.setProperty('--rpb-surface-low', p.surface.low);
    root.style.setProperty('--rpb-surface-main', p.surface.main);
    root.style.setProperty('--rpb-surface-high', p.surface.high);
    root.style.setProperty('--rpb-surface-highest', p.surface.highest);
    // Container colors
    root.style.setProperty(
      '--rpb-primary-container',
      p.primary.container ?? p.primary.dark,
    );
    root.style.setProperty(
      '--rpb-primary-on-container',
      p.primary.onContainer ?? p.primary.light,
    );
  }, [activeTheme]);

  const value = React.useMemo(
    () => ({
      mode,
      toggleTheme,
      setTheme,
      backgroundImage,
    }),
    [mode, toggleTheme, setTheme],
  );

  return (
    <AppRouterCacheProvider>
      <ThemeContext.Provider value={value}>
        <ThemeProvider theme={activeTheme}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
            <ToastProvider>
              <CssBaseline />
              {children}
            </ToastProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </ThemeContext.Provider>
    </AppRouterCacheProvider>
  );
}
