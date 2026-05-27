'use client';

import { PlayArrow } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';

const GENERATION_COLORS: Record<string, string> = {
  ORIGINAL: '#1565C0',
  METAL: '#E65100',
  BURST: '#C62828',
  X: '#7B1FA2',
};

interface AnimeSeriesCardProps {
  slug: string;
  title: string;
  titleFr?: string | null;
  posterUrl?: string | null;
  year: number;
  episodeCount: number;
  generation: string;
}

export function AnimeSeriesCard({
  slug,
  title,
  titleFr,
  posterUrl,
  year,
  episodeCount,
  generation,
}: AnimeSeriesCardProps) {
  const accentColor = GENERATION_COLORS[generation] || '#7B1FA2';

  return (
    <Link href={`/anime/${slug}`} style={{ textDecoration: 'none' }}>
      <Box
        sx={{
          position: 'relative',
          width: { xs: 115, sm: 140, md: 180 },
          flexShrink: 0,
          cursor: 'pointer',
          scrollSnapAlign: 'start',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          '&:hover': {
            transform: { md: 'scale(1.08) translateY(-4px)' },
            '& .card-overlay': { opacity: 1 },
            '& .card-play': { opacity: 1, transform: 'scale(1)' },
            '& .card-image': {
              boxShadow: `0 12px 40px ${accentColor}50`,
            },
          },
        }}
      >
        {/* Poster */}
        <Box
          className="card-image"
          sx={{
            position: 'relative',
            aspectRatio: '2/3',
            borderRadius: 2.5,
            overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,0.03)',
            transition: 'box-shadow 0.3s ease',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={titleFr || title}
              fill
              sizes="(max-width: 600px) 115px, (max-width: 900px) 140px, 180px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${accentColor}30, #0a0a0a)`,
                gap: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{ color: 'rgba(255,255,255,0.15)', fontWeight: 900 }}
              >
                {(titleFr || title).substring(0, 3).toUpperCase()}
              </Typography>
            </Box>
          )}

          {/* Hover overlay with play button */}
          <Box
            className="card-overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, ${accentColor}DD 0%, ${accentColor}40 40%, transparent 70%)`,
              opacity: 0,
              transition: 'opacity 0.3s ease',
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              p: 1.5,
            }}
          >
            {/* Play icon */}
            <Box
              className="card-play"
              sx={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'scale(0.8) translateX(-50%)',
                opacity: 0,
                transition: 'all 0.3s ease',
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ml: '-22px',
              }}
            >
              <PlayArrow sx={{ color: accentColor, fontSize: 24 }} />
            </Box>

            <Typography
              variant="caption"
              sx={{
                color: 'white',
                fontWeight: 700,
                textAlign: 'center',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {episodeCount} épisodes
            </Typography>
          </Box>

          {/* Bottom accent bar */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              bgcolor: accentColor,
              opacity: 0.8,
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            mt: 1,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.8rem',
          }}
        >
          {titleFr || title}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
        >
          {year} · {episodeCount} eps
        </Typography>
      </Box>
    </Link>
  );
}
