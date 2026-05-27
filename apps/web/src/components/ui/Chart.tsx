'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type React from 'react';
import { DynamicBarChart as MuiBarChart } from '@/components/ui/DynamicCharts';

interface ChartProps {
  title?: string;
  xAxisLabels: string[];
  series: {
    data: number[];
    label: string;
    color?: string;
  }[];
  height?: number;
  loading?: boolean;
}

export const BarChart: React.FC<ChartProps> = ({
  title,
  xAxisLabels,
  series,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
          }}
        >
          Chargement...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <MuiBarChart
        height={height}
        series={series.map((s) => ({
          ...s,
          color: s.color || theme.palette.primary.main,
        }))}
        xAxis={[{ scaleType: 'band', data: xAxisLabels }]}
        slotProps={{
          legend: {
            direction: 'horizontal',
            position: { vertical: 'top', horizontal: 'center' },
          },
        }}
      />
    </Box>
  );
};
