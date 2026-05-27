'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { m } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';

export interface TournamentShowcaseItem {
  id: string;
  name: string;
  date: string;
  poster: string;
  participants: number;
  matchesCount: number;
  podium: { name: string; rank: number; wins: number; losses: number }[];
}

interface TournamentShowcaseProps {
  tournaments?: TournamentShowcaseItem[];
}

const PARTNERS = [
  {
    id: 'satr',
    name: 'Sun After The Reign',
    subtitle: 'Beyblade Battle Tournament',
    href: '/tournaments/satr',
    color: '#fbbf24',
    logo: '/satr-logo.webp',
    logoRounded: false,
  },
  {
    id: 'wb',
    name: 'Wild Breakers',
    subtitle: 'Ultime Bataille',
    href: '/tournaments/wb',
    color: '#f87171',
    logo: '/wb-logo.webp',
    logoRounded: true,
  },
];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

export function TournamentShowcase({
  tournaments = [],
}: TournamentShowcaseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -340 : 340,
      behavior: 'smooth',
    });
  };

  return (
    <Box sx={{ py: { xs: 5, md: 8 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              fontSize: { xs: '1.4rem', md: '2rem' },
              letterSpacing: '-0.03em',
            }}
          >
            Nos{' '}
            <Box
              component="span"
              sx={{
                background: (t) =>
                  `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Tournois
            </Box>
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              onClick={() => scroll('left')}
              size="small"
              sx={{
                bgcolor: 'surface.high',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box component="span" sx={{ fontSize: 18, fontWeight: 900 }}>
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
              }}
            >
              <Box component="span" sx={{ fontSize: 18, fontWeight: 900 }}>
                ›
              </Box>
            </IconButton>
          </Stack>
        </Stack>

        <Box
          ref={scrollRef}
          component={m.div}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          sx={{
            display: 'flex',
            gap: 2.5,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {/* BTS tournament cards */}
          {tournaments.map((t, i) => (
            <Box
              key={t.id}
              component={m.div}
              variants={cardVariant}
              sx={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                width: { xs: 280, sm: 300, md: 320 },
              }}
            >
              <Box
                component={Link}
                href={`/tournaments/${t.id}`}
                sx={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'transparent',
                  border: '1px solid',
                  borderColor: 'rgba(var(--rpb-primary-rgb), 0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: 'rgba(var(--rpb-primary-rgb), 0.35)',
                    boxShadow: '0 12px 32px rgba(var(--rpb-primary-rgb), 0.15)',
                  },
                }}
              >
                {/* Poster */}
                <Box
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    maxHeight: { xs: 260, md: 340 },
                  }}
                >
                  <Image
                    src={t.poster}
                    alt={t.name}
                    width={1040}
                    height={1467}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '40%',
                      background:
                        'linear-gradient(transparent, rgba(0,0,0,0.8))',
                    }}
                  />
                  {i === 0 && (
                    <Chip
                      label={t.podium.length === 0 ? 'À VENIR' : 'DERNIER'}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        fontWeight: 800,
                        fontSize: '0.55rem',
                        height: 20,
                        letterSpacing: t.podium.length === 0 ? 1 : 0,
                        bgcolor:
                          t.podium.length === 0
                            ? 'rgba(var(--rpb-primary-rgb), 0.95)'
                            : 'rgba(var(--rpb-primary-rgb), 0.9)',
                        color: 'white',
                        boxShadow:
                          t.podium.length === 0
                            ? '0 4px 12px rgba(0,0,0,0.4)'
                            : 'none',
                      }}
                    />
                  )}
                </Box>

                {/* Info + stats + podium */}
                <Box sx={{ p: 2 }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      lineHeight: 1.3,
                    }}
                  >
                    {t.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.72rem',
                    }}
                  >
                    {new Date(t.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Typography>

                  {t.podium.length === 0 && t.participants === 0 ? (
                    /* Upcoming tournament — CTA instead of stats */
                    <Box
                      sx={{
                        mt: 1.5,
                        py: 1,
                        px: 2,
                        borderRadius: 2,
                        bgcolor: 'rgba(var(--rpb-primary-rgb), 0.1)',
                        border: '1px solid rgba(var(--rpb-primary-rgb), 0.2)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 900,
                          color: 'var(--rpb-primary)',
                          fontSize: '0.72rem',
                          letterSpacing: 0.5,
                        }}
                      >
                        VOIR LES DÉTAILS
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      {/* Stats chips */}
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1.2, mb: 1.2 }}
                      >
                        <Chip
                          label={`${t.participants} joueurs`}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(var(--rpb-primary-rgb), 0.08)',
                            color: 'text.secondary',
                          }}
                        />
                        {t.matchesCount > 0 && (
                          <Chip
                            label={`${t.matchesCount} matchs`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(255,255,255,0.04)',
                              color: 'text.secondary',
                            }}
                          />
                        )}
                      </Stack>

                      {/* Podium */}
                      {t.podium.length > 0 && (
                        <Stack spacing={0.3}>
                          {t.podium.map((p) => (
                            <Stack
                              key={p.rank}
                              direction="row"
                              spacing={0.8}
                              sx={{
                                alignItems: 'center',
                                py: 0.3,
                                px: 0.8,
                                borderRadius: 1,

                                bgcolor:
                                  p.rank === 1
                                    ? 'rgba(255,215,0,0.06)'
                                    : 'transparent',
                              }}
                            >
                              <Typography
                                sx={{ fontSize: '0.75rem', width: 18 }}
                              >
                                {p.rank === 1
                                  ? '🥇'
                                  : p.rank === 2
                                    ? '🥈'
                                    : '🥉'}
                              </Typography>
                              <Typography
                                variant="caption"
                                noWrap
                                sx={{
                                  fontWeight: p.rank === 1 ? 800 : 600,
                                  flex: 1,
                                  fontSize: '0.72rem',

                                  color:
                                    p.rank === 1 ? '#fbbf24' : 'text.primary',
                                }}
                              >
                                {p.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: '0.6rem',
                                  color: 'text.disabled',
                                }}
                              >
                                {p.wins}V-{p.losses}D
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          ))}

          {/* Partner cards */}
          {PARTNERS.map((s) => (
            <Box
              key={s.id}
              component={m.div}
              variants={cardVariant}
              sx={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                width: { xs: 280, sm: 300, md: 320 },
              }}
            >
              <Box
                component={Link}
                href={s.href}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  height: '100%',
                  minHeight: { xs: 200, md: 240 },
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: 3,
                  bgcolor: 'transparent',
                  border: '1px solid',
                  borderColor: alpha(s.color, 0.1),
                  background: `radial-gradient(ellipse at 50% 30%, ${alpha(s.color, 0.08)}, transparent 70%)`,
                  p: 3,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: alpha(s.color, 0.3),
                    boxShadow: `0 12px 32px ${alpha(s.color, 0.15)}`,
                  },
                }}
              >
                <Image
                  src={s.logo}
                  alt={s.name}
                  width={80}
                  height={80}
                  style={{
                    objectFit: 'contain',
                    borderRadius: s.logoRounded ? '50%' : 0,
                    filter: `drop-shadow(0 4px 16px ${alpha(s.color, 0.4)})`,
                  }}
                />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      color: s.color,
                    }}
                  >
                    {s.name}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
                  >
                    {s.subtitle}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            component={Link}
            href="/tournaments"
            variant="outlined"
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 700,
              borderColor: (t) => alpha(t.palette.divider, 0.3),
              '&:hover': {
                borderColor: 'primary.main',
                color: 'primary.main',
              },
            }}
          >
            Voir tous les tournois
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
