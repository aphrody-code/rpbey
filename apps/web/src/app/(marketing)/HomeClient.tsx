"use client";

import { FiberManualRecord } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { alpha, type Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { domAnimation, LazyMotion, m } from "framer-motion";
import { Big_Shoulders } from "next/font/google";
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

// Display condensé pour les titres de cartes (contenu réel uniquement).
const display = Big_Shoulders({ subsets: ["latin"], display: "swap" });

const EMPH_DECEL = [0.05, 0.7, 0.1, 1.0] as const;

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.1 } },
};
const staggerItemVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// Carte « glass » : translucide, liseré rouge, la frame respire derrière.
const CARD_SX = {
  bgcolor: (t: Theme) => alpha(t.palette.background.paper, 0.5),
  backdropFilter: "blur(10px)",
  borderRadius: 1.5,
  p: 1,
  overflow: "hidden",
  border: "1px solid",
  borderColor: (t: Theme) => alpha(t.palette.common.white, 0.12),
  borderTop: "3px solid",
  borderTopColor: "primary.main",
  boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
};

const CARD_TITLE_SX = {
  fontFamily: display.style.fontFamily,
  fontWeight: 800,
  fontSize: { xs: "1.4rem", md: "1.8rem" },
  textTransform: "uppercase" as const,
  letterSpacing: "0.01em",
  color: "text.primary",
  lineHeight: 1,
};

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

/** Section compacte : frame d'animé curée en fond + contenu lisible dessus. Aucun bloc de texte décoratif. */
function FrameSection({
  series,
  focus = "center",
  contentVeil,
  children,
}: {
  series: string;
  focus?: "top" | "center" | "bottom";
  contentVeil?: number;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{ position: "relative", overflow: "hidden", py: { xs: 4, md: 6 } }}
    >
      <SectionFrameBg series={series} focus={focus} contentVeil={contentVeil} />
      <Box
        component={m.div}
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: EMPH_DECEL }}
        sx={{ position: "relative", zIndex: 1, width: "100%" }}
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
      {/* Tournois — fond Beyblade X */}
      <FrameSection series={SERIES.tournaments} focus="center">
        {activeTournament && (
          <Container maxWidth="lg" sx={{ mb: 2 }}>
            <Chip
              icon={<FiberManualRecord sx={{ fontSize: 12, animation: "pulse 1.5s infinite" }} />}
              label={`EN DIRECT : ${activeTournament.name}`}
              component={Link}
              href={`/tournaments/${activeTournament.id}`}
              sx={{
                px: 1,
                py: 2.5,
                borderRadius: 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.18),
                color: "primary.main",
                fontWeight: 800,
                letterSpacing: "0.06em",
                border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.45)}`,
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.28),
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

      {/* Vidéos — fond Metal Fight */}
      {recentVideos.length > 0 && (
        <FrameSection series={SERIES.videos} focus="center">
          <VideoCarousel videos={recentVideos} />
        </FrameSection>
      )}

      {/* Classements + Méta — fond Burst */}
      <FrameSection series={SERIES.rankings} focus="top" contentVeil={0.9}>
        <Container maxWidth="lg">
          <Box
            component={m.div}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainerVariants}
          >
            <Grid container spacing={3}>
              <Grid size={12} component={m.div} variants={staggerItemVariants}>
                <Card variant="elevation" sx={{ ...CARD_SX, height: "100%" }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
                    >
                      <Box>
                        <Typography component="h2" sx={CARD_TITLE_SX}>
                          Classements Live
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.1em" }}
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
                        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
                      >
                        <Box>
                          <Typography component="h2" sx={CARD_TITLE_SX}>
                            Meta Beyblade X
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                            }}
                          >
                            TOP PIÈCES PAR CATÉGORIE · WBO
                          </Typography>
                        </Box>
                        <Chip
                          label="LIVE"
                          size="small"
                          sx={{
                            fontWeight: 900,
                            fontSize: "0.6rem",
                            letterSpacing: "0.14em",
                            height: 22,
                            borderRadius: 1,
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
                            color: "primary.main",
                            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
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

      {/* Partenariat — fond Bakuten */}
      <FrameSection series={SERIES.partnership} focus="center" contentVeil={0.9}>
        <Container maxWidth="lg">
          <FeedMyPartnership />
        </Container>
      </FrameSection>
    </LazyMotion>
  );
}
