'use client';

import { Box, Grid, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import { PartRankCard } from './PartRankCard';
import {
  CATEGORY_COLORS,
  CATEGORY_PALETTE_KEY,
  type CategoryData,
} from './types';

export function CategorySection({ category }: { category: CategoryData }) {
  const theme = useTheme();
  const paletteKey = CATEGORY_PALETTE_KEY[category.category];
  const color = paletteKey
    ? ((theme.palette as unknown as Record<string, { main: string }>)[
        paletteKey
      ]?.main ??
      CATEGORY_COLORS[category.category] ??
      '#6b7280')
    : CATEGORY_COLORS[category.category] || '#6b7280';
  const maxScore = Math.max(...category.components.map((c) => c.score), 1);

  return (
    <Box>
      {/* Category Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 1.5 },
          mb: { xs: 1.5, md: 2 },
        }}
      >
        <Box
          sx={{
            width: 4,
            height: { xs: 24, md: 28 },
            borderRadius: 2,
            bgcolor: color,
          }}
        />
        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            letterSpacing: '-0.01em',
            fontSize: { xs: '1.1rem', md: '1.5rem' },
          }}
        >
          {category.category}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            fontWeight: 700,
            px: { xs: 0.75, md: 1 },
            py: 0.25,
            borderRadius: 1,
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          {category.components.length}
        </Typography>
      </Box>

      {/* Cards Grid */}
      <Grid container spacing={{ xs: 1, md: 1.5 }}>
        {category.components.map((comp, idx) => (
          <Grid key={comp.name} size={{ xs: 12, sm: 6, md: 4 }}>
            <PartRankCard
              component={comp}
              rank={idx + 1}
              color={color}
              maxScore={maxScore}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
