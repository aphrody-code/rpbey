'use client';

import { Avatar, Box, LinearProgress, Typography } from '@mui/material';

import { type SynergyItem } from './types';

const DEFAULT_VISIBLE = 5;

export function SynergyList({
  synergies,
  color,
  expanded,
}: {
  synergies: SynergyItem[];
  color: string;
  expanded: boolean;
}) {
  if (synergies.length === 0) return null;

  const visible = expanded ? synergies : synergies.slice(0, DEFAULT_VISIBLE);
  const maxScore = Math.max(...synergies.map((s) => s.score), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      {visible.map((s) => (
        <Box
          key={s.name}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.75, md: 1 },
          }}
        >
          {s.imageUrl && (
            <Avatar
              src={s.imageUrl}
              variant="rounded"
              sx={{
                width: 16,
                height: 16,
                bgcolor: 'transparent',
                '& img': { objectFit: 'contain' },
              }}
            />
          )}
          <Typography
            variant="caption"
            sx={{
              width: { xs: 70, md: 100 },
              minWidth: { xs: 70, md: 100 },
              fontSize: { xs: '0.6rem', md: '0.65rem' },
              color: 'text.secondary',
              textAlign: s.imageUrl ? 'left' : 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {s.name}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(s.score / maxScore) * 100}
            sx={{
              flex: 1,
              height: { xs: 3, md: 4 },
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                bgcolor: color,
                borderRadius: 2,
                opacity: 0.7,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              width: { xs: 24, md: 28 },
              minWidth: { xs: 24, md: 28 },
              fontSize: { xs: '0.55rem', md: '0.6rem' },
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            {s.score}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
