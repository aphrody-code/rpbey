'use client';

import { FiberManualRecord } from '@mui/icons-material';
import { alpha, Box, Chip, Stack, Typography } from '@mui/material';
import { type TournamentStatus, TournamentStatusChip } from '@/components/ui';

interface Props {
  name: string;
  status: string;
  isBTS: boolean;
  isLive: boolean;
  liveCounters?: {
    completed: number;
    total: number;
  } | null;
}

export function TournamentHeader({
  name,
  status,
  isBTS,
  isLive,
  liveCounters,
}: Props) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <TournamentStatusChip
          status={(status || '').toLowerCase() as TournamentStatus}
        />
        {isBTS && (
          <Chip
            label="OFFICIEL RPB"
            size="small"
            sx={{
              bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
              color: 'secondary.main',
              fontWeight: 900,
              fontSize: '0.65rem',
              letterSpacing: 1,
              border: (t) =>
                `1px solid ${alpha(t.palette.secondary.main, 0.3)}`,
            }}
          />
        )}
        {isLive && (
          <Chip
            icon={
              <FiberManualRecord
                sx={{ fontSize: 10, animation: 'pulse 1.5s infinite' }}
              />
            }
            label="LIVE"
            size="small"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              fontWeight: 900,
              px: 1,
            }}
          />
        )}
        {isLive && liveCounters && liveCounters.total > 0 && (
          <Chip
            label={`${liveCounters.completed}/${liveCounters.total} matchs`}
            size="small"
            variant="outlined"
            sx={{
              fontWeight: 700,
              borderColor: 'primary.main',
              color: 'primary.main',
            }}
          />
        )}
      </Stack>
      <Typography
        variant="h1"
        sx={{
          fontWeight: '900',
          letterSpacing: '-0.05em',
          fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
          lineHeight: 1,
          mb: 2,
          textTransform: 'uppercase',
        }}
      >
        {name}
      </Typography>
    </Box>
  );
}
