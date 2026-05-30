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
import { useEffect, useState } from "react";
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

// Carte SOLIDE (zéro flou, zéro transparence) : surface opaque + liseré rouge.
const CARD_SX = {
  bgcolor: "background.paper",
  borderRadius: 1.5,
  p: 1,
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
  borderTop: "3px solid",
  borderTopColor: "var(--rpb-frame-accent, #e11d2a)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
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

/** Section plein-écran : frame d'animé curée en fond + contenu solide, point d'ancrage du scroll-snap. */
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
      data-snap
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        py: { xs: 7, md: 8 },
      }}
    >
      <SectionFrameBg series={series} focus={focus} contentVeil={contentVeil} />
      <Box
        component={m.div}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6, ease: EMPH_DECEL }}
        sx={{ position: "relative", zIndex: 1, width: "100%" }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * Transition au scroll plein-page : scroll-snap (tactile / molette) + navigation
 * CLAVIER (PageDown/Up, Espace, ↑/↓, Home/End) + dots de section cliquables.
 * Le scroll-snap est posé sur `<html>` à l'entrée de la home et restauré à la sortie
 * (scoped : n'affecte pas les autres pages).
 */
function useSnapNav(): { active: number; count: number; goTo: (i: number) => void } {
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const prevSnap = root.style.scrollSnapType;
    const prevBeh = root.style.scrollBehavior;
    root.style.scrollSnapType = "y proximity";
    root.style.scrollBehavior = "smooth";

    const sections = () => Array.from(document.querySelectorAll<HTMLElement>("[data-snap]"));
    setCount(sections().length);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = sections().indexOf(e.target as HTMLElement);
            if (idx >= 0) setActive(idx);
          }
        }
      },
      { threshold: 0.55 },
    );
    sections().forEach((s) => io.observe(s));

    const curIndex = (): number => {
      const els = sections();
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      els.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };
    const jump = (dir: number) => {
      const els = sections();
      const next = Math.min(els.length - 1, Math.max(0, curIndex() + dir));
      els[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      switch (ev.key) {
        case "PageDown":
          ev.preventDefault();
          jump(1);
          break;
        case "PageUp":
          ev.preventDefault();
          jump(-1);
          break;
        case " ":
          ev.preventDefault();
          jump(ev.shiftKey ? -1 : 1);
          break;
        case "Home":
          ev.preventDefault();
          sections()[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        case "End": {
          ev.preventDefault();
          const els = sections();
          els[els.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKey);
      root.style.scrollSnapType = prevSnap;
      root.style.scrollBehavior = prevBeh;
    };
  }, []);

  const goTo = (i: number) => {
    document.querySelectorAll<HTMLElement>("[data-snap]")[i]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return { active, count, goTo };
}

/** Dots de navigation de section (desktop) — reflètent la section active + cliquables. */
function SnapDots({
  active,
  count,
  goTo,
}: {
  active: number;
  count: number;
  goTo: (i: number) => void;
}) {
  if (count < 2) return null;
  return (
    <Stack
      aria-hidden
      direction="column"
      sx={{
        position: "fixed",
        right: { xs: 10, md: 18 },
        top: "50%",
        transform: "translateY(-50%)",
        gap: 1.5,
        zIndex: 1200,
        display: { xs: "none", md: "flex" },
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          component="button"
          onClick={() => goTo(i)}
          aria-label={`Section ${i + 1}`}
          sx={{
            p: 0,
            cursor: "pointer",
            border: "none",
            bgcolor: i === active ? "primary.main" : "rgba(255,255,255,0.55)",
            width: i === active ? 13 : 9,
            height: i === active ? 13 : 9,
            borderRadius: "50%",
            boxShadow: i === active ? "0 0 10px rgba(var(--rpb-primary-rgb),0.8)" : "none",
            transition: "all .25s cubic-bezier(0.2,0,0,1)",
          }}
        />
      ))}
    </Stack>
  );
}

export default function HomeClient({
  activeTournament,
  rankingBoards = [],
  metaParts = [],
  recentVideos = [],
  tournaments = [],
}: HomeClientProps) {
  const { active, count, goTo } = useSnapNav();

  return (
    <LazyMotion features={domAnimation}>
      <SnapDots active={active} count={count} goTo={goTo} />

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
                px: 1.5,
                py: 2.5,
                borderRadius: 1.5,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                fontWeight: 800,
                letterSpacing: "0.06em",
                cursor: "pointer",
                "& .MuiChip-icon": { color: "inherit" },
                "&:hover": { bgcolor: "primary.dark" },
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.45 },
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
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
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
