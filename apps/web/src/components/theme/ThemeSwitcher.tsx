'use client';

import { AcUnit, LocalFireDepartment } from '@mui/icons-material';
import { alpha, IconButton, Tooltip } from '@mui/material';
import { useThemeMode } from './ThemeRegistry';

export function ThemeSwitcher() {
  const { mode, toggleTheme } = useThemeMode();
  const isRed = mode === 'red';

  return (
    <Tooltip
      title={isRed ? 'Passer en Mode Bleu' : 'Passer en Mode Rouge'}
      placement="right"
    >
      <IconButton
        onClick={toggleTheme}
        aria-label={isRed ? 'Passer en Mode Bleu' : 'Passer en Mode Rouge'}
        sx={{
          width: '100%',
          height: 44,
          borderRadius: 0,
          color: isRed ? 'primary.main' : 'secondary.main',
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.3),
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.action.active, 0.1),
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: isRed ? 'primary.main' : 'secondary.main',
            outlineOffset: -2,
          },
        }}
      >
        {isRed ? (
          <LocalFireDepartment sx={{ fontSize: 22 }} />
        ) : (
          <AcUnit sx={{ fontSize: 22 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}
