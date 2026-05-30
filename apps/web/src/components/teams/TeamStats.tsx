"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import { alpha, Box, Grid, Stack, Typography, useTheme } from "@mui/material";
import type { TeamSummary } from "@rpbey/api-contract";

interface StatTile {
  label: string;
  value: string;
  icon: React.ReactNode;
}

/** Grille de statistiques agrégées d'une équipe (points, bilan, tournois, membres). */
export function TeamStats({ team }: { team: TeamSummary }) {
  const theme = useTheme();
  const accent = team.accentColor || theme.palette.primary.main;
  const totalGames = team.totalWins + team.totalLosses;
  const winrate = totalGames > 0 ? Math.round((team.totalWins / totalGames) * 100) : 0;

  const tiles: StatTile[] = [
    {
      label: "Points",
      value: team.totalPoints.toLocaleString("fr-FR"),
      icon: <EmojiEventsIcon />,
    },
    {
      label: "Victoires / Défaites",
      value: `${team.totalWins} / ${team.totalLosses}`,
      icon: <SportsKabaddiIcon />,
    },
    {
      label: "Tournois gagnés",
      value: String(team.totalTournamentWins),
      icon: <MilitaryTechIcon />,
    },
    {
      label: "Membres",
      value: String(team.memberCount),
      icon: <GroupsIcon />,
    },
  ];

  return (
    <Box>
      <Grid container spacing={2}>
        {tiles.map((t) => (
          <Grid size={{ xs: 6, md: 3 }} key={t.label}>
            <Box
              sx={{
                p: 2.5,
                height: "100%",
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: alpha(accent, 0.05),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", color: accent, mb: 1 }}
              >
                {t.icon}
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {t.label}
                </Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                {t.value}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      {totalGames > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
          Taux de victoire : <strong>{winrate}%</strong> sur {totalGames} matchs.
        </Typography>
      )}
    </Box>
  );
}
