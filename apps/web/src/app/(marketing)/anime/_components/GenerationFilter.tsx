'use client';

import { Box, Chip } from '@mui/material';

const GENERATIONS = [
  { value: '', label: 'Toutes', color: 'var(--rpb-primary)' },
  { value: 'ORIGINAL', label: 'Original', color: '#1565C0' },
  { value: 'METAL', label: 'Metal', color: '#E65100' },
  { value: 'BURST', label: 'Burst', color: '#C62828' },
  { value: 'X', label: 'X', color: '#7B1FA2' },
] as const;

interface GenerationFilterProps {
  selected: string;
  onChange: (gen: string) => void;
}

export function GenerationFilter({
  selected,
  onChange,
}: GenerationFilterProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        px: { xs: 2, md: 4 },
        mb: 3,
        flexWrap: 'wrap',
      }}
    >
      {GENERATIONS.map((gen) => (
        <Chip
          key={gen.value}
          label={gen.label}
          onClick={() => onChange(gen.value)}
          sx={{
            fontWeight: 700,
            borderRadius: 2,
            bgcolor:
              selected === gen.value ? gen.color : 'rgba(255,255,255,0.08)',
            color: selected === gen.value ? 'white' : 'text.secondary',
            '&:hover': {
              bgcolor:
                selected === gen.value ? gen.color : 'rgba(255,255,255,0.15)',
            },
          }}
        />
      ))}
    </Box>
  );
}
