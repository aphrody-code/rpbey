'use client';

import { Box, Link, Typography } from '@mui/material';
import { useState } from 'react';

import { CategorySection } from './CategorySection';
import { MetaStatsBar } from './MetaStatsBar';
import { PeriodSwitcher } from './PeriodSwitcher';
import { type BbxWeeklyData, type CategoryData, type PeriodKey } from './types';

const CATEGORY_ORDER = ['Blade', 'Ratchet', 'Bit', 'Lock Chip', 'Assist Blade'];

function sortCategories(categories: CategoryData[]): CategoryData[] {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function MetaClient({ data }: { data: BbxWeeklyData }) {
  const [period, setPeriod] = useState<PeriodKey>('4weeks');
  const periodData = data.periods[period];
  const sortedCategories = sortCategories(periodData.categories);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 4 } }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 900,
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.6rem', md: '3rem' },
          }}
        >
          Meta Beyblade X
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
            maxWidth: 600,
            mx: 'auto',
            fontSize: { xs: '0.8rem', md: '0.875rem' },
          }}
        >
          Rankings basés sur les podiums des tournois{' '}
          <Link
            href="https://worldbeyblade.org"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main' }}
          >
            WBO
          </Link>
        </Typography>
      </Box>
      {/* Period Switcher - Sticky on mobile */}
      <PeriodSwitcher period={period} onChange={setPeriod} />
      {/* Stats Bar */}
      <MetaStatsBar metadata={periodData.metadata} scrapedAt={data.scrapedAt} />
      {/* Category Sections */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2.5, md: 4 },
          mt: { xs: 2, md: 4 },
        }}
      >
        {sortedCategories.map((cat) => (
          <CategorySection key={cat.category} category={cat} />
        ))}
      </Box>
      {/* Footer */}
      <Box
        sx={{
          textAlign: 'center',
          mt: { xs: 4, md: 6 },
          mb: 2,
          pb: { xs: 10, md: 0 },
          opacity: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: { xs: '0.65rem', md: '0.75rem' },
          }}
        >
          Données :{' '}
          <Link
            href="https://bbxweekly.com"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            sx={{ textDecoration: 'underline' }}
          >
            BBX Weekly
          </Link>{' '}
          &middot; Source :{' '}
          <Link
            href="https://worldbeyblade.org"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            sx={{ textDecoration: 'underline' }}
          >
            WBO
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
