'use client';

import { Box } from '@mui/material';
import {
  EpisodeGridSkeleton,
  HeroSkeleton,
} from '../_components/AnimeSkeletons';

export default function SeriesLoading() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a' }}>
      <HeroSkeleton />
      <Box sx={{ px: { xs: 2, md: 4 }, mt: 4 }}>
        <EpisodeGridSkeleton />
      </Box>
    </Box>
  );
}
