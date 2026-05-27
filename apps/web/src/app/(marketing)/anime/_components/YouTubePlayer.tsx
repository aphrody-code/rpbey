'use client';

import { Box } from '@mui/material';
import { useCallback, useState } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  title: string;
}

export function YouTubePlayer({ videoId, title }: YouTubePlayerProps) {
  const [active, setActive] = useState(false);

  const activate = useCallback(() => setActive(true), []);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    },
    [activate],
  );

  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbFallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (active) {
    return (
      <Box
        sx={{
          width: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#000',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%',
          }}
        >
          <Box
            component="iframe"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      onClick={activate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Lire ${title}`}
      sx={{
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: '#000',
        cursor: 'pointer',
        position: 'relative',
        '&:hover .yt-play-btn': {
          bgcolor: '#ff0000',
          opacity: 1,
        },
        '&:focus-visible': {
          outline: '2px solid #ff0000',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%',
        }}
      >
        {/* Thumbnail */}
        <Box
          component="img"
          src={thumbUrl}
          alt={title}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.src = thumbFallback;
          }}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            minHeight: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* YouTube play button */}
        <Box
          className="yt-play-btn"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 68,
            height: 48,
            bgcolor: 'rgba(23, 23, 23, 0.8)',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.9,
            transition: 'all 0.15s ease',
          }}
        >
          {/* Play triangle */}
          <Box
            sx={{
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '10px 0 10px 18px',
              borderColor: 'transparent transparent transparent #fff',
              ml: '3px',
            }}
          />
        </Box>

        {/* Title overlay at bottom */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            px: 2,
            py: 1.5,
          }}
        >
          <Box
            component="span"
            sx={{
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            {title}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
