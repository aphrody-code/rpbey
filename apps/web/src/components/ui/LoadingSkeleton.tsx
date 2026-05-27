'use client';

import { Box, Skeleton, Stack } from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'profile' | 'table';
  count?: number;
}

export function LoadingSkeleton({
  variant = 'card',
  count = 3,
}: LoadingSkeletonProps) {
  switch (variant) {
    case 'card':
      return (
        <Stack spacing={2}>
          {Array.from({ length: count }).map((_, i) => (
            <Box
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
              key={i}
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Skeleton
                variant="rectangular"
                height={120}
                sx={{ borderRadius: 1, mb: 2 }}
              />
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
          ))}
        </Stack>
      );

    case 'list':
      return (
        <Stack spacing={1}>
          {Array.from({ length: count }).map((_, i) => (
            <Box
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
              key={i}
              sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}
            >
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={24} />
                <Skeleton variant="text" width="40%" height={18} />
              </Box>
            </Box>
          ))}
        </Stack>
      );

    case 'profile':
      return (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Skeleton
            variant="circular"
            width={100}
            height={100}
            sx={{ mx: 'auto', mb: 2 }}
          />
          <Skeleton
            variant="text"
            width="50%"
            height={32}
            sx={{ mx: 'auto' }}
          />
          <Skeleton
            variant="text"
            width="30%"
            height={20}
            sx={{ mx: 'auto' }}
          />
        </Box>
      );

    case 'table':
      return (
        <Box>
          <Skeleton variant="rectangular" height={48} sx={{ mb: 1 }} />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
              key={i}
              variant="rectangular"
              height={52}
              sx={{ mb: 0.5 }}
            />
          ))}
        </Box>
      );

    default:
      return <Skeleton variant="rectangular" height={200} />;
  }
}
