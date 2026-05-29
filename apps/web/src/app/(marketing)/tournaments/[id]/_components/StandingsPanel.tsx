"use client";

import { alpha, Box, Button, Stack, Typography } from "@mui/material";
import type { Standing } from "./types";

const RANK_COLORS: Record<number, string> = {
  1: "#fbbf24",
  2: "#94a3b8",
  3: "#d97706",
};

export function StandingsPanel({ standings }: { standings: Standing[] }) {
  if (standings.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
        Classement non disponible pour le moment.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {standings.map((s) => {
        const isTop3 = s.rank <= 3;
        const color = RANK_COLORS[s.rank] ?? "transparent";
        return (
          <Box
            key={`${s.rank}-${s.name}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              p: 2.5,
              borderRadius: 4,
              border: "1px solid",
              borderColor: isTop3 ? alpha(color, 0.3) : "divider",
              bgcolor: isTop3 ? alpha(color, 0.03) : "transparent",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: isTop3 ? color : "action.selected",
                color: s.rank === 1 ? "black" : "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "1.1rem",
              }}
            >
              {s.rank}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 900, flex: 1 }}>
              {s.name}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "success.main" }}>
              {s.stats?.wins ?? s.wins}W{" "}
              <Box component="span" sx={{ color: "text.disabled", mx: 0.5 }}>
                -
              </Box>{" "}
              <Box component="span" sx={{ color: "error.main" }}>
                {s.stats?.losses ?? s.losses}L
              </Box>
            </Typography>
            {s.challongeProfileUrl && (
              <Button
                size="small"
                variant="outlined"
                href={s.challongeProfileUrl}
                target="_blank"
                sx={{ borderRadius: 2, fontWeight: 800 }}
              >
                Profil
              </Button>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
