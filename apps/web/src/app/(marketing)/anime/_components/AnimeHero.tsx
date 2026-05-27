'use client';

import { InfoOutlined, PlayArrow } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FeaturedSeries {
  id: string;
  slug: string;
  title: string;
  titleFr: string | null;
  synopsis: string | null;
  bannerUrl: string | null;
  posterUrl: string | null;
  year: number;
  episodeCount: number;
  generation: string;
}

const GENERATION_COLORS: Record<string, string> = {
  ORIGINAL: '#1565C0',
  METAL: '#E65100',
  BURST: '#C62828',
  X: '#7B1FA2',
};

const GENERATION_NAMES: Record<string, string> = {
  ORIGINAL: 'Série Originale',
  METAL: 'Metal Saga',
  BURST: 'Burst',
  X: 'Beyblade X',
};

const ROTATION_MS = 8000;

export function AnimeHero({ featured }: { featured: FeaturedSeries[] }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);

  // Initialize on mount
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % featured.length);
    startRef.current = Date.now();
    setProgress(0);
  }, [featured.length]);

  // Auto-rotation with progress
  useEffect(() => {
    if (featured.length <= 1) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(elapsed / ROTATION_MS, 1);
      setProgress(pct);
      if (pct >= 1) next();
    }, 50);
    return () => clearInterval(interval);
  }, [featured.length, next]);

  if (featured.length === 0) return null;

  // biome-ignore lint/style/noNonNullAssertion: guarded by length check above
  const series = featured[current]!;
  const imageUrl = series.bannerUrl || series.posterUrl;
  const accentColor = GENERATION_COLORS[series.generation] || '#7B1FA2';

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: '85svh', sm: '75svh', md: 620 },
        minHeight: { xs: 480, sm: 500, md: 620 },
        maxHeight: { xs: 700, md: 620 },
        overflow: 'hidden',
        mb: { xs: -2, md: 4 },
      }}
    >
      {/* Background image */}
      <AnimatePresence mode="wait">
        <Box
          key={series.id}
          component={motion.div}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          sx={{ position: 'absolute', inset: 0 }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={series.titleFr || series.title}
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
            />
          )}
        </Box>
      </AnimatePresence>
      {/* Gradient overlays — deeper Netflix-style */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.7) 30%, transparent 60%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.4) 40%, transparent 70%)',
        }}
      />
      {/* Vignette top */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, transparent 20%)',
        }}
      />
      {/* Content */}
      <AnimatePresence mode="wait">
        <Box
          key={`content-${series.id}`}
          component={motion.div}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          sx={{
            position: 'absolute',
            bottom: { xs: 80, md: 80 },
            left: { xs: 16, md: 56 },
            right: { xs: 16, md: '50%' },
            zIndex: 2,
          }}
        >
          {/* Generation badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              mb: 2,
              borderRadius: 1,
              bgcolor: `${accentColor}CC`,
              backdropFilter: 'blur(8px)',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'white',
              }}
            />
            {GENERATION_NAMES[series.generation] || series.generation} ·{' '}
            {series.year} · {series.episodeCount} épisodes
          </Box>

          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              color: 'white',
              mb: 1.5,
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3.25rem' },
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              textShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >
            {series.titleFr || series.title}
          </Typography>

          {series.synopsis && (
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.75)',
                mb: 3,
                maxWidth: 480,
                lineHeight: 1.6,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: { xs: '0.85rem', md: '0.95rem' },
              }}
            >
              {series.synopsis}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              component={Link}
              href={`/anime/${series.slug}/1`}
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              sx={{
                bgcolor: 'white',
                color: '#0a0a0a',
                fontWeight: 800,
                borderRadius: 1.5,
                px: { xs: 3, md: 3.5 },
                py: { xs: 1.4, md: 1.2 },
                fontSize: { xs: '0.95rem', md: '0.9rem' },
                minHeight: 48,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.85)',
                  transform: 'scale(1.02)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Regarder
            </Button>
            <Button
              component={Link}
              href={`/anime/${series.slug}`}
              variant="outlined"
              size="large"
              startIcon={<InfoOutlined />}
              sx={{
                borderColor: 'rgba(255,255,255,0.4)',
                color: 'white',
                fontWeight: 700,
                borderRadius: 1.5,
                px: { xs: 3, md: 3.5 },
                py: { xs: 1.4, md: 1.2 },
                fontSize: { xs: '0.95rem', md: '0.9rem' },
                minHeight: 48,
                textTransform: 'none',
                backdropFilter: 'blur(8px)',
                bgcolor: 'rgba(255,255,255,0.06)',
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.12)',
                },
              }}
            >
              Plus d&apos;infos
            </Button>
          </Box>
        </Box>
      </AnimatePresence>
      {/* Bottom dots + progress bar */}
      {featured.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            right: { xs: 20, md: 56 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            zIndex: 2,
          }}
        >
          {featured.map((item, i) => (
            <Box
              key={item.id}
              onClick={() => {
                setCurrent(i);
                startRef.current = Date.now();
                setProgress(0);
              }}
              sx={{
                position: 'relative',
                width: i === current ? 32 : 10,
                height: 4,
                borderRadius: 2,
                bgcolor:
                  i === current
                    ? 'rgba(255,255,255,0.3)'
                    : 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                overflow: 'hidden',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              {i === current && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${progress * 100}%`,
                    bgcolor: 'white',
                    borderRadius: 2,
                    transition: 'width 0.05s linear',
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
