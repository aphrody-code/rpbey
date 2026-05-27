'use client';

import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import type { LogEntry } from './types';

export function ActivityLogPanel({ log }: { log: LogEntry[] }) {
  const theme = useTheme();
  if (log.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}
      >
        Aucune activité récente.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {log.slice(0, 30).map((entry, i) => (
        <Box
          key={`${entry.timestamp}-${i}`}
          sx={{
            p: 2.5,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.action.hover, 0.4),
            borderLeft: '4px solid',
            borderColor: entry.type?.includes('match')
              ? 'primary.main'
              : 'divider',
          }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 900,
                textTransform: 'uppercase',
                color: 'primary.main',
                letterSpacing: 1,
              }}
            >
              {entry.type}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 700 }}
            >
              {new Date(entry.timestamp).toLocaleTimeString('fr-FR')}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, lineHeight: 1.5 }}
          >
            {entry.message}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
