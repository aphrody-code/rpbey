'use client';

import { Box, Grid, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import {
  DynamicBarChart as BarChart,
  DynamicLineChart as LineChart,
  DynamicPieChart as PieChart,
} from '@/components/ui/DynamicCharts';
import { type WbBlader } from '@/lib/types';

interface WbTournamentMeta {
  slug: string;
  ubNumber: number;
  label: string;
  participantsCount: number;
  matchesCount: number;
  format: string;
  isHorsSerie?: boolean;
}

interface WbChartsProps {
  bladers: WbBlader[];
  allTournamentMetas?: WbTournamentMeta[];
}

export function WbCharts({ bladers, allTournamentMetas = [] }: WbChartsProps) {
  const topWinsData = [...bladers]
    .sort((a, b) => b.totalWins - a.totalWins)
    .slice(0, 7)
    .map((b) => ({
      name: b.name,
      wins: b.totalWins,
    }));

  const winrateRanges = {
    '75%+': 0,
    '50-75%': 0,
    '25-50%': 0,
    '<25%': 0,
  };

  bladers.forEach((b) => {
    const total = b.totalWins + b.totalLosses;
    const rate = total > 0 ? (b.totalWins / total) * 100 : 0;
    if (rate >= 75) winrateRanges['75%+']++;
    else if (rate >= 50) winrateRanges['50-75%']++;
    else if (rate >= 25) winrateRanges['25-50%']++;
    else winrateRanges['<25%']++;
  });

  const pieData = Object.entries(winrateRanges).map(([label, value], id) => ({
    id,
    value,
    label,
    color:
      id === 0
        ? '#f87171'
        : id === 1
          ? '#4caf50'
          : id === 2
            ? '#ff9800'
            : '#f44336',
  }));

  const participantsEvolution = [...allTournamentMetas]
    .sort((a, b) => {
      // UB tournaments first (sorted by number), then HS at the end
      if (a.isHorsSerie && !b.isHorsSerie) return 1;
      if (!a.isHorsSerie && b.isHorsSerie) return -1;
      return a.ubNumber - b.ubNumber;
    })
    .map((m) => ({
      ub: m.label || `UB ${m.ubNumber}`,
      participants: m.participantsCount,
    }));

  return (
    <Box
      sx={{ mb: 6 }}
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            sx={{
              p: 3,
              height: 350,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 2,
                color: 'primary.main',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top 7 - Victoires de Carrière
            </Typography>
            <Box sx={{ width: '100%', height: 280 }}>
              <BarChart
                dataset={topWinsData}
                xAxis={[{ scaleType: 'band', dataKey: 'name' }]}
                series={[
                  {
                    dataKey: 'wins',
                    color: 'var(--rpb-primary)',
                    label: 'Victoires',
                  },
                ]}
                slotProps={{ legend: { hidden: true } } as never}
                sx={{
                  '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
                    fill: 'rgba(255,255,255,0.5)',
                    fontWeight: 700,
                    fontSize: 10,
                  },
                  '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
                    fill: 'rgba(255,255,255,0.5)',
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              p: 3,
              height: 350,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                mb: 2,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Distribution des Winrates
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: 280,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <PieChart
                series={[
                  {
                    data: pieData,
                    innerRadius: 60,
                    outerRadius: 100,
                    paddingAngle: 5,
                    cornerRadius: 5,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: {
                      innerRadius: 30,
                      additionalRadius: -30,
                      color: 'gray',
                    },
                  } as never,
                ]}
                slotProps={
                  {
                    legend: {
                      labelStyle: {
                        fill: 'rgba(255,255,255,0.7)',
                        fontWeight: 700,
                        fontSize: 12,
                      },
                    },
                  } as never
                }
              />
            </Box>
          </Paper>
        </Grid>

        {participantsEvolution.length > 1 && (
          <Grid size={{ xs: 12 }}>
            <Paper
              sx={{
                p: 3,
                height: 350,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 900,
                  mb: 2,
                  color: '#60a5fa',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Évolution des Participants par UB
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <LineChart
                  dataset={participantsEvolution}
                  xAxis={[{ scaleType: 'band', dataKey: 'ub' }]}
                  series={[
                    {
                      dataKey: 'participants',
                      color: '#60a5fa',
                      label: 'Participants',
                      area: true,
                    },
                  ]}
                  slotProps={
                    {
                      legend: { hidden: true },
                    } as never
                  }
                  sx={{
                    '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
                      fill: 'rgba(255,255,255,0.5)',
                      fontWeight: 700,
                      fontSize: 10,
                    },
                    '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
                      fill: 'rgba(255,255,255,0.5)',
                    },
                    '& .MuiAreaElement-root': {
                      fillOpacity: 0.15,
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
