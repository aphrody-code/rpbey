'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Image from 'next/image';

interface VideoCardProps {
  title: string;
  thumbnail: string;
  duration: string;
  channelName: string;
  channelAvatar?: string;
  views: number | string;
  ago: string;
  url?: string;
  platform?: 'youtube' | 'twitch';
  onClick?: () => void;
}

const formatViews = (views: number | string): string => {
  if (typeof views === 'string') return views;
  return new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(views);
};

export function VideoCard({
  title,
  thumbnail,
  duration,
  channelName,
  channelAvatar,
  views,
  ago,
  url,
  platform,
  onClick,
}: VideoCardProps) {
  const Wrapper = url && !onClick ? 'a' : 'div';
  const wrapperProps =
    url && !onClick
      ? {
          href: url,
          target: '_blank' as const,
          rel: 'noopener noreferrer',
        }
      : {};

  return (
    <Box
      component={Wrapper}
      {...wrapperProps}
      onClick={onClick}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        '&:hover .vc-thumb img': {
          filter: 'brightness(0.8)',
        },
      }}
    >
      {/* Thumbnail */}
      <Box
        className="vc-thumb"
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          borderRadius: { xs: 2, sm: 2.5 },
          overflow: 'hidden',
          bgcolor: '#0a0a0a',
        }}
      >
        <Image
          src={thumbnail}
          alt={title}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
          loading="lazy"
          style={{ objectFit: 'cover', transition: 'filter 0.2s' }}
        />

        {/* Duration overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            bgcolor: 'rgba(0,0,0,0.85)',
            color: '#fff',
            borderRadius: 0.5,
            px: 0.6,
            py: 0.15,
            fontSize: '0.72rem',
            fontWeight: 700,
            lineHeight: 1.5,
            letterSpacing: '0.02em',
          }}
        >
          {duration}
        </Box>

        {/* Platform badge */}
        {platform && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              bgcolor: platform === 'twitch' ? '#9146ff' : '#ff0000',
              color: '#fff',
              borderRadius: 0.5,
              px: 0.5,
              py: 0.1,
              fontSize: '0.6rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {platform === 'twitch' ? 'Twitch' : 'YT'}
          </Box>
        )}
      </Box>

      {/* Meta: avatar + title + info */}
      <Box sx={{ display: 'flex', mt: 1.2, gap: 1.2 }}>
        <Avatar
          src={channelAvatar}
          alt={channelName}
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'grey.800',
            fontSize: '0.85rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {channelName.charAt(0).toUpperCase()}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: { xs: '0.85rem', sm: '0.9rem' },
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: 'text.primary',
              mb: 0.3,
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              lineHeight: 1.4,
            }}
          >
            {channelName}
          </Typography>

          <Typography
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              lineHeight: 1.4,
            }}
          >
            {formatViews(views)} vues &middot; {ago}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
