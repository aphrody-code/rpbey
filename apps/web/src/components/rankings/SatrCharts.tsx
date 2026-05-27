"use client";

import { alpha, Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import {
  DynamicBarChart as BarChart,
  DynamicLineChart as LineChart,
  DynamicPieChart as PieChart,
  DynamicScatterChart as ScatterChart,
} from "@/components/ui/DynamicCharts";
import { type SatrBlader, type SatrRanking } from "@/lib/types";

interface TournamentMeta {
  slug: string;
  bbtNumber: number;
  participantsCount: number;
  matchesCount: number;
  format: string;
}

interface SatrChartsProps {
  bladers: SatrBlader[];
  allTournamentMetas?: TournamentMeta[];
  rankings?: SatrRanking[];
}

function parseNum(val: string) {
  return parseFloat(val.replace(",", ".").replace("%", "")) || 0;
}

// ── Tier system ──

const TIERS = [
  { label: "S", min: 44000, color: "#fbbf24" },
  { label: "A", min: 38000, color: "#4ade80" },
  { label: "B", min: 30000, color: "#60a5fa" },
  { label: "C", min: 20000, color: "#a78bfa" },
  { label: "D", min: 0, color: "#6b7280" },
] as const;

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!;
}

// ── Shared card style ──

const cardSx = {
  p: { xs: 2, md: 2.5 },
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: { xs: 3, md: 3.5 },
  overflow: "hidden",
};

const chartAxisSx = {
  "& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel": {
    fill: "rgba(255,255,255,0.5)",
    fontWeight: 700,
    fontSize: 10,
  },
  "& .MuiChartsAxis-left .MuiChartsAxis-tickLabel": {
    fill: "rgba(255,255,255,0.4)",
    fontSize: 10,
  },
  "& .MuiChartsAxis-label": {
    fill: "rgba(255,255,255,0.3)",
    fontSize: 11,
  },
};

function ChartTitle({
  children,
  color = "rgba(255,255,255,0.7)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 900,
        mb: 1.5,
        color,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: { xs: "0.65rem", md: "0.7rem" },
      }}
    >
      {children}
    </Typography>
  );
}

export function SatrCharts({ bladers, allTournamentMetas = [], rankings = [] }: SatrChartsProps) {
  // ── Data: Top 10 wins ──
  const topWins = [...bladers]
    .sort((a, b) => b.totalWins - a.totalWins)
    .slice(0, 10)
    .map((b) => ({ name: b.name, wins: b.totalWins, losses: b.totalLosses }));

  // ── Data: Winrate distribution (5 tiers) ──
  const wrBuckets = [
    { label: "80%+", min: 80, color: "#fbbf24" },
    { label: "60–80%", min: 60, color: "#4ade80" },
    { label: "40–60%", min: 40, color: "#60a5fa" },
    { label: "20–40%", min: 20, color: "#f97316" },
    { label: "<20%", min: 0, color: "#ef4444" },
  ];

  const wrDistribution = wrBuckets.map((bucket, idx) => {
    const nextMin = wrBuckets[idx - 1]?.min ?? 101;
    const count = bladers.filter((b) => {
      const total = b.totalWins + b.totalLosses;
      const wr = total > 0 ? (b.totalWins / total) * 100 : 0;
      return wr >= bucket.min && wr < nextMin;
    }).length;
    return { id: idx, value: count, label: bucket.label, color: bucket.color };
  });

  // ── Data: Participants + matches evolution ──
  const evolution = [...allTournamentMetas]
    .sort((a, b) => a.bbtNumber - b.bbtNumber)
    .map((m) => ({
      bbt: `#${m.bbtNumber}`,
      participants: m.participantsCount,
      matchs: m.matchesCount,
    }));

  // ── Data: Scatter winrate vs score (from rankings) ──
  const scatterData = rankings.slice(0, 60).map((r) => ({
    x: parseNum(r.winRate),
    y: r.score,
    id: r.playerName,
  }));

  // ── Data: Tier distribution (from rankings) ──
  const tierCounts = TIERS.map((tier) => {
    const nextTier = TIERS[TIERS.indexOf(tier) - 1];
    const count = rankings.filter(
      (r) => r.score >= tier.min && (!nextTier || r.score < nextTier.min),
    ).length;
    return { ...tier, count };
  });

  // ── Data: Top average (min 3 participations) ──
  const topAvg = [...rankings]
    .filter((r) => r.participation >= 3)
    .sort((a, b) => parseNum(b.pointsAverage) - parseNum(a.pointsAverage))
    .slice(0, 10);

  // ── Data: Most active ──
  const mostActive = [...rankings].sort((a, b) => b.participation - a.participation).slice(0, 7);

  return (
    <Box
      sx={{ mb: { xs: 4, md: 6 } }}
      component={motion.div}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        {/* ── 1. Top 10 Wins (stacked bar) ── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ ...cardSx, height: { xs: 300, md: 340 } }}>
            <ChartTitle color="#fbbf24">Top 10 — Victoires</ChartTitle>
            <Box sx={{ width: "100%", height: { xs: 240, md: 280 } }}>
              <BarChart
                dataset={topWins}
                xAxis={[{ scaleType: "band", dataKey: "name" }]}
                series={[
                  {
                    dataKey: "wins",
                    color: "#4ade80",
                    label: "W",
                    stack: "wl",
                  },
                  {
                    dataKey: "losses",
                    color: "#ef4444",
                    label: "L",
                    stack: "wl",
                  },
                ]}
                slotProps={
                  {
                    legend: {
                      labelStyle: {
                        fill: "rgba(255,255,255,0.6)",
                        fontWeight: 700,
                        fontSize: 11,
                      },
                      itemMarkWidth: 8,
                      itemMarkHeight: 8,
                    },
                  } as never
                }
                sx={chartAxisSx}
              />
            </Box>
          </Paper>
        </Grid>

        {/* ── 2. Winrate Distribution (donut) ── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ ...cardSx, height: { xs: 300, md: 340 } }}>
            <ChartTitle>Distribution Winrate</ChartTitle>
            <Box
              sx={{
                width: "100%",
                height: { xs: 240, md: 280 },
                display: "flex",
                justifyContent: "center",
              }}
            >
              <PieChart
                series={[
                  {
                    data: wrDistribution,
                    innerRadius: 55,
                    outerRadius: 95,
                    paddingAngle: 3,
                    cornerRadius: 4,
                    highlightScope: { faded: "global", highlighted: "item" },
                    faded: { additionalRadius: -8, color: "gray" },
                  } as never,
                ]}
                slotProps={
                  {
                    legend: {
                      labelStyle: {
                        fill: "rgba(255,255,255,0.6)",
                        fontWeight: 700,
                        fontSize: 11,
                      },
                      itemMarkWidth: 8,
                      itemMarkHeight: 8,
                    },
                  } as never
                }
              />
            </Box>
          </Paper>
        </Grid>

        {/* ── 3. Participants & Matchs Evolution ── */}
        {evolution.length > 1 && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ ...cardSx, height: { xs: 280, md: 320 } }}>
              <ChartTitle color="#60a5fa">Évolution par BBT</ChartTitle>
              <Box sx={{ width: "100%", height: { xs: 220, md: 260 } }}>
                <LineChart
                  dataset={evolution}
                  xAxis={[{ scaleType: "band", dataKey: "bbt" }]}
                  series={[
                    {
                      dataKey: "participants",
                      color: "#60a5fa",
                      label: "Participants",
                      area: true,
                    },
                    {
                      dataKey: "matchs",
                      color: "#a78bfa",
                      label: "Matchs",
                    },
                  ]}
                  slotProps={
                    {
                      legend: {
                        labelStyle: {
                          fill: "rgba(255,255,255,0.6)",
                          fontWeight: 700,
                          fontSize: 11,
                        },
                        itemMarkWidth: 8,
                        itemMarkHeight: 8,
                      },
                    } as never
                  }
                  sx={{
                    ...chartAxisSx,
                    "& .MuiAreaElement-root": { fillOpacity: 0.1 },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ── 4. Scatter: Winrate vs Score (top 60) ── */}
        {scatterData.length > 0 && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ ...cardSx, height: { xs: 300, md: 340 } }}>
              <ChartTitle>
                Winrate vs Score{" "}
                <Box component="span" sx={{ color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
                  (Top 60)
                </Box>
              </ChartTitle>
              <Box sx={{ width: "100%", height: { xs: 240, md: 280 } }}>
                <ScatterChart
                  series={[
                    {
                      data: scatterData,
                      color: "#fbbf24",
                      markerSize: 4,
                    } as never,
                  ]}
                  xAxis={[{ label: "Winrate (%)", min: 30, max: 100 }]}
                  yAxis={[{ label: "Score" }]}
                  slotProps={{ legend: { hidden: true } } as never}
                  sx={chartAxisSx}
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ── 5. Tier distribution ── */}
        {tierCounts.length > 0 && rankings.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={cardSx}>
              <ChartTitle>Tiers de performance</ChartTitle>
              <Stack spacing={1.5}>
                {tierCounts.map((tier) => {
                  const pct =
                    rankings.length > 0 ? ((tier.count / rankings.length) * 100).toFixed(0) : "0";
                  return (
                    <Box key={tier.label}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                          mb: 0.5,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "center",
                          }}
                        >
                          <Chip
                            label={tier.label}
                            size="small"
                            sx={{
                              fontWeight: 900,
                              fontSize: "0.65rem",
                              height: 22,
                              minWidth: 30,
                              bgcolor: alpha(tier.color, 0.15),
                              color: tier.color,
                              border: `1px solid ${alpha(tier.color, 0.3)}`,
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: "rgba(255,255,255,0.35)",
                              fontSize: "0.6rem",
                            }}
                          >
                            {tier.min > 0
                              ? `${tier.min.toLocaleString("fr-FR")}+`
                              : `< ${TIERS[TIERS.length - 2]?.min.toLocaleString("fr-FR")}`}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: tier.color,
                            fontSize: "0.7rem",
                          }}
                        >
                          {tier.count}{" "}
                          <Box
                            component="span"
                            sx={{
                              color: "rgba(255,255,255,0.25)",
                              fontWeight: 600,
                            }}
                          >
                            ({pct}%)
                          </Box>
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.04)",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            width: `${rankings.length > 0 ? (tier.count / rankings.length) * 100 : 0}%`,
                            bgcolor: tier.color,
                            borderRadius: 3,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>
        )}

        {/* ── 6. Meilleure moyenne (min 3 tournois) ── */}
        {topAvg.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ ...cardSx, height: { xs: 300, md: 340 } }}>
              <ChartTitle color="#4ade80">
                Meilleure moyenne{" "}
                <Box component="span" sx={{ color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
                  (3+ tournois)
                </Box>
              </ChartTitle>
              <Box sx={{ width: "100%", height: { xs: 240, md: 280 } }}>
                <BarChart
                  dataset={topAvg.map((r) => ({
                    name: r.playerName,
                    avg: parseNum(r.pointsAverage),
                  }))}
                  xAxis={[{ scaleType: "band", dataKey: "name" }]}
                  series={[{ dataKey: "avg", color: "#4ade80", label: "Moyenne" }]}
                  yAxis={[{ min: 2 }]}
                  slotProps={{ legend: { hidden: true } } as never}
                  sx={chartAxisSx}
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ── 7. Les plus assidus ── */}
        {mostActive.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={cardSx}>
              <ChartTitle color="#60a5fa">Les plus assidus</ChartTitle>
              <Stack spacing={0.75}>
                {mostActive.map((r, i) => {
                  const tier = getTier(r.score);
                  return (
                    <Stack
                      key={r.id}
                      direction="row"
                      spacing={1.5}
                      sx={{
                        alignItems: "center",
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,

                        bgcolor: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: "0.7rem",
                          color: "rgba(255,255,255,0.25)",
                          width: 18,
                          textAlign: "center",
                        }}
                      >
                        {i + 1}
                      </Typography>
                      <Typography
                        noWrap
                        sx={{
                          fontWeight: 800,
                          flex: 1,
                          fontSize: { xs: "0.78rem", md: "0.82rem" },
                        }}
                      >
                        {r.playerName}
                      </Typography>
                      <Chip
                        label={tier.label}
                        size="small"
                        sx={{
                          height: 18,
                          minWidth: 26,
                          fontWeight: 900,
                          fontSize: "0.55rem",
                          bgcolor: alpha(tier.color, 0.12),
                          color: tier.color,
                        }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 800,
                          color: "#60a5fa",
                          fontSize: "0.78rem",
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 16,
                          textAlign: "right",
                        }}
                      >
                        {r.participation}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.3)",
                          fontSize: "0.68rem",
                          minWidth: 40,
                          textAlign: "right",
                        }}
                      >
                        {r.winRate}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
