import {
  ArrowBack,
  ArrowForward,
  ChevronRight,
  Home,
} from '@mui/icons-material';
import { Box, Button, Chip, Typography } from '@mui/material';
import { type Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAnimeEpisode } from '@/server/actions/anime';
import { getEpisodeProgress } from '@/server/actions/anime-progress';
import { EpisodePlayerSection } from '../../_components/EpisodePlayerSection';
import { EpisodeSidebar } from '../../_components/EpisodeSidebar';

interface Props {
  params: Promise<{ slug: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, episode } = await params;
  const num = Number.parseInt(episode, 10);
  if (Number.isNaN(num)) return { title: 'Épisode introuvable | RPB' };

  const data = await getAnimeEpisode(slug, num);
  if (!data) return { title: 'Épisode introuvable | RPB' };

  const title = `${data.series.titleFr || data.series.title} EP ${num} | RPB`;
  const description =
    data.episode.synopsis ||
    `Épisode ${num} de ${data.series.titleFr || data.series.title}`;
  const image =
    data.episode.thumbnailUrl || data.series.posterUrl || '/banner.webp';

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      locale: 'fr_FR',
      siteName: 'RPB - République Populaire du Beyblade',
      title,
      description,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
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

export default async function EpisodePage({ params }: Props) {
  const { slug, episode } = await params;
  const num = Number.parseInt(episode, 10);
  if (Number.isNaN(num)) notFound();

  const data = await getAnimeEpisode(slug, num);
  if (!data) notFound();

  const { episode: ep, series, prev, next, allEpisodes } = data;

  const progress = await getEpisodeProgress(ep.id);
  const savedTime =
    progress && progress.status !== 'COMPLETED' ? progress.progressTime : 0;

  const seriesTitle = series.titleFr || series.title;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', pb: { xs: 4, md: 8 } }}>
      {/* Breadcrumb — hidden on mobile for cleaner look */}
      <Box
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          pt: { xs: 0.5, md: 1.5 },
          pb: { xs: 0.5, md: 1 },
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 0.5,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/anime"
          style={{
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Home sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            Anime
          </Typography>
        </Link>
        <ChevronRight sx={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }} />
        <Link
          href={`/anime/${slug}`}
          style={{
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            {seriesTitle}
          </Typography>
        </Link>
        <ChevronRight sx={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }} />
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          Épisode {ep.number}
        </Typography>
      </Box>
      {/* Main content: Player + Sidebar */}
      <Box
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 0, md: 3 },
          display: 'flex',
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        {/* Player column */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <EpisodePlayerSection
            title={`${seriesTitle} - EP ${ep.number}`}
            sources={ep.sources}
            savedProgress={savedTime}
            episodeId={ep.id}
            duration={ep.duration}
            seriesSlug={slug}
            nextEpisode={next}
          />

          {/* Episode info + navigation */}
          <Box sx={{ px: { xs: 2, md: 0 }, mt: 2 }}>
            {/* Mobile: series link */}
            <Box
              sx={{
                display: { xs: 'flex', sm: 'none' },
                alignItems: 'center',
                gap: 0.5,
                mb: 1.5,
              }}
            >
              <Link
                href={`/anime/${slug}`}
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ArrowBack sx={{ fontSize: 14 }} />
                {seriesTitle}
              </Link>
            </Box>

            {/* Title row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Chip
                    label={`EP ${ep.number}`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      bgcolor: 'var(--rpb-primary)',
                      color: 'white',
                      height: 22,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '0.75rem',
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {seriesTitle}
                  </Typography>
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: 'text.primary',
                    lineHeight: 1.3,
                    fontSize: { xs: '1rem', md: '1.25rem' },
                  }}
                >
                  {ep.titleFr || ep.title}
                </Typography>
              </Box>

              {/* Prev/Next buttons */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  flexShrink: 0,
                  alignSelf: { xs: 'stretch', md: 'center' },
                }}
              >
                {prev && (
                  <Link
                    href={`/anime/${slug}/${prev.number}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button
                      startIcon={<ArrowBack />}
                      size="small"
                      sx={{
                        borderRadius: 2,
                        px: { xs: 1.5, md: 2 },
                        color: 'text.secondary',
                        border: '1px solid rgba(255,255,255,0.1)',
                        textTransform: 'none',
                        minHeight: 40,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.05)',
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        EP {prev.number}
                      </Box>
                    </Button>
                  </Link>
                )}
                {next && (
                  <Link
                    href={`/anime/${slug}/${next.number}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button
                      endIcon={<ArrowForward />}
                      variant="contained"
                      size="small"
                      sx={{
                        bgcolor: 'var(--rpb-primary)',
                        color: 'white',
                        borderRadius: 2,
                        px: { xs: 1.5, md: 2 },
                        textTransform: 'none',
                        fontWeight: 700,
                        minHeight: 40,
                        '&:hover': { bgcolor: 'var(--rpb-primary)' },
                      }}
                    >
                      <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        Épisode suivant
                      </Box>
                    </Button>
                  </Link>
                )}
              </Box>
            </Box>

            {/* Synopsis */}
            {ep.synopsis && (
              <Typography
                variant="body2"
                sx={{
                  mt: 1.5,
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.7,
                  maxWidth: 700,
                  fontSize: '0.85rem',
                }}
              >
                {ep.synopsis}
              </Typography>
            )}
          </Box>

          {/* Mobile episode strip — Netflix horizontal scroll with thumbnails */}
          <Box
            sx={{
              display: { xs: 'block', lg: 'none' },
              mt: 3,
              pt: 2,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                mb: 1.5,
                fontSize: '0.8rem',
                px: 2,
              }}
            >
              Tous les épisodes · {seriesTitle}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                px: 2,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                WebkitOverflowScrolling: 'touch',
                pb: 1,
              }}
            >
              {allEpisodes.map((epItem) => {
                const isCurrent = epItem.number === ep.number;
                return (
                  <Link
                    key={epItem.id}
                    href={`/anime/${slug}/${epItem.number}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
                        scrollSnapAlign: 'start',
                        width: 150,
                        opacity: isCurrent ? 1 : 0.7,
                        transition: 'opacity 0.2s',
                        '&:active': { opacity: 1 },
                      }}
                    >
                      {/* Thumbnail */}
                      <Box
                        sx={{
                          position: 'relative',
                          aspectRatio: '16/9',
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: isCurrent
                            ? '2px solid var(--rpb-primary)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {epItem.thumbnailUrl ? (
                          <Image
                            src={epItem.thumbnailUrl}
                            alt={epItem.titleFr || epItem.title}
                            fill
                            sizes="150px"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              background: episodeGradient(epItem.number),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '1.1rem',
                                fontWeight: 900,
                                color: 'rgba(255,255,255,0.08)',
                              }}
                            >
                              {epItem.number}
                            </Typography>
                          </Box>
                        )}
                        {/* Episode number overlay */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.5,
                            bgcolor: isCurrent
                              ? 'var(--rpb-primary)'
                              : 'rgba(0,0,0,0.75)',
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            color: 'white',
                          }}
                        >
                          EP {epItem.number}
                        </Box>
                        {epItem.duration > 0 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 3,
                              right: 3,
                              px: 0.4,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(0,0,0,0.8)',
                              fontSize: '0.5rem',
                              fontWeight: 600,
                              color: 'rgba(255,255,255,0.8)',
                            }}
                          >
                            {formatDuration(epItem.duration)}
                          </Box>
                        )}
                      </Box>
                      {/* Title */}
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          color: isCurrent ? 'white' : 'rgba(255,255,255,0.5)',
                          fontWeight: isCurrent ? 700 : 500,
                          fontSize: '0.65rem',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {epItem.titleFr || epItem.title}
                      </Typography>
                    </Box>
                  </Link>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Sidebar (desktop only) */}
        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            width: 360,
            flexShrink: 0,
          }}
        >
          <EpisodeSidebar
            seriesSlug={slug}
            seriesTitle={seriesTitle}
            episodes={allEpisodes}
            currentEpisode={ep.number}
            episodeCount={series.episodeCount}
          />
        </Box>
      </Box>
    </Box>
  );
}
