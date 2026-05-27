'use client';

import {
  Avatar,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Link from 'next/link';

const CATEGORY_COLORS: Record<string, string> = {
  Blade: '#dc2626',
  Ratchet: '#fbbf24',
  Bit: '#22c55e',
  'Lock Chip': '#60a5fa',
  'Assist Blade': '#a855f7',
};

const CATEGORY_PALETTE_KEY: Record<string, string | undefined> = {
  Blade: 'primary',
  Ratchet: 'secondary',
};

export interface MetaPartPreview {
  name: string;
  score: number;
  category: string;
  imageUrl?: string | null;
  position_change: number | 'NEW';
}

interface MetaPreviewProps {
  parts: MetaPartPreview[];
}

function PositionBadge({ change }: { change: number | 'NEW' }) {
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
        sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#22c55e' }}
      >
        +{change}
      </Typography>
    );
  }

  if (change < 0) {
    return (
      <Typography
        component="span"
        sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444' }}
      >
        {change}
      </Typography>
    );
  }

  return null;
}

export function MetaPreview({ parts }: MetaPreviewProps) {
  const theme = useTheme();

  // Group parts by category, preserving order
  const grouped = new Map<string, MetaPartPreview[]>();
  for (const part of parts) {
    const existing = grouped.get(part.category) || [];
    existing.push(part);
    grouped.set(part.category, existing);
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2.5}>
        {Array.from(grouped.entries()).map(([category, categoryParts]) => {
          const paletteKey = CATEGORY_PALETTE_KEY[category];
          const color = paletteKey
            ? ((theme.palette as unknown as Record<string, { main: string }>)[
                paletteKey
              ]?.main ??
              CATEGORY_COLORS[category] ??
              '#6b7280')
            : CATEGORY_COLORS[category] || '#6b7280';
          const maxScore = Math.max(...categoryParts.map((p) => p.score), 1);

          return (
            <Box key={category}>
              {/* Category Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1,
                }}
              >
                <Box
                  sx={{
                    width: 3,
                    height: 18,
                    borderRadius: 2,
                    bgcolor: color,
                  }}
                />
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: '0.75rem',
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                  }}
                >
                  {category}
                </Typography>
              </Box>

              {/* Parts List */}
              <Stack spacing={0.75}>
                {categoryParts.map((part, i) => (
                  <Box
                    key={`${part.category}-${part.name}`}
                    component={Link}
                    href="/meta"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(color, 0.08),
                      bgcolor: alpha(color, 0.03),
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s ease-out',
                      '&:hover': {
                        bgcolor: alpha(color, 0.08),
                        borderColor: alpha(color, 0.2),
                        transform: 'translateX(2px)',
                      },
                    }}
                  >
                    {/* Rank Number */}
                    <Typography
                      sx={{
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        color:
                          i === 0
                            ? color
                            : alpha(theme.palette.text.primary, 0.3),
                        width: 16,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </Typography>

                    {/* Part Image or Fallback */}
                    {part.imageUrl ? (
                      <Avatar
                        src={part.imageUrl}
                        variant="rounded"
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'transparent',
                          flexShrink: 0,
                          '& img': { objectFit: 'contain' },
                        }}
                      >
                        {part.name.charAt(0)}
                      </Avatar>
                    ) : (
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          bgcolor: alpha(color, 0.1),
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            color: alpha(color, 0.6),
                          }}
                        >
                          {part.name.slice(0, 2).toUpperCase()}
                        </Typography>
                      </Box>
                    )}

                    {/* Name + Score Bar */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {part.name}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={maxScore > 0 ? (part.score / maxScore) * 100 : 0}
                        sx={{
                          mt: 0.5,
                          height: 3,
                          borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: color,
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>

                    {/* Score + Position Change */}
                    <Box
                      sx={{
                        textAlign: 'right',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 0.25,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          color,
                        }}
                      >
                        {part.score}
                      </Typography>
                      <PositionBadge change={part.position_change} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ mt: 2.5, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          sx={{ borderRadius: 2 }}
          component={Link}
          href="/meta"
        >
          Voir le Meta complet
        </Button>
      </Box>
    </Box>
  );
}
