'use client';

import { CheckCircle, PlayArrow } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';

interface EpisodeCardProps {
  seriesSlug: string;
  number: number;
  title: string;
  titleFr?: string | null;
  thumbnailUrl?: string | null;
  duration: number;
  progress?: number; // 0-1
  variant?: 'card' | 'list';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Generate a deterministic gradient based on episode number
function episodeGradient(num: number): string {
  const hue = (num * 37 + 200) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 30%, 12%) 0%, hsl(${(hue + 40) % 360}, 25%, 8%) 100%)`;
}

export function EpisodeCard({
  seriesSlug,
  number,
  title,
  titleFr,
  thumbnailUrl,
  duration,
  progress,
  variant = 'card',
}: EpisodeCardProps) {
  const isCompleted = progress != null && progress >= 0.9;

  // Netflix-style horizontal list item for mobile
  if (variant === 'list') {
    return (
      <Link
        href={`/anime/${seriesSlug}/${number}`}
        style={{ textDecoration: 'none' }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            cursor: 'pointer',
            borderRadius: 2,
            px: 0.5,
            py: 0.5,
            transition: 'background 0.15s',
            '&:active': {
              bgcolor: 'rgba(255,255,255,0.04)',
            },
          }}
        >
          {/* Thumbnail */}
          <Box
            sx={{
              position: 'relative',
              width: 130,
              minWidth: 130,
              aspectRatio: '16/9',
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={titleFr || title}
                fill
                sizes="130px"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: episodeGradient(number),
                }}
              >
                <Typography
                  sx={{
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.06)',
                    userSelect: 'none',
                  }}
                >
                  {number}
                </Typography>
              </Box>
            )}

            {/* Play overlay — always visible on list */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.3)',
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'rgba(0,0,0,0.6)',
                  border: '2px solid white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlayArrow sx={{ color: 'white', fontSize: 20 }} />
              </Box>
            </Box>

            {/* Duration badge */}
            {duration > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  px: 0.5,
                  py: 0.1,
                  borderRadius: 0.5,
                  bgcolor: 'rgba(0,0,0,0.8)',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                {formatDuration(duration)}
              </Box>
            )}

            {/* Progress bar */}
            {progress != null && progress > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  bgcolor: 'rgba(255,255,255,0.15)',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${Math.min(progress * 100, 100)}%`,
                    bgcolor: isCompleted ? '#22c55e' : 'var(--rpb-primary)',
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.4)',
                fontWeight: 700,
                fontSize: '0.65rem',
              }}
            >
              Épisode {number}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isCompleted ? 'rgba(255,255,255,0.5)' : 'white',
                fontWeight: 600,
                fontSize: '0.82rem',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {titleFr || title}
            </Typography>
            {duration > 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '0.65rem',
                  mt: 0.3,
                  display: 'block',
                }}
              >
                {formatDuration(duration)}
              </Typography>
            )}
          </Box>

          {/* Completed indicator */}
          {isCompleted && (
            <CheckCircle
              sx={{
                fontSize: 20,
                color: '#22c55e',
                flexShrink: 0,
                mr: 0.5,
              }}
            />
          )}
        </Box>
      </Link>
    );
  }

  // Default card variant (tablet+)
  return (
    <Link
      href={`/anime/${seriesSlug}/${number}`}
      style={{ textDecoration: 'none' }}
    >
      <Box
        sx={{
          position: 'relative',
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
          '&:hover': {
            transform: { md: 'scale(1.03)' },
            '& .play-overlay': { opacity: 1 },
            '& .ep-thumb': {
              borderColor: 'rgba(255,255,255,0.15)',
            },
          },
        }}
      >
        {/* Thumbnail */}
        <Box
          className="ep-thumb"
          sx={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'border-color 0.2s',
          }}
        >
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={titleFr || title}
              fill
              sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: episodeGradient(number),
                position: 'relative',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '2rem', md: '2.5rem' },
                  fontWeight: 900,
                  color: 'rgba(255,255,255,0.06)',
                  letterSpacing: '-0.02em',
                  userSelect: 'none',
                }}
              >
                {number}
              </Typography>
            </Box>
          )}

          {/* Episode number badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              px: 0.8,
              py: 0.3,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            EP {number}
          </Box>

          {/* Completed badge */}
          {isCompleted && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            >
              <CheckCircle
                sx={{
                  fontSize: 20,
                  color: '#22c55e',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                }}
              />
            </Box>
          )}

          {/* Duration badge */}
          {duration > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                px: 0.8,
                py: 0.3,
                borderRadius: 1,
                bgcolor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '0.65rem',
                fontWeight: 600,
              }}
            >
              {formatDuration(duration)}
            </Box>
          )}

          {/* Play overlay */}
          <Box
            className="play-overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.45)',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              }}
            >
              <PlayArrow sx={{ color: '#0a0a0a', fontSize: 24 }} />
            </Box>
          </Box>

          {/* Progress bar */}
          {progress != null && progress > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                bgcolor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${Math.min(progress * 100, 100)}%`,
                  bgcolor: isCompleted ? '#22c55e' : 'var(--rpb-primary)',
                  borderRadius: 0,
                }}
              />
            </Box>
          )}
        </Box>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            mt: 0.8,
            color: isCompleted ? 'rgba(255,255,255,0.5)' : 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.8rem',
          }}
        >
          {titleFr || title}
        </Typography>
      </Box>
    </Link>
  );
}
