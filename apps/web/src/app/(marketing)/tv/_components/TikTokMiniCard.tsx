'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { type TikTokVideo } from '@/lib/tiktok-types';

interface TikTokMiniCardProps {
  video: TikTokVideo;
}

const compactNumber = (n: number) =>
  new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(n);

export function TikTokMiniCard({ video }: TikTokMiniCardProps) {
  return (
    <Box
      component="a"
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        '&:hover .tt-thumb img': {
          filter: 'brightness(0.8)',
        },
      }}
    >
      {/* Thumbnail (9:16 portrait) */}
      <Box
        className="tt-thumb"
        sx={{
          position: 'relative',
          aspectRatio: '9/16',
          borderRadius: { xs: 2, sm: 2.5 },
          overflow: 'hidden',
          bgcolor: '#0a0a0a',
        }}
      >
        <Image
          src={video.cover}
          alt={video.desc || 'TikTok'}
          fill
          loading="lazy"
          unoptimized
          style={{ objectFit: 'cover', transition: 'filter 0.2s' }}
        />

        {/* Gradient overlay at bottom */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 35%)',
          }}
        />

        {/* Platform badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            bgcolor: '#000',
            color: '#fff',
            borderRadius: 0.5,
            px: 0.5,
            py: 0.1,
            fontSize: '0.6rem',
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          TikTok
        </Box>

        {/* Stats at bottom */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            display: 'flex',
            gap: 1,
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        >
          <span>{compactNumber(video.stats.playCount)}</span>
          <span>&middot;</span>
          <span>{compactNumber(video.stats.diggCount)} &#9829;</span>
        </Box>
      </Box>

      {/* Meta */}
      <Box sx={{ display: 'flex', mt: 1, gap: 1 }}>
        <Avatar
          src={video.author.avatarThumb}
          alt={video.author.nickname}
          sx={{ width: 32, height: 32, flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.82rem',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: 'text.primary',
              mb: 0.2,
            }}
          >
            {video.desc || 'TikTok'}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            @{video.author.username} &middot;{' '}
            {formatDistanceToNow(new Date(video.createTime * 1000), {
              addSuffix: true,
              locale: fr,
            })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
