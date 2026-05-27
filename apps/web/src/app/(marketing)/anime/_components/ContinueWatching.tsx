'use client';

import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getUserContinueWatching } from '@/server/actions/anime-progress';
import { EpisodeCard } from './EpisodeCard';

interface ProgressItem {
  id: string;
  progressTime: number;
  episode: {
    id: string;
    number: number;
    title: string;
    titleFr: string | null;
    thumbnailUrl: string | null;
    duration: number;
    series: {
      slug: string;
      title: string;
      posterUrl: string | null;
    };
  };
}

export function ContinueWatching() {
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    getUserContinueWatching().then((data) => {
      setItems(data as ProgressItem[]);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <Box sx={{ mb: { xs: 3.5, md: 5 } }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          px: { xs: 1.5, md: 4 },
          mb: { xs: 1.5, md: 2 },
          color: 'text.primary',
          fontSize: { xs: '0.95rem', md: '1.15rem' },
          display: 'flex',
          alignItems: 'center',
          gap: 1,

          '&::before': {
            content: '""',
            width: 4,
            height: 24,
            bgcolor: 'primary.main',
            borderRadius: 1,
            display: 'inline-block',
          },
        }}
      >
        Reprendre la lecture
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, md: 2 },
          px: { xs: 1.5, md: 4 },
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          WebkitOverflowScrolling: 'touch',
          py: 0.5,
        }}
      >
        {items.map((item) => (
          <Box
            key={item.id}
            sx={{
              minWidth: { xs: 220, sm: 250, md: 300 },
              flexShrink: 0,
              scrollSnapAlign: 'start',
            }}
          >
            <EpisodeCard
              seriesSlug={item.episode.series.slug}
              number={item.episode.number}
              title={`${item.episode.series.title} - ${item.episode.titleFr || item.episode.title}`}
              thumbnailUrl={item.episode.thumbnailUrl}
              duration={item.episode.duration}
              progress={
                item.episode.duration > 0
                  ? item.progressTime / item.episode.duration
                  : 0
              }
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
