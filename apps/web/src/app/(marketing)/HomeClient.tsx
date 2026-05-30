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
import { domAnimation, LazyMotion, m } from "framer-motion";
import Link from "next/link";
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
import { SectionFrameBg } from "@/components/ui/SectionFrameBg";

// MD3 Expressive 2026 — easing organique.
const EASE = {
  EMPHASIZED: [0.2, 0.0, 0.0, 1.0] as const,
  EMPHASIZED_DECELERATE: [0.05, 0.7, 0.1, 1.0] as const,
};

// Entrée de contenu au scroll (le fond de section gère sa propre parallaxe).
const contentVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE.EMPHASIZED_DECELERATE },
  },
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.12, staggerChildren: 0.12 } },
};

const staggerItemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// Carte sur fond de frame : surface translucide + flou → la frame respire derrière.
const CARD_SX = {
  bgcolor: (t: { palette: { background: { paper: string } } }) =>
    alpha(t.palette.background.paper, 0.72),
  backdropFilter: "blur(12px)",
  borderRadius: 3,
  p: 1,
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
} as const;

const SECTION_PY = { xs: 6, md: 9 } as const;

// Une « saison » d'animé par section → le scroll fait défiler les générations.
const SERIES = {
  tournaments: "beyblade-x",
  videos: "metal-fight-beyblade",
  rankings: "beyblade-burst-chouzetsu",
  partnership: "bakuten-shoot-beyblade",
} as const;

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

/** Section plein-cadre : fond de frame d'animé (parallaxe) + contenu lisible au-dessus. */
function FrameSection({
  series,
  scrim,
  focus,
  py,
  children,
}: {
  series: string;
  scrim?: number;
  focus?: "top" | "center" | "bottom";
  py?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        ...(py ? { py: SECTION_PY } : null),
      }}
    >
      <SectionFrameBg series={series} scrim={scrim} focus={focus} />
      <Box
        component={m.div}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={contentVariants}
        sx={{ position: "relative", zIndex: 1 }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function HomeClient({
  activeTournament,
  rankingBoards = [],
  metaParts = [],
  recentVideos = [],
  tournaments = [],
}: HomeClientProps) {
  return (
    <LazyMotion features={domAnimation}>
      {/* Tournois — saison Beyblade X. Puce « EN DIRECT » en tête si un tournoi tourne. */}
      <FrameSection series={SERIES.tournaments} scrim={0.62} focus="center">
        {activeTournament && (
          <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 }, pb: 0 }}>
            <Chip
              icon={<FiberManualRecord sx={{ fontSize: 12, animation: "pulse 1.5s infinite" }} />}
              label={`EN DIRECT : ${activeTournament.name}`}
              component={Link}
              href={`/tournaments/${activeTournament.id}`}
              sx={{
                px: 1,
                py: 2.5,
                borderRadius: 3,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.16),
                color: "primary.main",
                fontWeight: 800,
                border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.4)}`,
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.26),
                  borderColor: "primary.main",
                },
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                  "100%": { opacity: 1 },
                },
              }}
            />
          </Container>
        )}
        <TournamentShowcase tournaments={tournaments} />
      </FrameSection>

      {/* Vidéos — saison Metal Fight. */}
      {recentVideos.length > 0 && (
        <FrameSection series={SERIES.videos} scrim={0.66} focus="center">
          <VideoCarousel videos={recentVideos} />
        </FrameSection>
      )}

      {/* Classements + Meta — saison Burst. */}
      <FrameSection series={SERIES.rankings} scrim={0.74} focus="top" py>
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
                <Card variant="elevation" sx={{ ...CARD_SX, height: "100%" }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
                    >
                      <Box>
                        <Typography
                          variant="h5"
                          component="h2"
                          sx={{ fontWeight: 900, color: "text.primary", letterSpacing: "-0.02em" }}
                        >
                          Classements Live
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontWeight: 600 }}
                        >
                          BTS · WILD BREAKERS · SATR · STARDUST
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "success.main",
                          boxShadow: (t) => `0 0 12px ${t.palette.success.main}`,
                          animation: "pulse 2s infinite",
                          "@keyframes pulse": {
                            "0%": { opacity: 1 },
                            "50%": { opacity: 0.5 },
                            "100%": { opacity: 1 },
                          },
                        }}
                      />
                    </Stack>
                    <RankingsCarousel boards={rankingBoards} />
                  </CardContent>
                </Card>
              </Grid>

              {metaParts.length > 0 && (
                <Grid size={12} component={m.div} variants={staggerItemVariants}>
                  <Card variant="elevation" sx={CARD_SX}>
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
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
                            sx={{ color: "text.secondary", fontWeight: 600 }}
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
      </FrameSection>

      {/* Partenariat — saison classique (Bakuten Shoot). */}
      <FrameSection series={SERIES.partnership} scrim={0.7} focus="center" py>
        <Container maxWidth="lg">
          <FeedMyPartnership />
        </Container>
      </FrameSection>
    </LazyMotion>
  );
}
