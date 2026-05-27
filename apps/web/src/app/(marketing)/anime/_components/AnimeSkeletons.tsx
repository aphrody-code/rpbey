'use client';

import { Box, Skeleton } from '@mui/material';

export function HeroSkeleton() {
  return (
    <Box
      sx={{ position: 'relative', width: '100%', height: { xs: 400, md: 600 } }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
      />
    </Box>
  );
}

export function CarouselSkeleton() {
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, mb: 4 }}>
      <Skeleton
        width={200}
        height={32}
        sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.05)' }}
      />
      <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            sx={{
              width: { xs: 130, md: 180 },
              height: { xs: 195, md: 270 },
              borderRadius: 2,
              flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.05)',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export function EpisodeGridSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={i}>
          <Skeleton
            variant="rectangular"
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.05)',
            }}
          />
          <Skeleton
            width="70%"
            height={20}
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.05)' }}
          />
          <Skeleton
            width="40%"
            height={16}
            sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
          />
        </Box>
      ))}
    </Box>
  );
}

export function PlayerSkeleton() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Skeleton
        variant="rectangular"
        sx={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.05)',
        }}
      />
      <Skeleton
        width="60%"
        height={40}
        sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.05)' }}
      />
      <Skeleton
        width="80%"
        height={20}
        sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.05)' }}
      />
    </Box>
  );
}
