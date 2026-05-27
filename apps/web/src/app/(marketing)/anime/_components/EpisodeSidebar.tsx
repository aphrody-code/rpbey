'use client';

import { PlayArrow } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

interface SidebarEpisode {
  id: string;
  number: number;
  title: string;
  titleFr: string | null;
  thumbnailUrl: string | null;
  duration: number;
}

interface EpisodeSidebarProps {
  seriesSlug: string;
  seriesTitle: string;
  episodes: SidebarEpisode[];
  currentEpisode: number;
  episodeCount: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function episodeGradient(num: number): string {
  const hue = (num * 37 + 200) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 30%, 15%) 0%, hsl(${(hue + 40) % 360}, 25%, 10%) 100%)`;
}

export function EpisodeSidebar({
  seriesSlug,
  seriesTitle,
  episodes,
  currentEpisode,
  episodeCount,
}: EpisodeSidebarProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        block: 'center',
        behavior: 'instant',
      });
    }
  }, []);

  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: { lg: 580 },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 800,
            color: 'white',
            fontSize: '0.85rem',
          }}
        >
          {seriesTitle}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}
        >
          {episodeCount} épisodes
        </Typography>
      </Box>
      {/* Episode list */}
      <Box
        sx={{
          overflow: 'auto',
          flex: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
          },
        }}
      >
        {episodes.map((ep) => {
          const isCurrent = ep.number === currentEpisode;
          return (
            <Link
              key={ep.id}
              href={`/anime/${seriesSlug}/${ep.number}`}
              style={{ textDecoration: 'none' }}
            >
              <Box
                ref={isCurrent ? activeRef : undefined}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  bgcolor: isCurrent
                    ? 'rgba(var(--rpb-primary-rgb), 0.12)'
                    : 'transparent',
                  borderLeft: isCurrent
                    ? '3px solid var(--rpb-primary)'
                    : '3px solid transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isCurrent
                      ? 'rgba(var(--rpb-primary-rgb), 0.15)'
                      : 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                {/* Thumbnail */}
                <Box
                  sx={{
                    position: 'relative',
                    width: 110,
                    minWidth: 110,
                    aspectRatio: '16/9',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    flexShrink: 0,
                  }}
                >
                  {ep.thumbnailUrl ? (
                    <Image
                      src={ep.thumbnailUrl}
                      alt={ep.titleFr || ep.title}
                      fill
                      sizes="110px"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        background: episodeGradient(ep.number),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '1.2rem',
                          fontWeight: 900,
                          color: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        {ep.number}
                      </Typography>
                    </Box>
                  )}
                  {isCurrent && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PlayArrow sx={{ color: 'white', fontSize: 22 }} />
                    </Box>
                  )}
                  {ep.duration > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 3,
                        right: 3,
                        px: 0.5,
                        py: 0.1,
                        borderRadius: 0.5,
                        bgcolor: 'rgba(0,0,0,0.8)',
                        fontSize: '0.55rem',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      {formatDuration(ep.duration)}
                    </Box>
                  )}
                </Box>

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0, py: 0.2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isCurrent
                        ? 'var(--rpb-primary)'
                        : 'rgba(255,255,255,0.4)',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                    }}
                  >
                    Épisode {ep.number}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: isCurrent ? 'white' : 'rgba(255,255,255,0.7)',
                      fontWeight: isCurrent ? 700 : 500,
                      fontSize: '0.78rem',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {ep.titleFr || ep.title}
                  </Typography>
                </Box>
              </Box>
            </Link>
          );
        })}
      </Box>
    </Box>
  );
}
