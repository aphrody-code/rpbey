"use client";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import Link from "next/link";

interface Mode {
  key: string;
  label: string;
  href: string;
  color: string;
}

const MODES: Mode[] = [
  { key: "global", label: "Global", href: "/rankings", color: "var(--rpb-primary)" },
  { key: "wb", label: "Wild Breakers", href: "/tournaments/wb", color: "#a78bfa" },
  { key: "satr", label: "SATR", href: "/tournaments/satr", color: "var(--rpb-secondary)" },
  { key: "stardust", label: "Stardust", href: "/tournaments/stardust", color: "#60A5FA" },
];

export function RankingModeSwitcher({ active }: { active: "global" | "wb" | "satr" | "stardust" }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        mb: { xs: 2, md: 3 },
      }}
    >
      <ToggleButtonGroup
        value={active}
        exclusive
        size="small"
        sx={{
          p: 0.5,
          borderRadius: 3,
          bgcolor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          gap: 0.5,
          flexWrap: "wrap",
          "& .MuiToggleButton-root": {
            border: "none",
            borderRadius: "12px !important",
            px: { xs: 1.5, md: 2.5 },
            py: 0.75,
            textTransform: "none",
            fontWeight: 800,
            fontSize: { xs: "0.72rem", md: "0.85rem" },
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 0.2,
          },
        }}
      >
        {MODES.map((m) => (
          <ToggleButton
            key={m.key}
            value={m.key}
            component={Link}
            href={m.href}
            sx={{
              "&.Mui-selected": {
                bgcolor: "rgba(255,255,255,0.08) !important",
                color: `${m.color} !important`,
                boxShadow: `0 0 18px ${m.color}30`,
              },
              "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: m.color,
                  boxShadow: `0 0 6px ${m.color}`,
                }}
              />
              <span>{m.label}</span>
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
