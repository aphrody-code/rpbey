"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { alpha, Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import useSWR from "swr";
import type { AwardsEdition, AwardsEditionsResponse } from "@rpbey/api-contract";
import { pollsFetcher } from "./shared";

const gold = "#ffca28";

/** Sélectionne l'édition publiée la plus récente (par année décroissante). */
function pickLatestPublished(editions: AwardsEdition[]): AwardsEdition | undefined {
  return editions.filter((e) => e.isPublished).sort((a, b) => b.year - a.year)[0];
}

/**
 * Bandeau de mise en avant de l'édition Beyblade Awards publiée la plus récente :
 * titre, description et lecteur YouTube embarqué (16:9 responsive) quand une vidéo
 * de résultats est disponible. N'affiche rien si aucune édition n'est publiée
 * (ni en cas d'erreur de chargement) — la grille des catégories reste gérée à part.
 */
export function AwardsEditionBanner() {
  const theme = useTheme();
  const { data } = useSWR<AwardsEditionsResponse>("/api/v1/awards", pollsFetcher);

  const edition = data ? pickLatestPublished(data.editions) : undefined;
  if (!edition) return null;

  return (
    <Box
      sx={{
        mb: 4,
        p: { xs: 2.5, md: 4 },
        borderRadius: 5,
        border: "1px solid",
        borderColor: alpha(gold, 0.35),
        background: `radial-gradient(1200px 320px at 100% 0%, ${alpha(gold, 0.14)} 0%, transparent 60%), linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.92)} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: "blur(16px)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: edition.description ? 1.5 : 2.5,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <EmojiEventsIcon sx={{ fontSize: 40, color: gold }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
              {edition.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Cérémonie {edition.year} — le palmarès de la communauté.
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={edition.isVotingOpen ? "Votes ouverts" : "Palmarès dévoilé"}
          sx={{ fontWeight: 800, bgcolor: alpha(gold, 0.2) }}
        />
      </Stack>

      {edition.description && (
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 2.5, maxWidth: 760 }}>
          {edition.description}
        </Typography>
      )}

      {edition.videoId && (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            pt: "56.25%",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid",
            borderColor: alpha(gold, 0.3),
            boxShadow: `0 18px 48px ${alpha("#000", 0.4)}`,
          }}
        >
          <Box
            component="iframe"
            src={`https://www.youtube.com/embed/${edition.videoId}`}
            title={edition.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </Box>
      )}
    </Box>
  );
}
