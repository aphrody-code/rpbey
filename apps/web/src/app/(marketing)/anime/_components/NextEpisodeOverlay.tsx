'use client';

import { SkipNext } from '@mui/icons-material';
import { Box, Button, LinearProgress, Typography } from '@mui/material';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface NextEpisodeOverlayProps {
  seriesSlug: string;
  nextNumber: number;
  nextTitle: string;
}

const COUNTDOWN_SECONDS = 8;

export function NextEpisodeOverlay({
  seriesSlug,
  nextNumber,
  nextTitle,
}: NextEpisodeOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (secondsLeft <= 0) {
      window.location.href = `/anime/${seriesSlug}/${nextNumber}`;
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, dismissed, seriesSlug, nextNumber]);

  if (dismissed) return null;

  const progress =
    ((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100;

  return (
    <Box
      sx={{
        mt: 2,
        mx: { xs: 1, md: 0 },
        p: 2,
        borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}
        >
          Épisode suivant dans {secondsLeft}s
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: 'white',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          EP {nextNumber} · {nextTitle}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 1,
            height: 3,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              bgcolor: 'primary.main',
              borderRadius: 2,
            },
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button
          onClick={() => setDismissed(true)}
          size="small"
          sx={{
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'none',
            fontSize: '0.75rem',
            minWidth: 'auto',
            '&:hover': { color: 'white' },
          }}
        >
          Annuler
        </Button>
        <Button
          component={Link}
          href={`/anime/${seriesSlug}/${nextNumber}`}
          variant="contained"
          size="small"
          endIcon={<SkipNext />}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            fontWeight: 700,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '0.8rem',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          Lancer
        </Button>
      </Box>
    </Box>
  );
}
