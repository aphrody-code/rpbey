'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';

interface VideoItem {
  id: string;
  title: string;
  videoId: string;
  channelName: string;
  channelAvatar?: string | null;
  thumbnail: string;
  views: number;
  duration: string;
  publishedAt: string;
}

function formatRelativeDate(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an(s)`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return String(views);
}

export function VideoCarousel({ videos }: { videos: VideoItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (!videos.length) return null;

  return (
    <Box sx={{ py: { xs: 5, md: 8 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                fontSize: { xs: '1.4rem', md: '2rem' },
                letterSpacing: '-0.03em',
              }}
            >
              Revivez l'expérience
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.5,
              }}
            >
              Les dernières vidéos de la communauté RPB
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={() => scroll('left')}
              size="small"
              sx={{
                bgcolor: 'surface.high',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'surface.highest' },
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: 18, lineHeight: 1, fontWeight: 900 }}
              >
                ‹
              </Box>
            </IconButton>
            <IconButton
              onClick={() => scroll('right')}
              size="small"
              sx={{
                bgcolor: 'surface.high',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'surface.highest' },
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: 18, lineHeight: 1, fontWeight: 900 }}
              >
                ›
              </Box>
            </IconButton>
          </Stack>
        </Stack>

        {/* Scrollable row */}
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {videos.map((video) => (
            <Box
              key={video.id}
              component="a"
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                width: { xs: 280, sm: 300, md: 320 },
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'transform 0.2s ease',
                '&:hover': { transform: 'scale(1.02)' },
                '&:hover .yt-thumb': { opacity: 0.85 },
              }}
            >
              {/* Thumbnail */}
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'black',
                }}
              >
                <Box
                  component="img"
                  className="yt-thumb"
                  src={
                    video.thumbnail ||
                    `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
                  }
                  alt={video.title}
                  loading="lazy"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.2s',
                  }}
                />
                {/* Duration badge */}
                {video.duration && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      bgcolor: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 0.8,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      lineHeight: 1.4,
                    }}
                  >
                    {video.duration}
                  </Box>
                )}
              </Box>

              {/* Info */}
              <Stack direction="row" spacing={1.2} sx={{ mt: 1.2, px: 0.5 }}>
                {video.channelAvatar && (
                  <Box
                    component="img"
                    src={video.channelAvatar}
                    alt={video.channelName}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      flexShrink: 0,
                      mt: 0.2,
                    }}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                      fontSize: '0.85rem',
                    }}
                  >
                    {video.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                    }}
                  >
                    {video.channelName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.disabled',
                      display: 'block',
                      fontSize: '0.7rem',
                    }}
                  >
                    {formatViews(video.views)} vues ·{' '}
                    {formatRelativeDate(video.publishedAt)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            component="a"
            href="https://www.youtube.com/@rpb_ey"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              borderColor: (t) => alpha(t.palette.divider, 0.3),
              '&:hover': {
                borderColor: '#ff0000',
                color: '#ff0000',
              },
            }}
          >
            Voir la chaîne YouTube RPB
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
