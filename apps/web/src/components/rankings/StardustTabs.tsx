"use client";

import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface StardustTabsProps {
  mode: "ranking" | "career";
  totalBladers: number;
  totalMatches: number;
  tournamentCount: number;
  uniqueParticipants: number;
}

const ACCENT = "#60A5FA";

export function StardustTabs({
  mode,
  totalBladers,
  totalMatches,
  tournamentCount,
  uniqueParticipants,
}: StardustTabsProps) {
  const searchParams = useSearchParams();

  const getHref = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    params.delete("page");
    return `/tournaments/stardust?${params.toString()}`;
  };

  const stats = [
    { label: "BLADERS", value: totalBladers, color: ACCENT },
    { label: "MATCHS", value: totalMatches.toLocaleString("fr-FR"), color: "#fff" },
    { label: "TOURNOIS", value: tournamentCount, color: "#a78bfa" },
    { label: "PARTICIPANTS", value: uniqueParticipants, color: "#fbbf24" },
  ];

  return (
    <Box
      sx={{
        mb: 4,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        justifyContent: "space-between",
        alignItems: { xs: "stretch", md: "center" },
        gap: { xs: 1.5, md: 2 },
        p: { xs: 0.75, md: 1 },
        borderRadius: 4,
        bgcolor: "rgba(96, 165, 250, 0.04)",
        border: "1px solid rgba(96, 165, 250, 0.12)",
      }}
    >
      <Tabs
        value={mode}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 44,
          maxWidth: "100%",
          "& .MuiTabs-indicator": {
            height: 3,
            borderRadius: 0,
            bgcolor: ACCENT,
            boxShadow: `0 0 12px ${ACCENT}80`,
          },
          "& .MuiTabs-flexContainer": {
            gap: { xs: 0.5, md: 1 },
          },
        }}
      >
        <Tab
          label="Classement"
          value="ranking"
          component={Link}
          href={getHref("ranking")}
          sx={{
            fontWeight: 900,
            textTransform: "none",
            fontSize: { xs: "0.8rem", md: "1rem" },
            minHeight: 44,
            minWidth: 0,
            px: { xs: 1.5, md: 2 },
            color: "rgba(255,255,255,0.5)",
            "&.Mui-selected": { color: "#fff" },
          }}
        />
        <Tab
          label="Historique"
          value="career"
          component={Link}
          href={getHref("career")}
          sx={{
            fontWeight: 900,
            textTransform: "none",
            fontSize: { xs: "0.8rem", md: "1rem" },
            minHeight: 44,
            minWidth: 0,
            px: { xs: 1.5, md: 2 },
            color: "rgba(255,255,255,0.5)",
            "&.Mui-selected": { color: "#fff" },
          }}
        />
      </Tabs>
      <Stack
        direction="row"
        spacing={{ xs: 1, md: 4 }}
        sx={{
          px: { xs: 0.5, md: 2 },
          justifyContent: { xs: "space-around", md: "flex-end" },
          width: { xs: "100%", md: "auto" },
          overflowX: "auto",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {stats.map((s) => (
          <Box key={s.label} sx={{ textAlign: "center", flexShrink: 0, minWidth: 52 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                fontWeight: 800,
                letterSpacing: 1,
                fontSize: { xs: "0.52rem", md: "0.65rem" },
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </Typography>
            <Typography
              sx={{
                fontWeight: 900,
                color: s.color,
                lineHeight: 1.1,
                fontSize: { xs: "0.95rem", md: "1.25rem" },
              }}
            >
              {s.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
