'use client';

import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';

import { type PeriodKey } from './types';

export function PeriodSwitcher({
  period,
  onChange,
}: {
  period: PeriodKey;
  onChange: (p: PeriodKey) => void;
}) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: { xs: 0, md: 'auto' },
        zIndex: { xs: 10, md: 'auto' },
        bgcolor: { xs: 'background.paper', md: 'transparent' },
        borderBottom: { xs: '1px solid', md: 'none' },
        borderColor: 'divider',
        mx: { xs: -2, md: 0 },
        px: { xs: 2, md: 0 },
        py: { xs: 1, md: 0 },
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <ToggleButtonGroup
        value={period}
        exclusive
        onChange={(_, val) => val && onChange(val as PeriodKey)}
        sx={{
          '& .MuiToggleButton-root': {
            px: { xs: 2.5, md: 4 },
            py: { xs: 0.75, md: 1 },
            fontWeight: 700,
            fontSize: { xs: '0.8rem', md: '0.95rem' },
            textTransform: 'none',
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'text.secondary',
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: '#fff',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            },
          },
        }}
      >
        <ToggleButton value="2weeks">2 Semaines</ToggleButton>
        <ToggleButton value="4weeks">4 Semaines</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
