"use client";

import HowToVoteIcon from "@mui/icons-material/HowToVote";
import LockIcon from "@mui/icons-material/Lock";
import { alpha, Box, Card, CardActionArea, Chip, Stack, Typography, useTheme } from "@mui/material";
import Link from "next/link";
import type { PollSummary } from "@rpbey/api-contract";
import { formatVotes, POLL_KIND_LABELS, seasonLabel } from "./shared";

/** Carte d'un sondage menant à sa page de vote. */
export function PollCard({ poll }: { poll: PollSummary }) {
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
          boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.18)}`,
        },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/sondages/${poll.slug}`}
        sx={{ height: "100%", p: 2.5, alignItems: "flex-start" }}
      >
        <Stack spacing={1.5} sx={{ height: "100%", width: "100%" }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75 }}>
            <Chip
              size="small"
              icon={poll.isClosed ? <LockIcon /> : <HowToVoteIcon />}
              label={poll.isClosed ? "Clôturé" : POLL_KIND_LABELS[poll.kind]}
              color={poll.isClosed ? "default" : "primary"}
              variant={poll.isClosed ? "outlined" : "filled"}
              sx={{ fontWeight: 700 }}
            />
            {poll.season && (
              <Chip size="small" variant="outlined" label={seasonLabel(poll.season)} />
            )}
          </Stack>

          <Typography
            variant="h6"
            sx={{ fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em" }}
          >
            {poll.question}
          </Typography>

          {poll.description && (
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
              {poll.description}
            </Typography>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", color: "text.secondary", pt: 0.5 }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatVotes(poll.totalVotes)}
            </Typography>
            <Typography variant="caption">
              {poll.optionCount} option{poll.optionCount > 1 ? "s" : ""}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
