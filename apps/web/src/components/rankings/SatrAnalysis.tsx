'use client';

import {
  alpha,
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  DynamicBarChart as BarChart,
  DynamicScatterChart as ScatterChart,
} from '@/components/ui/DynamicCharts';
import { type SatrRanking } from '@/lib/types';

function parseNum(val: string) {
  return parseFloat(val.replace(',', '.').replace('%', '')) || 0;
}

// Tier thresholds based on score
const TIERS = [
  { label: 'S', min: 44000, color: '#fbbf24' },
  { label: 'A', min: 38000, color: '#4ade80' },
  { label: 'B', min: 30000, color: '#60a5fa' },
  { label: 'C', min: 20000, color: '#a78bfa' },
  { label: 'D', min: 0, color: '#6b7280' },
] as const;

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!;
}

interface SatrAnalysisProps {
  rankings: SatrRanking[];
}

export function SatrAnalysis({ rankings }: SatrAnalysisProps) {
  // Tier distribution
  const tierCounts = TIERS.map((tier) => {
    const nextTier = TIERS[TIERS.indexOf(tier) - 1];
    const count = rankings.filter(
      (r) => r.score >= tier.min && (!nextTier || r.score < nextTier.min),
    ).length;
    return { ...tier, count };
  });

  // Scatter data: winrate vs score (top 50 for readability)
  const scatterData = rankings.slice(0, 50).map((r) => ({
    x: parseNum(r.winRate),
    y: r.score,
    id: r.playerName,
  }));

  // Top 10 by points average (min 3 participations)
  const topAvg = [...rankings]
    .filter((r) => r.participation >= 3)
    .sort((a, b) => parseNum(b.pointsAverage) - parseNum(a.pointsAverage))
    .slice(0, 10);

  // Most experienced (by participation)
  const mostActive = [...rankings]
    .sort((a, b) => b.participation - a.participation)
    .slice(0, 7);

  return (
    <Box
      sx={{ mb: 4 }}
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {/* Tier distribution */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: { xs: 3, md: 4 },
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 2.5,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'rgba(255,255,255,0.7)',
                fontSize: { xs: '0.7rem', md: '0.75rem' },
              }}
            >
              Tiers de performance
            </Typography>
            <Stack spacing={1.5}>
              {tierCounts.map((tier) => {
                const pct =
                  rankings.length > 0
                    ? ((tier.count / rankings.length) * 100).toFixed(0)
                    : '0';
                return (
                  <Box key={tier.label}>
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: 'center',
                        }}
                      >
                        <Chip
                          label={tier.label}
                          size="small"
                          sx={{
                            fontWeight: 900,
                            fontSize: '0.7rem',
                            height: 24,
                            minWidth: 32,
                            bgcolor: alpha(tier.color, 0.15),
                            color: tier.color,
                            border: `1px solid ${alpha(tier.color, 0.3)}`,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.65rem',
                          }}
                        >
                          {tier.min > 0
                            ? `${tier.min.toLocaleString()}+`
                            : `< ${TIERS[TIERS.length - 2]?.min.toLocaleString()}`}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          color: tier.color,
                          fontSize: '0.75rem',
                        }}
                      >
                        {tier.count}{' '}
                        <Box
                          component="span"
                          sx={{
                            color: 'rgba(255,255,255,0.3)',
                            fontWeight: 600,
                          }}
                        >
                          ({pct}%)
                        </Box>
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${rankings.length > 0 ? (tier.count / rankings.length) * 100 : 0}%`,
                          bgcolor: tier.color,
                          borderRadius: 3,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        {/* Scatter: Winrate vs Score */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              height: { xs: 320, md: 370 },
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: { xs: 3, md: 4 },
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 1,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'rgba(255,255,255,0.7)',
                fontSize: { xs: '0.7rem', md: '0.75rem' },
              }}
            >
              Winrate vs Score{' '}
              <Box
                component="span"
                sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}
              >
                (Top 50)
              </Box>
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 260, md: 300 } }}>
              <ScatterChart
                series={[
                  {
                    data: scatterData,
                    color: '#fbbf24',
                    markerSize: 5,
                  } as never,
                ]}
                xAxis={[
                  {
                    label: 'Winrate (%)',
                    min: 30,
                    max: 100,
                  },
                ]}
                yAxis={[{ label: 'Score' }]}
                sx={{
                  '& .MuiChartsAxis-tickLabel': {
                    fill: 'rgba(255,255,255,0.5)',
                    fontSize: 10,
                  },
                  '& .MuiChartsAxisHighlight-root': {
                    stroke: 'rgba(255,255,255,0.1)',
                  },
                  '& .MuiChartsAxis-label': {
                    fill: 'rgba(255,255,255,0.35)',
                    fontSize: 11,
                  },
                }}
                slotProps={{ legend: { hidden: true } } as never}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Top average (min 3 participations) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              height: { xs: 340, md: 370 },
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: { xs: 3, md: 4 },
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 1,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#4ade80',
                fontSize: { xs: '0.7rem', md: '0.75rem' },
              }}
            >
              Meilleure moyenne{' '}
              <Box
                component="span"
                sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}
              >
                (3+ tournois)
              </Box>
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 280, md: 310 } }}>
              <BarChart
                dataset={topAvg.map((r) => ({
                  name: r.playerName,
                  avg: parseNum(r.pointsAverage),
                }))}
                xAxis={[{ scaleType: 'band', dataKey: 'name' }]}
                series={[
                  {
                    dataKey: 'avg',
                    color: '#4ade80',
                    label: 'Moyenne',
                  },
                ]}
                yAxis={[{ min: 2 }]}
                slotProps={{ legend: { hidden: true } } as never}
                sx={{
                  '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
                    fill: 'rgba(255,255,255,0.5)',
                    fontWeight: 700,
                    fontSize: 9,
                  },
                  '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
                    fill: 'rgba(255,255,255,0.5)',
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Most active players */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: { xs: 3, md: 4 },
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#60a5fa',
                fontSize: { xs: '0.7rem', md: '0.75rem' },
              }}
            >
              Les plus assidus
            </Typography>
            <Stack spacing={1}>
              {mostActive.map((r, i) => {
                const tier = getTier(r.score);
                return (
                  <Stack
                    key={r.id}
                    direction="row"
                    spacing={1.5}
                    sx={{
                      alignItems: 'center',
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,

                      bgcolor:
                        i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.3)',
                        width: 20,
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        noWrap
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: '0.8rem', md: '0.85rem' },
                        }}
                      >
                        {r.playerName}
                      </Typography>
                    </Box>
                    <Chip
                      label={tier.label}
                      size="small"
                      sx={{
                        height: 20,
                        minWidth: 28,
                        fontWeight: 900,
                        fontSize: '0.6rem',
                        bgcolor: alpha(tier.color, 0.12),
                        color: tier.color,
                      }}
                    />
                    <Typography
                      sx={{
                        fontWeight: 800,
                        color: '#60a5fa',
                        fontSize: '0.8rem',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.participation}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: '0.7rem',
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
      </Grid>
    </Box>
  );
}
