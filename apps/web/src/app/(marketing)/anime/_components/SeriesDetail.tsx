'use client';

import {
  CalendarMonth,
  PlayArrow,
  Replay,
  Search,
  Theaters,
  Translate,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSeriesProgress } from '@/server/actions/anime-progress';
import { EpisodeGrid } from './EpisodeGrid';

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

interface Episode {
  id: string;
  number: number;
  title: string;
  titleFr: string | null;
  thumbnailUrl: string | null;
  duration: number;
  sources: Array<{ id: string; type: string; url: string; language: string }>;
}

interface SeriesData {
  id: string;
  slug: string;
  title: string;
  titleFr: string | null;
  titleJp: string | null;
  generation: string;
  synopsis: string | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  year: number;
  episodeCount: number;
  episodes: Episode[];
}

export function SeriesDetail({ series }: { series: SeriesData }) {
  const [progressMap, setProgressMap] = useState<
    Record<string, { progressTime: number; status: string }>
  >({});
  const [search, setSearch] = useState('');
  const accentColor = GENERATION_COLORS[series.generation] || '#7B1FA2';

  useEffect(() => {
    getSeriesProgress(series.id).then((data) => {
      setProgressMap(
        data as Record<string, { progressTime: number; status: string }>,
      );
    });
  }, [series.id]);

  // Find resume episode
  const resumeEpisode = useMemo(() => {
    let latest: { number: number; progressTime: number } | null = null;
    for (const ep of series.episodes) {
      const prog = progressMap[ep.id];
      if (prog && prog.status === 'IN_PROGRESS') {
        if (!latest || ep.number > latest.number) {
          latest = { number: ep.number, progressTime: prog.progressTime };
        }
      }
    }
    return latest;
  }, [progressMap, series.episodes]);

  // Available languages
  const languages = useMemo(() => {
    const langs = new Set<string>();
    for (const ep of series.episodes) {
      for (const src of ep.sources) {
        langs.add(src.language);
      }
    }
    return [...langs].sort();
  }, [series.episodes]);

  // Completed count
  const completedCount = useMemo(() => {
    let count = 0;
    for (const ep of series.episodes) {
      const prog = progressMap[ep.id];
      if (prog && prog.status === 'COMPLETED') count++;
    }
    return count;
  }, [progressMap, series.episodes]);

  // Filtered episodes
  const filteredEpisodes = useMemo(() => {
    if (!search.trim()) return series.episodes;
    const q = search.toLowerCase();
    return series.episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.titleFr?.toLowerCase().includes(q) ||
        `ep ${ep.number}` === q ||
        `${ep.number}` === q,
    );
  }, [search, series.episodes]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', pb: { xs: 4, md: 8 } }}>
      {/* Hero banner */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: '55svh', sm: 350, md: 450 },
          minHeight: { xs: 320, md: 450 },
          maxHeight: { xs: 500, md: 450 },
          overflow: 'hidden',
        }}
      >
        {series.bannerUrl || series.posterUrl ? (
          <Image
            src={series.bannerUrl || series.posterUrl || ''}
            alt={series.titleFr || series.title}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${accentColor}40, #0a0a0a)`,
            }}
          />
        )}
        {/* Gradient bottom — stronger for mobile */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: {
              xs: 'linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.85) 30%, rgba(10,10,10,0.3) 60%, transparent 80%)',
              md: 'linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.6) 40%, transparent 70%)',
            },
          }}
        />
        {/* Gradient left */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: {
              xs: 'none',
              md: 'linear-gradient(to right, rgba(10,10,10,0.8) 0%, transparent 50%)',
            },
          }}
        />
      </Box>
      {/* Series info */}
      <Box
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2, md: 4 },
          mt: { xs: -16, md: -16 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Mobile layout: centered poster + info */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            mb: 3,
          }}
        >
          {/* Mobile poster */}
          {series.posterUrl && (
            <Box
              sx={{
                width: 140,
                mb: 2,
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '2/3',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)`,
                }}
              >
                <Image
                  src={series.posterUrl}
                  alt={series.titleFr || series.title}
                  fill
                  sizes="140px"
                  style={{ objectFit: 'cover' }}
                />
              </Box>
            </Box>
          )}

          {/* Generation badge */}
          <Chip
            label={GENERATION_NAMES[series.generation] || series.generation}
            size="small"
            sx={{
              bgcolor: accentColor,
              color: 'white',
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 24,
              mb: 1,
            }}
          />

          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              color: 'white',
              mb: 0.5,
              fontSize: '1.5rem',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {series.titleFr || series.title}
          </Typography>

          {series.titleJp && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.4)',
                mb: 1,
                fontSize: '0.8rem',
              }}
            >
              {series.titleJp}
            </Typography>
          )}

          {/* Meta chips — horizontal row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.75rem',
              }}
            >
              <CalendarMonth sx={{ fontSize: 14 }} />
              {series.year}
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.75rem',
              }}
            >
              <Theaters sx={{ fontSize: 14 }} />
              {series.episodeCount} épisodes
            </Box>
            {languages.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Translate
                  sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}
                />
                {languages.map((lang) => (
                  <Chip
                    key={lang}
                    label={lang}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor:
                        lang === 'VF'
                          ? 'rgba(59,130,246,0.25)'
                          : lang === 'VOSTFR'
                            ? 'rgba(var(--rpb-primary-rgb),0.25)'
                            : 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </Box>
            )}
            {completedCount > 0 && (
              <Chip
                label={`${completedCount}/${series.episodeCount} vus`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}
              />
            )}
          </Box>

          {series.synopsis && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.6)',
                mb: 2.5,
                lineHeight: 1.6,
                fontSize: '0.82rem',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {series.synopsis}
            </Typography>
          )}

          {/* Mobile action buttons — full width Netflix style */}
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            {resumeEpisode ? (
              <>
                <Button
                  component={Link}
                  href={`/anime/${series.slug}/${resumeEpisode.number}`}
                  variant="contained"
                  fullWidth
                  startIcon={<Replay />}
                  sx={{
                    bgcolor: 'white',
                    color: '#0a0a0a',
                    fontWeight: 800,
                    borderRadius: 1.5,
                    py: 1.4,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    minHeight: 48,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                  }}
                >
                  Reprendre EP {resumeEpisode.number}
                </Button>
                <Button
                  component={Link}
                  href={`/anime/${series.slug}/1`}
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: 1.5,
                    py: 1.4,
                    px: 2,
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    minHeight: 48,
                    flexShrink: 0,
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      bgcolor: 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  EP 1
                </Button>
              </>
            ) : (
              series.episodes.length > 0 && (
                <Button
                  component={Link}
                  href={`/anime/${series.slug}/1`}
                  variant="contained"
                  fullWidth
                  startIcon={<PlayArrow />}
                  sx={{
                    bgcolor: 'white',
                    color: '#0a0a0a',
                    fontWeight: 800,
                    borderRadius: 1.5,
                    py: 1.4,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    minHeight: 48,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                  }}
                >
                  Regarder l&apos;épisode 1
                </Button>
              )
            )}
          </Box>
        </Box>

        {/* Desktop layout: poster + info side by side */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4, mb: 4 }}>
          {/* Poster */}
          {series.posterUrl && (
            <Box
              sx={{
                width: 200,
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '2/3',
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)`,
                }}
              >
                <Image
                  src={series.posterUrl}
                  alt={series.titleFr || series.title}
                  fill
                  sizes="200px"
                  style={{ objectFit: 'cover' }}
                />
              </Box>
            </Box>
          )}

          <Box sx={{ flex: 1, pt: 4 }}>
            {/* Generation badge */}
            <Chip
              label={GENERATION_NAMES[series.generation] || series.generation}
              size="small"
              sx={{
                bgcolor: accentColor,
                color: 'white',
                fontWeight: 700,
                fontSize: '0.7rem',
                height: 24,
                mb: 1.5,
              }}
            />

            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 900,
                color: 'white',
                mb: 0.5,
                fontSize: '2.5rem',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {series.titleFr || series.title}
            </Typography>

            {series.titleJp && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.4)',
                  mb: 1.5,
                  fontSize: '0.85rem',
                }}
              >
                {series.titleJp}
              </Typography>
            )}

            {/* Meta info chips */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 2.5,
                flexWrap: 'wrap',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8rem',
                }}
              >
                <CalendarMonth sx={{ fontSize: 16 }} />
                {series.year}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8rem',
                }}
              >
                <Theaters sx={{ fontSize: 16 }} />
                {series.episodeCount} épisodes
              </Box>
              {languages.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Translate
                    sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}
                  />
                  {languages.map((lang) => (
                    <Chip
                      key={lang}
                      label={lang}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        bgcolor:
                          lang === 'VF'
                            ? 'rgba(59,130,246,0.25)'
                            : lang === 'VOSTFR'
                              ? 'rgba(var(--rpb-primary-rgb),0.25)'
                              : 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </Box>
              )}
              {completedCount > 0 && (
                <Chip
                  label={`${completedCount}/${series.episodeCount} vus`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                />
              )}
            </Box>

            {series.synopsis && (
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  maxWidth: 650,
                  mb: 3,
                  lineHeight: 1.7,
                  fontSize: '0.9rem',
                }}
              >
                {series.synopsis}
              </Typography>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {resumeEpisode ? (
                <Button
                  component={Link}
                  href={`/anime/${series.slug}/${resumeEpisode.number}`}
                  variant="contained"
                  size="large"
                  startIcon={<Replay />}
                  sx={{
                    bgcolor: accentColor,
                    color: 'white',
                    fontWeight: 700,
                    borderRadius: 2,
                    px: 3.5,
                    py: 1.2,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    '&:hover': { bgcolor: `${accentColor}DD` },
                  }}
                >
                  Reprendre EP {resumeEpisode.number}
                </Button>
              ) : (
                series.episodes.length > 0 && (
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
                      borderRadius: 2,
                      px: 3.5,
                      py: 1.2,
                      textTransform: 'none',
                      fontSize: '0.9rem',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' },
                    }}
                  >
                    Regarder l&apos;épisode 1
                  </Button>
                )
              )}
              {resumeEpisode && (
                <Button
                  component={Link}
                  href={`/anime/${series.slug}/1`}
                  variant="outlined"
                  size="large"
                  startIcon={<PlayArrow />}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 3,
                    py: 1.2,
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.4)',
                      bgcolor: 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  Depuis le début
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Episode list header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: { xs: 2, md: 3 },
            mt: { xs: 1, md: 0 },
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              fontSize: { xs: '1rem', md: '1.3rem' },
            }}
          >
            Épisodes
            <Box
              component="span"
              sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500, ml: 1 }}
            >
              {filteredEpisodes.length !== series.episodes.length
                ? `${filteredEpisodes.length} / ${series.episodes.length}`
                : series.episodes.length}
            </Box>
          </Typography>

          {/* Search bar */}
          {series.episodes.length > 12 && (
            <TextField
              placeholder="Rechercher un épisode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search
                        sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  fontSize: '0.8rem',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.08)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.15)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: accentColor,
                    borderWidth: 1,
                  },
                },
                '& .MuiInputBase-input': {
                  color: 'white',
                  '&::placeholder': {
                    color: 'rgba(255,255,255,0.3)',
                    opacity: 1,
                  },
                },
              }}
            />
          )}
        </Box>

        <EpisodeGrid
          seriesSlug={series.slug}
          episodes={filteredEpisodes}
          progressMap={progressMap}
        />

        {/* Empty search state */}
        {search && filteredEpisodes.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            <Typography variant="body1">
              Aucun épisode trouvé pour &quot;{search}&quot;
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
