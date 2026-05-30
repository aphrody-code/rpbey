"use client";

import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import { alpha, Box, Card, CardActionArea, Chip, Stack, Typography, useTheme } from "@mui/material";
import Link from "next/link";
import type { TierListSummary } from "@rpbey/api-contract";
import {
  formatSubmissions,
  seasonLabel,
  TIER_COLORS,
  TIER_LIST_KIND_LABELS,
  TIER_ORDER,
} from "./shared";

/** Carte d'une tier list menant à son constructeur. */
export function TierListCard({ tierList }: { tierList: TierListSummary }) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: "blur(12px)",
        transition: "transform .2s cubic-bezier(0.2,0,0,1), box-shadow .2s",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 12px 28px ${alpha(theme.palette.secondary.main, 0.18)}`,
        },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/sondages/tier-list/${tierList.slug}`}
        sx={{ height: "100%", p: 2.5, alignItems: "flex-start" }}
      >
        <Stack spacing={1.5} sx={{ height: "100%", width: "100%" }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75 }}>
            <Chip
              size="small"
              icon={<LeaderboardIcon />}
              label={TIER_LIST_KIND_LABELS[tierList.kind]}
              color="secondary"
              sx={{ fontWeight: 700 }}
            />
            {tierList.season && (
              <Chip size="small" variant="outlined" label={seasonLabel(tierList.season)} />
            )}
          </Stack>

          <Typography
            variant="h6"
            sx={{ fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em" }}
          >
            {tierList.title}
          </Typography>

          {tierList.description && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {tierList.description}
            </Typography>
          )}

          {/* Aperçu décoratif des bandeaux de tiers. */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {TIER_ORDER.map((t) => (
              <Box
                key={t}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  bgcolor: TIER_COLORS[t].bg,
                  opacity: 0.85,
                }}
              />
            ))}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", color: "text.secondary", pt: 0.5 }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatSubmissions(tierList.totalSubmissions)}
            </Typography>
            <Typography variant="caption">
              {tierList.subjectCount} sujet{tierList.subjectCount > 1 ? "s" : ""}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
