'use client';

import { FiberManualRecord } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import {
  domAnimation,
  LazyMotion,
  type MotionStyle,
  m,
  useScroll,
  useTransform,
} from 'framer-motion';
import Link from 'next/link';
import { useRef } from 'react';
import { DynamicBlock } from '@/components/cms/DynamicBlock';
import {
  FeedMyPartnership,
  type MetaPartPreview,
  MetaPreview,
  RankingPreview,
} from '@/components/marketing';
import {
  TournamentShowcase,
  type TournamentShowcaseItem,
} from '@/components/marketing/TournamentShowcase';
import { VideoCarousel } from '@/components/marketing/VideoCarousel';
import { useThemeMode } from '@/components/theme/ThemeRegistry';

// Dynamic imports for heavy components below the fold

// MD3 Expressive 2026 - Spring-based easing for organic motion
const EASE = {
  // Emphasized - main transitions
  EMPHASIZED: [0.2, 0.0, 0.0, 1.0] as const,
  // Emphasized Decelerate - entries
  EMPHASIZED_DECELERATE: [0.05, 0.7, 0.1, 1.0] as const,
  // Emphasized Accelerate - exits
  EMPHASIZED_ACCELERATE: [0.3, 0.0, 0.8, 0.15] as const,
  // Standard - subtle transitions
  STANDARD: [0.2, 0.0, 0, 1.0] as const,
  // Expressive - playful, bouncy (MD3 2026)
  EXPRESSIVE: [0.34, 1.56, 0.64, 1] as const,
};

// --- Scroll-triggered animation variants ---

const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE.EMPHASIZED_DECELERATE },
  },
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.15,
      staggerChildren: 0.12,
    },
  },
};

const staggerItemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

// --- Shared card style ---
const CARD_SX = {
  bgcolor: 'surface.high',
  borderRadius: 3,
  p: 1,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
} as const;

// --- Section wrapper padding ---
const SECTION_PY = { xs: 5, md: 8 } as const;

interface HomeClientProps {
  activeTournament?: {
    id: string;
    name: string;
    challongeUrl: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    standings: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stations: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityLog: any;
  } | null;
  heroContent?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topRankings?: any[];
  metaParts?: MetaPartPreview[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentVideos?: any[];
  tournaments?: TournamentShowcaseItem[];
}

export default function HomeClient({
  activeTournament,
  heroContent,
  topRankings = [],
  metaParts = [],
  recentVideos = [],
  tournaments = [],
}: HomeClientProps) {
  const { backgroundImage, mode } = useThemeMode();

  // Hero parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroBgY = useTransform(heroScrollProgress, [0, 1], ['0%', '30%']);
  const heroContentOpacity = useTransform(heroScrollProgress, [0, 0.6], [1, 0]);

  return (
    <LazyMotion features={domAnimation}>
      {/* Hero Section - MD3 Expressive 2026 */}
      <Box
        ref={heroRef}
        sx={{
          position: 'relative',
          minHeight: { xs: 'auto', md: '95vh' },
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          overflow: 'hidden',
          pt: { xs: 1, md: 0 },
          bgcolor: 'black',
        }}
      >
        {/* Background Layer with parallax */}
        <Box
          component={m.div}
          style={{ y: heroBgY } as MotionStyle}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background:
                mode === 'blue'
                  ? 'linear-gradient(to bottom, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.9) 50%, #020617 100%)'
                  : `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 50%, var(--rpb-bg, #0F0F0F) 100%)`,
              zIndex: 2,
            },
          }}
        >
          {/* Static Background Image */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 0,
              opacity: 0.4,
              filter: 'blur(2px)',
            }}
          />
        </Box>

        <m.div style={{ opacity: heroContentOpacity }}>
          <Container
            maxWidth="lg"
            sx={{
              position: 'relative',
              zIndex: 3,
              px: { xs: 2.5, md: 4 },
              py: { xs: 4, md: 10 },
            }}
          >
            <Grid
              container
              spacing={6}
              sx={{
                alignItems: 'center',
              }}
            >
              <Grid size={{ xs: 12, md: 7 }}>
                <Box
                  component={m.div}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, ease: EASE.EMPHASIZED }}
                >
                  {activeTournament && (
                    <Box
                      component={m.div}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <Chip
                        icon={
                          <FiberManualRecord
                            sx={{
                              fontSize: 12,
                              animation: 'pulse 1.5s infinite',
                            }}
                          />
                        }
                        label={`EN DIRECT : ${activeTournament.name}`}
                        component={Link}
                        href={`/tournaments/${activeTournament.id}`}
                        sx={{
                          mb: 3,
                          px: 1,
                          py: 2.5,
                          borderRadius: 3,
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          color: 'primary.main',
                          fontWeight: 800,
                          border: (t) =>
                            `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
                          backdropFilter: 'blur(8px)',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                            borderColor: 'primary.main',
                          },
                          '@keyframes pulse': {
                            '0%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                            '100%': { opacity: 1 },
                          },
                        }}
                      />
                    </Box>
                  )}

                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: {
                        xs: 'clamp(2rem, 9vw, 3rem)',
                        sm: '4.5rem',
                        md: '5.5rem',
                        lg: '6.5rem',
                      },
                      fontWeight: 900,
                      lineHeight: { xs: 1.05, md: 0.95 },
                      letterSpacing: '-0.05em',
                      mb: { xs: 2, md: 3 },
                      textTransform: 'uppercase',
                      textAlign: { xs: 'center', md: 'left' },
                      fontVariationSettings: '"wght" 900, "opsz" 100',
                    }}
                  >
                    République
                    <br />
                    Populaire
                    <br />
                    <Box
                      component="span"
                      sx={{
                        background: (t) =>
                          `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: (t) =>
                          `drop-shadow(0 10px 20px ${t.palette.primary.main}4D)`,
                      }}
                    >
                      Beyblade
                    </Box>
                  </Typography>

                  <Box
                    sx={{
                      mb: { xs: 3, md: 5 },
                      pl: 0.5,
                      borderLeft: { xs: 'none', md: '4px solid' },
                      borderColor: 'primary.main',
                      textAlign: { xs: 'center', md: 'left' },
                    }}
                  >
                    <DynamicBlock
                      slug="home-hero-text"
                      initialContent={heroContent}
                      fallback="La plus grande communauté française de Beyblade X. Compétition, partage et passion."
                      className="hero-text-block"
                    />
                  </Box>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{
                      alignItems: { xs: 'center', md: 'flex-start' },
                    }}
                  >
                    <Button
                      component={Link}
                      href="/tournaments"
                      variant="contained"
                      size="large"
                      sx={{
                        width: { xs: '100%', sm: 'auto' },
                        height: { xs: 48, sm: 64 },
                        px: { xs: 4, sm: 6 },
                        borderRadius: 3,
                        fontSize: { xs: '0.95rem', sm: '1.1rem' },
                        fontWeight: 800,
                        bgcolor: 'primary.main',
                        color: 'white',
                        boxShadow: (t) =>
                          `0 15px 30px ${t.palette.primary.main}66`,
                        '&:hover': {
                          bgcolor: 'primary.dark',
                          transform: 'scale(1.05)',
                        },
                        transition:
                          'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      Rejoindre l'Arène
                    </Button>
                    <Button
                      component="a"
                      href="https://discord.gg/rpb"
                      variant="outlined"
                      size="large"
                      sx={{
                        width: { xs: '100%', sm: 'auto' },
                        height: { xs: 48, sm: 64 },
                        px: 4,
                        borderRadius: 3,
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                          borderWidth: 2,
                          borderColor: 'white',
                          bgcolor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      Notre Discord
                    </Button>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </m.div>
      </Box>
      {/* Tournament Showcase Section */}
      <Box
        component={m.section}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
        <TournamentShowcase tournaments={tournaments} />
      </Box>
      {/* Videos Section */}
      {recentVideos.length > 0 && (
        <Box
          component={m.section}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={sectionVariants}
        >
          <VideoCarousel videos={recentVideos} />
        </Box>
      )}
      {/* Ranking + Meta Section */}
      <Box
        component={m.section}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
        sx={{ bgcolor: 'surface.low', py: SECTION_PY }}
      >
        <Container maxWidth="lg">
          <Box
            component={m.div}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainerVariants}
          >
            <Grid container spacing={4}>
              <Grid size={12} component={m.div} variants={staggerItemVariants}>
                <Card
                  variant="elevation"
                  sx={{
                    ...CARD_SX,
                    height: '100%',
                  }}
                >
                  <CardContent>
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
                          variant="h5"
                          component="h2"
                          sx={{
                            fontWeight: 900,
                            color: 'text.primary',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          Classement Live
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 600,
                          }}
                        >
                          TOP 20 BLADERS - RPB
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#22c55e',
                          boxShadow: '0 0 12px #22c55e',
                          animation: 'pulse 2s infinite',
                        }}
                      />
                    </Stack>

                    <RankingPreview rankings={topRankings} />

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        sx={{ borderRadius: 3 }}
                        component={Link}
                        href="/rankings"
                      >
                        Voir tout
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Meta Preview */}
              {metaParts.length > 0 && (
                <Grid
                  size={12}
                  component={m.div}
                  variants={staggerItemVariants}
                >
                  <Card variant="elevation" sx={CARD_SX}>
                    <CardContent>
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
                            variant="h5"
                            component="h2"
                            sx={{
                              fontWeight: 900,
                              color: 'text.primary',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            Meta Beyblade X
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 600,
                            }}
                          >
                            TOP PIECES PAR CATEGORIE - WBO
                          </Typography>
                        </Box>
                        <Chip
                          label="LIVE"
                          size="small"
                          sx={{
                            fontWeight: 900,
                            fontSize: '0.6rem',
                            height: 22,
                            borderRadius: 3,
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                            color: 'primary.main',
                            border: (t) =>
                              `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
                          }}
                        />
                      </Stack>

                      <MetaPreview parts={metaParts} />
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>
        </Container>
      </Box>
      {/* Partnership Section */}
      <Box
        component={m.section}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
        sx={{ py: SECTION_PY }}
      >
        <Container maxWidth="lg">
          <FeedMyPartnership />
        </Container>
      </Box>
    </LazyMotion>
  );
}
