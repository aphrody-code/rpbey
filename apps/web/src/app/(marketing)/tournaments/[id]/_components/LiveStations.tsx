"use client";

import { alpha, Grid, Paper, Stack, Typography, useTheme } from "@mui/material";
import type { Station } from "./types";

export function LiveStations({ stations }: { stations: Station[] }) {
  const theme = useTheme();
  const active = stations.filter((s) => s.status === "active");
  if (active.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        mb: 4,
        borderRadius: 6,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        backdropFilter: "blur(10px)",
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: "900", mb: 4, letterSpacing: 1 }}>
        STADIUMS EN DIRECT
      </Typography>
      <Grid container spacing={3}>
        {active.map((station) => (
          <Grid key={station.stationId} size={{ xs: 12, sm: 6, xl: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  fontWeight: "900",
                  display: "block",
                  mb: 2,
                  textTransform: "uppercase",
                }}
              >
                {station.name}
              </Typography>
              {station.currentMatch ? (
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ fontWeight: "900", maxWidth: "40%" }}>
                    {station.currentMatch.player1}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: "900",
                      px: 1.5,
                      py: 0.5,
                      bgcolor: "error.main",
                      color: "white",
                      borderRadius: 1,
                    }}
                  >
                    {station.currentMatch.scores || "VS"}
                  </Typography>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: "900",
                      textAlign: "right",
                      maxWidth: "40%",
                    }}
                  >
                    {station.currentMatch.player2}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                  Disponible pour combat
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
