'use client';

import { Box } from '@mui/material';
import { CarouselSkeleton, HeroSkeleton } from './_components/AnimeSkeletons';

export default function AnimeLoading() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a' }}>
      <HeroSkeleton />
      <CarouselSkeleton />
      <CarouselSkeleton />
      <CarouselSkeleton />
    </Box>
  );
}
