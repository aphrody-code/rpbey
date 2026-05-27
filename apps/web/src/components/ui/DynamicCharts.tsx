'use client';

import { Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';

const ChartSkeleton = () => (
  <Skeleton
    variant="rectangular"
    width="100%"
    height={300}
    sx={{ borderRadius: 2 }}
  />
);

export const DynamicBarChart = dynamic(
  () => import('@mui/x-charts/BarChart').then((mod) => mod.BarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const DynamicPieChart = dynamic(
  () => import('@mui/x-charts/PieChart').then((mod) => mod.PieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const DynamicLineChart = dynamic(
  () => import('@mui/x-charts/LineChart').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const DynamicRadarChart = dynamic(
  () => import('@mui/x-charts/RadarChart').then((mod) => mod.RadarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const DynamicScatterChart = dynamic(
  () => import('@mui/x-charts/ScatterChart').then((mod) => mod.ScatterChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
