import { TrendingDown, TrendingUp } from '@mui/icons-material';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import type React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: number; // Percentage change
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  trend,
  trendLabel,
  icon,
  color = 'primary',
}) => {
  const theme = useTheme();
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        height: '100%',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: 'text.secondary',
            fontWeight: 'medium',
          }}
        >
          {title}
        </Typography>
        {icon && (
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.2,
            }}
          >
            {/* We clone the icon to apply color if needed, or just wrap it */}
            <Box sx={{ color: `${color}.main`, opacity: 1 }}>{icon}</Box>
          </Box>
        )}
      </Box>
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 'bold',
            mb: 1,
          }}
        >
          {value}
        </Typography>

        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: isPositive
                  ? 'success.main'
                  : isNegative
                    ? 'error.main'
                    : 'text.secondary',
                bgcolor: isPositive
                  ? 'success.lighter'
                  : isNegative
                    ? 'error.lighter'
                    : 'action.hover',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
              }}
            >
              {isPositive && <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />}
              {isNegative && <TrendingDown fontSize="small" sx={{ mr: 0.5 }} />}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                {trend > 0 ? '+' : ''}
                {trend}%
              </Typography>
            </Box>
            {trendLabel && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {trendLabel}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};
