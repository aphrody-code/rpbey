"use client";

import { Box, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface SeasonTab {
  value: number;
  label: string;
  sublabel?: string;
}

interface Props {
  active: number;
  seasons: SeasonTab[];
  accent?: string;
}

/**
 * Sélecteur de saison (pills), se branche sur le query param `?season=<N>`.
 * Préserve les autres params (view, page, search…).
 */
export function SeasonTabs({ active, seasons, accent = "#60A5FA" }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", String(value));
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  };

  return (
    <Box
      sx={{
        mb: { xs: 2, md: 2.5 },
        display: "flex",
        justifyContent: { xs: "center", md: "flex-start" },
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          p: 0.5,
          borderRadius: 3,
          bgcolor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        {seasons.map((s) => {
          const selected = s.value === active;
          return (
            <Box
              key={s.value}
              component={Link}
              href={hrefFor(s.value)}
              sx={{
                textDecoration: "none",
                px: { xs: 1.5, md: 2 },
                py: 0.6,
                borderRadius: 2,
                bgcolor: selected ? `${accent}20` : "transparent",
                color: selected ? accent : "rgba(255,255,255,0.55)",
                border: selected ? `1px solid ${accent}60` : "1px solid transparent",
                boxShadow: selected ? `0 0 14px ${accent}30` : "none",
                transition: "all 0.2s ease",
                "&:hover": {
                  color: accent,
                  bgcolor: `${accent}10`,
                },
                minWidth: 72,
                textAlign: "center",
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "0.7rem", md: "0.82rem" },
                  letterSpacing: 1,
                  lineHeight: 1,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </Typography>
              {s.sublabel && (
                <Typography
                  sx={{
                    fontSize: { xs: "0.52rem", md: "0.6rem" },
                    fontWeight: 700,
                    opacity: 0.75,
                    mt: 0.25,
                    letterSpacing: 0.5,
                  }}
                >
                  {s.sublabel}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
