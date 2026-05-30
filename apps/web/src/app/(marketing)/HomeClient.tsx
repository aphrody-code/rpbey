"use client";

import { FiberManualRecord } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { domAnimation, LazyMotion, m, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  FeedMyPartnership,
  type MetaPartPreview,
  MetaPreview,
  type RankingBoard,
  RankingsCarousel,
} from "@/components/marketing";
import {
  TournamentShowcase,
  type TournamentShowcaseItem,
} from "@/components/marketing/TournamentShowcase";
import { VideoCarousel } from "@/components/marketing/VideoCarousel";
import { LivingBackdrop } from "@/components/ui/LivingBackdrop";

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
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

// --- Shared card style ---
const CARD_SX = {
  bgcolor: "surface.high",
  borderRadius: 3,
  p: 1,
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
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
  rankingBoards?: RankingBoard[];
  metaParts?: MetaPartPreview[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentVideos?: any[];
  tournaments?: TournamentShowcaseItem[];
}

export default function HomeClient({
  activeTournament,
  rankingBoards = [],
  metaParts = [],
  recentVideos = [],
  tournaments = [],
}: HomeClientProps) {
  // Hero : fondu du contenu au scroll (le fond vivant gère son propre mouvement).
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroContentOpacity = useTransform(heroScrollProgress, [0, 0.6], [1, 0]);

  return (
    <LazyMotion features={domAnimation}>
      {/* Hero Section - MD3 Expressive 2026 */}
      <Box
        ref={heroRef}
        sx={{
          position: "relative",
          minHeight: { xs: "44vh", md: "52vh" },
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          bgcolor: "black",
        }}
      >
        {/* Fond vivant : frames d'animé (corpus RAG) + braises Pixi, adaptatif/mobile */}
        <LivingBackdrop intensity={0.82} />

        <m.div style={{ opacity: heroContentOpacity }}>
          <Container
            maxWidth="lg"
            sx={{
              position: "relative",
              zIndex: 3,
              px: { xs: 2.5, md: 4 },
              py: { xs: 3, md: 5 },
            }}
          >
            <Grid
              container
              spacing={6}
              sx={{
                alignItems: "center",
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
                              animation: "pulse 1.5s infinite",
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
                          color: "primary.main",
                          fontWeight: 800,
                          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
                          backdropFilter: "blur(8px)",
                          cursor: "pointer",
                          "&:hover": {
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                            borderColor: "primary.main",
                          },
                          "@keyframes pulse": {
                            "0%": { opacity: 1 },
                            "50%": { opacity: 0.5 },
                            "100%": { opacity: 1 },
                          },
                        }}
                      />
                    </Box>
                  )}
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
        sx={{ bgcolor: "surface.low", py: SECTION_PY }}
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
                    height: "100%",
                  }}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 3,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="h5"
                          component="h2"
                          sx={{
                            fontWeight: 900,
                            color: "text.primary",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          Classements Live
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontWeight: 600,
                          }}
                        >
                          BTS · WILD BREAKERS · SATR · STARDUST
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "#22c55e",
                          boxShadow: "0 0 12px #22c55e",
                          animation: "pulse 2s infinite",
                        }}
                      />
                    </Stack>

                    <RankingsCarousel boards={rankingBoards} />
                  </CardContent>
                </Card>
              </Grid>

              {/* Meta Preview */}
              {metaParts.length > 0 && (
                <Grid size={12} component={m.div} variants={staggerItemVariants}>
                  <Card variant="elevation" sx={CARD_SX}>
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 3,
                        }}
                      >
                        <Box>
                          <Typography
                            variant="h5"
                            component="h2"
                            sx={{
                              fontWeight: 900,
                              color: "text.primary",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            Meta Beyblade X
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
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
                            fontSize: "0.6rem",
                            height: 22,
                            borderRadius: 3,
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                            color: "primary.main",
                            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
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
