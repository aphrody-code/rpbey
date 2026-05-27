'use client';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Fab, Fade, useScrollTrigger } from '@mui/material';
import { useCallback } from 'react';

export function ScrollToTop() {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 400,
  });

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <Fade in={trigger}>
      <Fab
        onClick={handleClick}
        size="small"
        aria-label="Retour en haut de page"
        sx={{
          position: 'fixed',
          bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 32 },
          right: { xs: 16, md: 32 },
          zIndex: 1050,
          bgcolor: 'background.paper',
          color: 'primary.main',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          '&:hover': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Fade>
  );
}
