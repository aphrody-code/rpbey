'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { useState } from 'react';
import { type StreamInfo } from '@/lib/twitch';

interface LiveBannerProps {
  stream: StreamInfo;
  domain: string;
}

export function LiveBanner({ stream, domain }: LiveBannerProps) {
  const [playing, setPlaying] = useState(false);

  if (!stream.isLive) return null;

  const parent =
    typeof window !== 'undefined' ? window.location.hostname : domain;

  if (playing) {
    return (
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          borderRadius: { xs: 2.5, md: 3 },
          overflow: 'hidden',
          bgcolor: '#000',
          mb: { xs: 2, md: 3 },
        }}
      >
        <iframe
          src={`https://player.twitch.tv/?channel=rpbey&parent=${parent}&parent=${domain}&autoplay=true`}
          title={stream.title || 'RPB Live'}
          allow="autoplay; fullscreen"
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
        bgcolor: '#000',
        cursor: 'pointer',
        mb: { xs: 2, md: 3 },
        '&:hover img': { filter: 'brightness(0.7)' },
      }}
    >
      {stream.thumbnailUrl && (
        <Image
          src={stream.thumbnailUrl}
          alt={stream.title || 'En direct'}
          fill
          priority
          style={{ objectFit: 'cover', transition: 'filter 0.25s' }}
        />
      )}

      {/* Dark overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* LIVE badge */}
      <Box
        sx={{
          position: 'absolute',
          top: { xs: 12, md: 16 },
          left: { xs: 12, md: 16 },
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          sx={{
            bgcolor: '#ff0000',
            color: '#fff',
            borderRadius: 1,
            px: 1,
            py: 0.3,
            fontSize: '0.75rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#fff',
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          EN DIRECT
        </Box>
        {stream.viewerCount != null && (
          <Typography
            sx={{
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: 'rgba(0,0,0,0.6)',
              borderRadius: 1,
              px: 0.8,
              py: 0.3,
            }}
          >
            {new Intl.NumberFormat('fr-FR').format(stream.viewerCount)}{' '}
            spectateurs
          </Typography>
        )}
      </Box>

      {/* Bottom info */}
      <Box
        sx={{
          position: 'absolute',
          bottom: { xs: 12, md: 20 },
          left: { xs: 12, md: 20 },
          right: { xs: 12, md: 20 },
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1.5,
        }}
      >
        {stream.avatarUrl && (
          <Box
            component="img"
            src={stream.avatarUrl}
            alt={stream.userName}
            sx={{
              width: { xs: 40, md: 48 },
              height: { xs: 40, md: 48 },
              borderRadius: '50%',
              border: '2px solid #ff0000',
              flexShrink: 0,
            }}
          />
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '0.95rem', md: '1.15rem' },
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {stream.title}
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {stream.userName}
            {stream.gameName ? ` \u2022 ${stream.gameName}` : ''}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
