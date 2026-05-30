"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import type { AwardLeader } from "./shared";

const GOLD = "#ffca28";

/**
 * Prévisualisation des GAGNANTS en tête des Beyblade Awards : pour chaque catégorie
 * ayant des votes, le nominé le plus voté (avatar + % + nombre de votes), cliquable
 * vers le sondage. N'affiche rien tant qu'aucune catégorie n'a de vote.
 */
export function AwardsWinnersPreview({ leaders }: { leaders: AwardLeader[] }) {
  const withVotes = leaders.filter((l) => l.leader && l.totalVotes > 0);
  if (withVotes.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
        <EmojiEventsIcon sx={{ color: GOLD, fontSize: 22 }} />
        <Typography sx={{ fontWeight: 800, letterSpacing: "0.01em" }}>
          En tête du palmarès
        </Typography>
        <Chip
          size="small"
          label="aperçu live"
          sx={{
            fontWeight: 800,
            fontSize: "0.6rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            bgcolor: alpha(GOLD, 0.2),
            color: GOLD,
          }}
        />
      </Stack>

      <Grid container spacing={1.5}>
        {withVotes.map((l) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={l.pollSlug}>
            <Box
              component={Link}
              href={`/sondages/${l.pollSlug}`}
              sx={{
                display: "flex",
                gap: 1.5,
                alignItems: "center",
                p: 1.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: alpha(GOLD, 0.3),
                bgcolor: "background.paper",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color .2s, transform .2s",
                "&:hover": { borderColor: GOLD, transform: "translateY(-2px)" },
              }}
            >
              <Avatar
                src={l.leader!.imageUrl ?? undefined}
                variant="rounded"
                sx={{
                  width: 46,
                  height: 46,
                  bgcolor: alpha(GOLD, 0.18),
                  color: GOLD,
                  fontWeight: 900,
                }}
              >
                {l.leader!.label.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {l.pollTitle}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 800,
                    lineHeight: 1.15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {l.leader!.label}
                </Typography>
                <Typography variant="caption" sx={{ color: GOLD, fontWeight: 800 }}>
                  {l.leader!.percent}% · {l.leader!.voteCount} vote
                  {l.leader!.voteCount > 1 ? "s" : ""}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
