'use client';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';

import { DynamicRadarChart } from '@/components/ui/DynamicCharts';

import { SynergyList } from './SynergyList';
import { type ComponentData } from './types';

function PositionIndicator({ change }: { change: number | 'NEW' }) {
  if (change === 'NEW') {
    return (
      <Typography
        component="span"
        sx={{
          fontSize: '0.55rem',
          fontWeight: 900,
          color: '#22c55e',
          bgcolor: 'rgba(34,197,94,0.12)',
          px: 0.5,
          py: 0.15,
          borderRadius: 0.5,
          lineHeight: 1,
        }}
      >
        NEW
      </Typography>
    );
  }

  if (change > 0) {
    return (
      <Typography
        component="span"
        sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e' }}
      >
        ▲{change}
      </Typography>
    );
  }

  if (change < 0) {
    return (
      <Typography
        component="span"
        sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444' }}
      >
        ▼{Math.abs(change)}
      </Typography>
    );
  }

  return (
    <Typography
      component="span"
      sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
    >
      —
    </Typography>
  );
}

export function PartRankCard({
  component,
  rank,
  color,
  maxScore,
}: {
  component: ComponentData;
  rank: number;
  color: string;
  maxScore: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSynergy = component.synergy.length > 0;
  const hasStats =
    component.stats != null &&
    component.stats.attack +
      component.stats.defense +
      component.stats.stamina +
      component.stats.dash +
      component.stats.burst >
      0;
  const isExpandable = hasSynergy || hasStats;

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: { xs: 2, md: 2.5 },
        transition: 'all 0.2s ease-out',
        '&:hover': {
          borderColor: alpha(color, 0.3),
          boxShadow: `0 4px 16px -4px ${alpha(color, 0.15)}`,
        },
      }}
    >
      <CardContent
        sx={{
          p: { xs: 1.5, md: 2 },
          '&:last-child': {
            pb: isExpandable ? { xs: 1, md: 1.5 } : { xs: 1.5, md: 2 },
          },
        }}
      >
        {/* Header: Rank + Name + Change + Score */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 1.5 },
            mb: 0.75,
          }}
        >
          {/* Rank */}
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: '0.95rem', md: '1.1rem' },
              color: rank <= 3 ? color : 'text.secondary',
              minWidth: { xs: 20, md: 24 },
              textAlign: 'center',
            }}
          >
            {rank}
          </Typography>

          {/* Part Image */}
          {component.imageUrl && (
            <Avatar
              src={component.imageUrl}
              variant="rounded"
              sx={{
                width: { xs: 32, md: 40 },
                height: { xs: 32, md: 40 },
                bgcolor: 'transparent',
                '& img': {
                  objectFit: 'contain',
                },
              }}
            >
              {component.name.charAt(0)}
            </Avatar>
          )}

          {/* Name */}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              flex: 1,
              minWidth: 0,
              fontSize: { xs: '0.8rem', md: '0.875rem' },
            }}
            noWrap
          >
            {component.name}
          </Typography>

          {/* Position Change */}
          <PositionIndicator change={component.position_change} />

          {/* Score */}
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              color,
              minWidth: { xs: 28, md: 32 },
              textAlign: 'right',
            }}
          >
            {component.score}
          </Typography>
        </Box>

        {/* Score Bar */}
        <LinearProgress
          variant="determinate"
          value={maxScore > 0 ? (component.score / maxScore) * 100 : 0}
          sx={{
            height: { xs: 4, md: 5 },
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.05)',
            '& .MuiLinearProgress-bar': {
              bgcolor: color,
              borderRadius: 3,
            },
          }}
        />

        {/* Expandable Section */}
        {isExpandable && (
          <>
            <Box
              onClick={() => setExpanded(!expanded)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 0.75,
                cursor: 'pointer',
                userSelect: 'none',
                minHeight: 28,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.55rem', md: '0.6rem' },
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {hasStats && hasSynergy
                  ? `STATS · SYNERGIES (${component.synergy.length})`
                  : hasStats
                    ? 'STATS'
                    : `SYNERGIES (${component.synergy.length})`}
              </Typography>
              <IconButton
                size="small"
                sx={{
                  p: 0.25,
                  transition: 'transform 0.2s',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <ExpandMoreIcon
                  sx={{ fontSize: { xs: 14, md: 16 }, color: 'text.secondary' }}
                />
              </IconButton>
            </Box>

            {expanded && hasStats && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  mt: 0.5,
                  mb: hasSynergy ? 0.5 : 0,
                }}
              >
                <DynamicRadarChart
                  {...({
                    series: [
                      {
                        type: 'radar',
                        data: [
                          component.stats?.attack,
                          component.stats?.defense,
                          component.stats?.stamina,
                          component.stats?.dash,
                          component.stats?.burst,
                        ],
                        color,
                        fillArea: true,
                      },
                    ],
                    radar: {
                      metrics: ['ATK', 'DEF', 'END', 'DSH', 'BST'],
                      max: 10,
                    },
                    shape: 'circular',
                    divisions: 5,
                    stripeColor: (index: number) =>
                      index % 2 === 0 ? alpha(color, 0.15) : 'transparent',
                    width: 200,
                    height: 170,
                    margin: { top: 10, bottom: 10, left: 10, right: 10 },
                    slotProps: {
                      legend: { hidden: true },
                    },
                    sx: {
                      '& .MuiChartsAxis-line': {
                        stroke: 'rgba(255,255,255,0.1)',
                      },
                      '& .MuiChartsAxis-tick': {
                        stroke: 'rgba(255,255,255,0.1)',
                      },
                      '& .MuiChartsAxis-tickLabel': {
                        fill: 'text.secondary',
                        fontWeight: '900',
                        fontSize: '0.65rem',
                      },
                      width: { xs: 160, md: 200 },
                      height: { xs: 140, md: 170 },
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any)}
                />
              </Box>
            )}

            {hasSynergy && (
              <Box sx={{ mt: 0.25 }}>
                <SynergyList
                  synergies={component.synergy}
                  color={color}
                  expanded={expanded}
                />
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
