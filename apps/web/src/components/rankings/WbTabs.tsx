'use client';

import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface WbTabsProps {
  mode: 'ranking' | 'career';
  totalBladers: number;
  totalMatches: number;
  tournamentCount: number;
  uniqueParticipants: number;
}

export function WbTabs({
  mode,
  totalBladers,
  totalMatches,
  tournamentCount,
  uniqueParticipants,
}: WbTabsProps) {
  const searchParams = useSearchParams();

  const getHref = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.delete('page');
    return `/tournaments/wb?${params.toString()}`;
  };

  const stats = [
    { label: 'BLADERS', value: totalBladers, color: 'var(--rpb-primary)' },
    {
      label: 'MATCHS',
      value: totalMatches.toLocaleString(),
      color: '#fff',
    },
    { label: 'TOURNOIS', value: tournamentCount, color: '#60a5fa' },
    {
      label: 'PARTICIPANTS',
      value: uniqueParticipants,
      color: '#a78bfa',
    },
  ];

  return (
    <Box
      sx={{
        mb: 4,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'center' },
        gap: 2,
        p: 1,
        borderRadius: 4,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Tabs
        value={mode}
        sx={{
          minHeight: 48,
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: 0,
            bgcolor: 'primary.main',
            boxShadow: '0 0 12px rgba(var(--rpb-primary-rgb), 0.5)',
          },
        }}
      >
        <Tab
          label="Ultim Bataille"
          value="ranking"
          component={Link}
          href={getHref('ranking')}
          sx={{
            fontWeight: 900,
            textTransform: 'none',
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.5)',
            '&.Mui-selected': { color: '#fff' },
          }}
        />
        <Tab
          label="Historique des UB"
          value="career"
          component={Link}
          href={getHref('career')}
          sx={{
            fontWeight: 900,
            textTransform: 'none',
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.5)',
            '&.Mui-selected': { color: '#fff' },
          }}
        />
      </Tabs>
      <Stack direction="row" spacing={{ xs: 2, md: 4 }} sx={{ px: 2 }}>
        {stats.map((s) => (
          <Box key={s.label} sx={{ textAlign: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                fontWeight: 800,
                letterSpacing: 1,
                fontSize: { xs: '0.55rem', md: '0.65rem' },
              }}
            >
              {s.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: '900',
                color: s.color,
                lineHeight: 1.2,
              }}
            >
              {s.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
