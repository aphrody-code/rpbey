'use client';

import { Box, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';

const SYSTEMS = ['BX', 'UX', 'CX'];
const BEY_TYPES = [
  { value: 'ATTACK', label: 'ATK', color: '#ef4444' },
  { value: 'DEFENSE', label: 'DEF', color: '#3b82f6' },
  { value: 'STAMINA', label: 'END', color: '#22c55e' },
  { value: 'BALANCE', label: 'BAL', color: '#a855f7' },
];
const SPINS = [
  { value: 'Right', label: 'Droite' },
  { value: 'Left', label: 'Gauche' },
];

interface CatalogFiltersProps {
  systems: string[];
  onSystemsChange: (systems: string[]) => void;
  beyTypes: string[];
  onBeyTypesChange: (types: string[]) => void;
  spin: string;
  onSpinChange: (spin: string) => void;
}

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
}

export function CatalogFilters({
  systems,
  onSystemsChange,
  beyTypes,
  onBeyTypesChange,
  spin,
  onSpinChange,
}: CatalogFiltersProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {SYSTEMS.map((s) => (
        <Chip
          key={s}
          label={s}
          size="small"
          variant={systems.includes(s) ? 'filled' : 'outlined'}
          onClick={() => onSystemsChange(toggleItem(systems, s))}
          sx={{
            fontWeight: 'bold',
            fontSize: '0.7rem',
            height: 28,
            borderRadius: 1.5,
            ...(systems.includes(s) && { bgcolor: '#333', color: '#fff' }),
          }}
        />
      ))}

      <Box
        sx={{
          width: 1,
          height: 28,
          borderRight: '1px solid',
          borderColor: 'divider',
          mx: 0.25,
        }}
      />

      {BEY_TYPES.map((bt) => (
        <Chip
          key={bt.value}
          label={bt.label}
          size="small"
          variant={beyTypes.includes(bt.value) ? 'filled' : 'outlined'}
          onClick={() => onBeyTypesChange(toggleItem(beyTypes, bt.value))}
          sx={{
            fontWeight: 'bold',
            fontSize: '0.7rem',
            height: 28,
            borderRadius: 1.5,
            ...(beyTypes.includes(bt.value) && {
              bgcolor: bt.color,
              color: '#fff',
              borderColor: bt.color,
            }),
            ...(!beyTypes.includes(bt.value) && {
              borderColor: alpha(bt.color, 0.3),
              color: bt.color,
              '&:hover': { bgcolor: alpha(bt.color, 0.08) },
            }),
          }}
        />
      ))}

      <Box
        sx={{
          width: 1,
          height: 28,
          borderRight: '1px solid',
          borderColor: 'divider',
          mx: 0.25,
        }}
      />

      {SPINS.map((sp) => (
        <Chip
          key={sp.value}
          label={sp.label}
          size="small"
          variant={spin === sp.value ? 'filled' : 'outlined'}
          onClick={() => onSpinChange(spin === sp.value ? 'ALL' : sp.value)}
          sx={{
            fontWeight: 'bold',
            fontSize: '0.7rem',
            height: 28,
            borderRadius: 1.5,
            ...(spin === sp.value && { bgcolor: '#555', color: '#fff' }),
          }}
        />
      ))}
    </Box>
  );
}
