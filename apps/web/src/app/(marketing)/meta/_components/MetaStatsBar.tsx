'use client';

import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { alpha, useTheme } from '@mui/material/styles';

import { type PeriodMetadata } from './types';

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: 'surface.main',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        px: { xs: 1.5, md: 2 },
        py: { xs: 1, md: 1.5 },
        textAlign: 'center',
        minWidth: 0,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.3),
          bgcolor: 'surface.high',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 900,
          letterSpacing: 1,
          fontSize: { xs: '0.55rem', md: '0.65rem' },
          color: 'primary.main',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        noWrap
        sx={{
          fontWeight: 900,
          mt: 0.25,
          fontSize: { xs: '0.75rem', md: '0.875rem' },
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function MetaStatsBar({
  metadata,
  scrapedAt,
}: {
  metadata: PeriodMetadata;
  scrapedAt: string;
}) {
  const formatDate = (dateStr: string, short = false) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: short ? 'short' : 'short',
        year: short ? undefined : 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const period =
    metadata.startDate && metadata.endDate
      ? `${formatDate(metadata.startDate, true)} — ${formatDate(metadata.endDate, true)}`
      : '—';

  return (
    <Grid container spacing={{ xs: 1, md: 1.5 }} sx={{ mt: { xs: 1, md: 2 } }}>
      {metadata.weekId && (
        <Grid size={{ xs: 4, sm: 4, md: 2.4 }}>
          <StatCard label="Semaine" value={metadata.weekId} />
        </Grid>
      )}
      <Grid size={{ xs: 8, sm: 4, md: 2.4 }}>
        <StatCard label="Période" value={period} />
      </Grid>
      {metadata.eventsScanned > 0 && (
        <Grid size={{ xs: 4, sm: 4, md: 2.4 }}>
          <StatCard
            label="Tournois"
            value={metadata.eventsScanned.toString()}
          />
        </Grid>
      )}
      {metadata.partsAnalyzed > 0 && (
        <Grid size={{ xs: 4, sm: 4, md: 2.4 }}>
          <StatCard
            label="Combos"
            value={metadata.partsAnalyzed.toLocaleString('fr-FR')}
          />
        </Grid>
      )}
      <Grid size={{ xs: 4, sm: 4, md: 2.4 }}>
        <StatCard label="Mis à jour" value={formatDate(scrapedAt, true)} />
      </Grid>
    </Grid>
  );
}
