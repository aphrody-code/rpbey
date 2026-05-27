'use client';

import { Box } from '@mui/material';
import { EpisodeCard } from './EpisodeCard';

interface Episode {
  id: string;
  number: number;
  title: string;
  titleFr: string | null;
  thumbnailUrl: string | null;
  duration: number;
}

interface EpisodeGridProps {
  seriesSlug: string;
  episodes: Episode[];
  progressMap?: Record<string, { progressTime: number; status: string }>;
}

export function EpisodeGrid({
  seriesSlug,
  episodes,
  progressMap = {},
}: EpisodeGridProps) {
  return (
    <>
      {/* Mobile: Netflix-style vertical list */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {episodes.map((ep) => {
          const prog = progressMap[ep.id];
          const progressFraction =
            prog && ep.duration > 0
              ? prog.progressTime / ep.duration
              : undefined;

          return (
            <EpisodeCard
              key={ep.id}
              seriesSlug={seriesSlug}
              number={ep.number}
              title={ep.title}
              titleFr={ep.titleFr}
              thumbnailUrl={ep.thumbnailUrl}
              duration={ep.duration}
              progress={progressFraction}
              variant="list"
            />
          );
        })}
      </Box>

      {/* Tablet+: Grid layout */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'grid' },
          gridTemplateColumns: {
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2.5,
        }}
      >
        {episodes.map((ep) => {
          const prog = progressMap[ep.id];
          const progressFraction =
            prog && ep.duration > 0
              ? prog.progressTime / ep.duration
              : undefined;

          return (
            <EpisodeCard
              key={ep.id}
              seriesSlug={seriesSlug}
              number={ep.number}
              title={ep.title}
              titleFr={ep.titleFr}
              thumbnailUrl={ep.thumbnailUrl}
              duration={ep.duration}
              progress={progressFraction}
            />
          );
        })}
      </Box>
    </>
  );
}
