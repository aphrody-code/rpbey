'use client';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Image from 'next/image';
import { useState } from 'react';

interface FeaturedVideoProps {
  videoId: string;
}

export function FeaturedVideo({ videoId }: FeaturedVideoProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          borderRadius: { xs: 2.5, md: 3 },
          overflow: 'hidden',
          mb: { xs: 2, md: 3 },
          bgcolor: '#000',
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title="RPB TV"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      onClick={() => setPlaying(true)}
      sx={{
        position: 'relative',
        aspectRatio: '16/9',
        borderRadius: { xs: 2.5, md: 3 },
        overflow: 'hidden',
        mb: { xs: 2, md: 3 },
        cursor: 'pointer',
        '&:hover .play-btn': {
          transform: 'scale(1.1)',
          bgcolor: 'var(--rpb-primary)',
        },
        '&:hover img': { filter: 'brightness(0.7)' },
      }}
    >
      <Image
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt="Video a la une"
        fill
        priority
        style={{ objectFit: 'cover', transition: 'filter 0.25s' }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7))',
        }}
      />
      <Box
        className="play-btn"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 56, md: 72 },
          height: { xs: 56, md: 72 },
          borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s ease',
          backdropFilter: 'blur(4px)',
        }}
      >
        <PlayArrowIcon sx={{ color: '#fff', fontSize: { xs: 32, md: 40 } }} />
      </Box>
    </Box>
  );
}
