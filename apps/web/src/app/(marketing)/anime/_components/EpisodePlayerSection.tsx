'use client';

import { Box } from '@mui/material';
import { useState } from 'react';
import { EpisodeViewer } from './EpisodeViewer';
import { NextEpisodeOverlay } from './NextEpisodeOverlay';

interface Source {
  id: string;
  type: string;
  url: string;
  quality: string;
  language: string;
  priority: number;
}

interface NextEp {
  number: number;
  title: string;
  titleFr: string | null;
}

interface EpisodePlayerSectionProps {
  title: string;
  sources: Source[];
  savedProgress: number;
  episodeId: string;
  duration: number;
  seriesSlug: string;
  nextEpisode: NextEp | null;
}

export function EpisodePlayerSection({
  title,
  sources,
  savedProgress,
  episodeId,
  duration,
  seriesSlug,
  nextEpisode,
}: EpisodePlayerSectionProps) {
  const [showNext, setShowNext] = useState(false);

  return (
    <Box>
      <EpisodeViewer
        title={title}
        sources={sources}
        savedProgress={savedProgress}
        episodeId={episodeId}
        duration={duration}
        seriesSlug={seriesSlug}
        onEnded={nextEpisode ? () => setShowNext(true) : undefined}
      />
      {showNext && nextEpisode && (
        <NextEpisodeOverlay
          seriesSlug={seriesSlug}
          nextNumber={nextEpisode.number}
          nextTitle={nextEpisode.titleFr || nextEpisode.title}
        />
      )}
    </Box>
  );
}
