'use client';

import dynamic from 'next/dynamic';

const EpisodePlayer = dynamic(
  () => import('./EpisodePlayer').then((m) => ({ default: m.EpisodePlayer })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          aspectRatio: '16/9',
          background: '#111',
          borderRadius: 12,
        }}
      />
    ),
  },
);

interface Props {
  title: string;
  src: string;
  sourceType: string;
  savedProgress: number;
  episodeId: string;
  duration: number;
  startTime?: number;
  onEnded?: () => void;
}

export function EpisodePlayerWrapper(props: Props) {
  return <EpisodePlayer {...props} />;
}
