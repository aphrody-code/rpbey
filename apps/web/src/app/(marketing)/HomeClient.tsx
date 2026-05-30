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
import { UniverseDivider } from "@/components/ui/UniverseDivider";

// Display « affiche civique » — República Populaire. Caractériel, condensé, impactant.
const display = Big_Shoulders({ subsets: ["latin"], display: "swap" });

const EMPH_DECEL = [0.05, 0.7, 0.1, 1.0] as const;

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

// Carte « glass de combat » : translucide, liseré rouge en tête, angles francs.
const CARD_SX = {
  bgcolor: (t: Theme) => alpha(t.palette.background.paper, 0.48),
  backdropFilter: "blur(10px)",
  borderRadius: 1.5,
  p: 1,
  overflow: "hidden",
  border: "1px solid",
  borderColor: (t: Theme) => alpha(t.palette.common.white, 0.12),
  borderTop: "3px solid",
  borderTopColor: "primary.main",
  boxShadow: "0 22px 60px rgba(0,0,0,0.5)",
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

/** En-tête « bureau » d'une section : index géant fantôme + barre rouge en biais + titre display. */
function SectionChrome({
  index,
  bureau,
  kicker,
}: {
  index: string;
  bureau: string;
  kicker: string;
}) {
  return (
    <Box sx={{ position: "relative", mb: { xs: 4, md: 6 } }}>
      <Box
        component="span"
        aria-hidden
        sx={{
          position: "absolute",
          left: { xs: -4, md: -18 },
          top: { xs: -48, md: -96 },
          zIndex: 0,
          fontFamily: display.style.fontFamily,
          fontWeight: 900,
          lineHeight: 0.8,
          fontSize: { xs: "8rem", md: "15rem" },
          letterSpacing: "-0.05em",
          color: "transparent",
          WebkitTextStroke: "2px rgba(var(--rpb-primary-rgb),0.26)",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {index}
      </Box>
      <Stack
        direction="row"
        sx={{ alignItems: "center", gap: { xs: 1.5, md: 2.5 }, position: "relative", zIndex: 1 }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: 34, md: 64 },
            height: { xs: 6, md: 9 },
            bgcolor: "primary.main",
            transform: "skewX(-22deg)",
            boxShadow: "0 0 18px rgba(var(--rpb-primary-rgb),0.65)",
          }}
        />
        <Box>
          <Typography
            component="span"
            sx={{
              display: "block",
              color: "rgba(var(--rpb-primary-rgb),1)",
              fontWeight: 800,
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              fontSize: { xs: "0.6rem", md: "0.72rem" },
              mb: 0.6,
              pl: "0.34em",
            }}
          >
            {kicker}
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontFamily: display.style.fontFamily,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.004em",
              fontSize: { xs: "2.1rem", md: "3.6rem" },
              lineHeight: 0.88,
              color: "#f5f0e6",
              textShadow: "0 4px 30px rgba(0,0,0,0.6)",
            }}
          >
            {bureau}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

/** Section plein-cadre cinématique : frame nette + en-tête bureau + contenu composé. */
function FrameSection({
  series,
  focus = "center",
  contentVeil,
  index,
  bureau,
  kicker,
  children,
}: {
  series: string;
  focus?: "top" | "center" | "bottom";
  contentVeil?: number;
  index: string;
  bureau: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: { xs: "auto", md: "62vh" },
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        py: { xs: 7, md: 9 },
      }}
    >
      <SectionFrameBg series={series} focus={focus} contentVeil={contentVeil} />
      <Box
        component={m.div}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: EMPH_DECEL }}
        sx={{ position: "relative", zIndex: 1, width: "100%" }}
      >
        <Container maxWidth="lg" sx={{ overflow: "visible" }}>
          <SectionChrome index={index} bureau={bureau} kicker={kicker} />
        </Container>
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
      <Box style={{ "--rpb-display": display.style.fontFamily } as React.CSSProperties}>
        {/* ── 01 · Beyblade X — Tournois ── */}
        <FrameSection
          series={SERIES.tournaments}
          focus="center"
          index="01"
          kicker="République Populaire · Arène"
          bureau="Bureau des tournois"
        >
          {activeTournament && (
            <Container maxWidth="lg" sx={{ mb: { xs: 3, md: 4 } }}>
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

        {/* ── 02 · Metal Fight — Vidéos ── */}
        {recentVideos.length > 0 && (
          <>
            <UniverseDivider chapter="02" label="Metal Fight" sub="Saga Metal · 2009" />
            <FrameSection
              series={SERIES.videos}
              focus="center"
              index="02"
              kicker="Diffusion d'État"
              bureau="Propagande visuelle"
            >
              <VideoCarousel videos={recentVideos} />
            </FrameSection>
          </>
        )}

        {/* ── 03 · Burst — Classements & Méta ── */}
        <UniverseDivider chapter="03" label="Burst" sub="Génération Burst" />
        <FrameSection
          series={SERIES.rankings}
          focus="top"
          contentVeil={0.92}
          index="03"
          kicker="Décret du classement"
          bureau="Comité central"
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
                  <Card variant="elevation" sx={{ ...CARD_SX, height: "100%" }}>
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
                      >
                        <Box>
                          <Typography
                            component="h3"
                            sx={{
                              fontFamily: display.style.fontFamily,
                              fontWeight: 800,
                              fontSize: { xs: "1.5rem", md: "1.9rem" },
                              textTransform: "uppercase",
                              letterSpacing: "0.01em",
                              color: "text.primary",
                              lineHeight: 1,
                            }}
                          >
                            Classements Live
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 700,
                              letterSpacing: "0.12em",
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
                              component="h3"
                              sx={{
                                fontFamily: display.style.fontFamily,
                                fontWeight: 800,
                                fontSize: { xs: "1.5rem", md: "1.9rem" },
                                textTransform: "uppercase",
                                letterSpacing: "0.01em",
                                color: "text.primary",
                                lineHeight: 1,
                              }}
                            >
                              Meta Beyblade X
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                fontWeight: 700,
                                letterSpacing: "0.12em",
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

        {/* ── 04 · Bakuten Shoot — Partenariat ── */}
        <UniverseDivider chapter="04" label="Bakuten Shoot" sub="L'origine · 2001" />
        <FrameSection
          series={SERIES.partnership}
          focus="center"
          contentVeil={0.92}
          index="04"
          kicker="Front uni"
          bureau="Alliances populaires"
        >
          <Container maxWidth="lg">
            <FeedMyPartnership />
          </Container>
        </FrameSection>
      </Box>
    </LazyMotion>
  );
}
