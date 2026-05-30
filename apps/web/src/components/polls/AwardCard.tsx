"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { alpha, Box, Card, CardActionArea, Chip, Stack, Typography, useTheme } from "@mui/material";
import Link from "next/link";
import type { PollSummary } from "@rpbey/api-contract";
import { formatVotes } from "./shared";

/** Carte d'une catégorie d'awards (style trophée doré). */
export function AwardCard({ poll }: { poll: PollSummary }) {
  const theme = useTheme();
  const gold = "#ffca28";

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: 4,
        border: "1px solid",
        borderColor: alpha(gold, 0.35),
        background: `linear-gradient(150deg, ${alpha(gold, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 55%)`,
        backdropFilter: "blur(12px)",
        transition: "transform .2s cubic-bezier(0.2,0,0,1), box-shadow .2s",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 12px 30px ${alpha(gold, 0.3)}`,
          borderColor: alpha(gold, 0.6),
        },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/sondages/${poll.slug}`}
        sx={{ height: "100%", p: 2.5, alignItems: "flex-start" }}
      >
        <Stack spacing={1.25} sx={{ height: "100%", width: "100%" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <EmojiEventsIcon sx={{ color: gold, fontSize: 28 }} />
            {poll.isClosed ? (
              <Chip size="small" variant="outlined" label="Résultats" sx={{ fontWeight: 700 }} />
            ) : (
              <Chip
                size="small"
                icon={<CheckCircleIcon />}
                label="Vote ouvert"
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha(gold, 0.2),
                  color: theme.palette.mode === "dark" ? gold : "var(--md-sys-color-on-surface)",
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />
            )}
          </Stack>

          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em" }}
          >
            {poll.question}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", color: "text.secondary" }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatVotes(poll.totalVotes)}
            </Typography>
            <Typography variant="caption">
              {poll.optionCount} nominé{poll.optionCount > 1 ? "s" : ""}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
