'use client';

import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Box, IconButton, Typography } from '@mui/material';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { AnimeSeriesCard } from './AnimeSeriesCard';

const GENERATION_LABELS: Record<string, string> = {
  ORIGINAL: 'Beyblade Original (2001-2003)',
  METAL: 'Metal Fight (2009-2012)',
  BURST: 'Beyblade Burst (2016-2021)',
  X: 'Beyblade X (2023+)',
};

const GENERATION_COLORS: Record<string, string> = {
  ORIGINAL: '#1565C0',
  METAL: '#E65100',
  BURST: '#C62828',
  X: '#7B1FA2',
};

interface Series {
  id: string;
  slug: string;
  title: string;
  titleFr: string | null;
  posterUrl: string | null;
  year: number;
  episodeCount: number;
  generation: string;
}

interface AnimeCarouselProps {
  generation: string;
  series: Series[];
}

export function AnimeCarousel({ generation, series }: AnimeCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const accentColor = GENERATION_COLORS[generation] || '#7B1FA2';
  const label = GENERATION_LABELS[generation] || generation;

  return (
    <Box sx={{ mb: { xs: 3.5, md: 5 } }}>
      {/* Section header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, md: 4 },
          mb: { xs: 1.5, md: 2 },
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontSize: { xs: '0.95rem', md: '1.15rem' },

            '&::before': {
              content: '""',
              width: 4,
              height: 28,
              bgcolor: accentColor,
              borderRadius: 1,
              display: 'inline-block',
              boxShadow: `0 0 12px ${accentColor}60`,
            },
          }}
        >
          {label}
        </Typography>
        <Typography
          component={Link}
          href={`/anime?gen=${generation}`}
          variant="body2"
          sx={{
            color: accentColor,
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.8rem',
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 0.8 },
          }}
        >
          Voir tout →
        </Typography>
      </Box>
      {/* Carousel */}
      <Box
        sx={{
          position: 'relative',
          '&:hover .scroll-btn': { opacity: 1 },
        }}
      >
        {/* Left fade */}
        {canScrollLeft && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 40,
              width: 60,
              background: 'linear-gradient(to right, #0a0a0a, transparent)',
              zIndex: 5,
              pointerEvents: 'none',
              display: { xs: 'none', md: 'block' },
            }}
          />
        )}

        {/* Right fade */}
        {canScrollRight && (
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 40,
              width: 60,
              background: 'linear-gradient(to left, #0a0a0a, transparent)',
              zIndex: 5,
              pointerEvents: 'none',
              display: { xs: 'none', md: 'block' },
            }}
          />
        )}

        {/* Left arrow */}
        {canScrollLeft && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll('left')}
            sx={{
              position: 'absolute',
              left: 8,
              top: '35%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 40,
              height: 40,
              bgcolor:
                'color-mix(in srgb, var(--rpb-surface-main) 85%, transparent)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              opacity: { xs: 0.8, md: 0 },
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor:
                  'color-mix(in srgb, var(--rpb-surface-high) 95%, transparent)',
                transform: 'translateY(-50%) scale(1.1)',
              },
            }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll('right')}
            sx={{
              position: 'absolute',
              right: 8,
              top: '35%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 40,
              height: 40,
              bgcolor:
                'color-mix(in srgb, var(--rpb-surface-main) 85%, transparent)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              opacity: { xs: 0.8, md: 0 },
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor:
                  'color-mix(in srgb, var(--rpb-surface-high) 95%, transparent)',
                transform: 'translateY(-50%) scale(1.1)',
              },
            }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        )}

        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            display: 'flex',
            gap: { xs: 1, md: 2 },
            px: { xs: 1.5, md: 4 },
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            py: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {series.map((s) => (
            <AnimeSeriesCard key={s.id} {...s} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
