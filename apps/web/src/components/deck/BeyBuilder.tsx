'use client';

/**
 * BeyBuilder - Component to build a single Bey (Blade + Ratchet + Bit + optional Lock Chip + Assist Blade)
 */

import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { StatRadar } from '@/components/ui/StatRadar';
import { type Part } from '@/lib/types';
import { PartSelector } from './PartSelector';

export interface BeyData {
  blade: Part | null;
  overBlade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
  lockChip: Part | null;
  assistBlade: Part | null;
  nickname: string;
}

interface BeyBuilderProps {
  position: number;
  data: BeyData;
  onChange: (data: BeyData) => void;
  usedPartIds: string[];
  disabled?: boolean;
}

function parseStat(stat: string | number | null | undefined): number {
  if (typeof stat === 'number') return stat;
  if (!stat) return 0;
  const match = String(stat).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

function calculateStats(
  blade: Part | null,
  overBlade: Part | null,
  ratchet: Part | null,
  bit: Part | null,
  lockChip: Part | null,
  assistBlade: Part | null,
): {
  attack: number;
  defense: number;
  stamina: number;
  dash: number;
  burst: number;
  weight: number;
} {
  const parts = [blade, overBlade, ratchet, bit, lockChip, assistBlade].filter(
    Boolean,
  ) as Part[];

  return parts.reduce(
    (acc, part) => ({
      attack: acc.attack + parseStat(part.attack),
      defense: acc.defense + parseStat(part.defense),
      stamina: acc.stamina + parseStat(part.stamina),
      dash: acc.dash + parseStat(part.dash),
      burst: acc.burst + parseStat(part.burst),
      weight: acc.weight + (part.weight || 0),
    }),
    { attack: 0, defense: 0, stamina: 0, dash: 0, burst: 0, weight: 0 },
  );
}

export function BeyBuilder({
  position,
  data,
  onChange,
  usedPartIds,
  disabled = false,
}: BeyBuilderProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const stats = calculateStats(
    data.blade,
    data.overBlade,
    data.ratchet,
    data.bit,
    data.lockChip,
    data.assistBlade,
  );
  const isCX = data.blade?.system === 'CX';
  const isComplete =
    data.blade &&
    data.ratchet &&
    data.bit &&
    (!isCX || (data.lockChip && data.assistBlade));

  // Filter out current bey's parts from usedPartIds
  const currentPartIds = [
    data.blade?.id,
    data.overBlade?.id,
    data.ratchet?.id,
    data.bit?.id,
    data.lockChip?.id,
    data.assistBlade?.id,
  ].filter(Boolean) as string[];
  const otherUsedPartIds = usedPartIds.filter(
    (id) => !currentPartIds.includes(id),
  );

  return (
    <Box
      sx={{
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label="SURNOM DU BEY"
          value={data.nickname}
          onChange={(e) => onChange({ ...data, nickname: e.target.value })}
          disabled={disabled}
          size="small"
          placeholder={`Bey #${position}`}
          fullWidth
          variant="filled"
          sx={{
            flexGrow: 1,
            '& .MuiInputBase-root': {
              bgcolor: '#222',
              color: 'white',
              borderRadius: 1,
            },
            '& .MuiInputLabel-root': { color: '#888' },
          }}
        />

        <Chip
          label={isComplete ? 'PRÊT' : 'INCOMPLET'}
          color={isComplete ? 'success' : 'error'}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 'bold' }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : isCX
              ? 'repeat(6, 1fr)'
              : '1fr 1fr 1fr',
          gap: 2,
        }}
      >
        <PartSelector
          type="BLADE"
          label="LAME (CORE)"
          value={data.blade}
          onChange={(blade) => {
            const newData = { ...data, blade };
            // Clear CX parts if switching away from CX
            if (!blade || blade.system !== 'CX') {
              newData.overBlade = null;
              newData.lockChip = null;
              newData.assistBlade = null;
            }
            onChange(newData);
          }}
          disabled={disabled}
          disabledPartIds={otherUsedPartIds}
          dark={true}
        />

        {isCX && (
          <>
            <PartSelector
              type="OVER_BLADE"
              label="OVER BLADE"
              value={data.overBlade}
              onChange={(overBlade) => onChange({ ...data, overBlade })}
              disabled={disabled}
              disabledPartIds={otherUsedPartIds}
              dark={true}
            />

            <PartSelector
              type="LOCK_CHIP"
              label="LOCK CHIP"
              value={data.lockChip}
              onChange={(lockChip) => onChange({ ...data, lockChip })}
              disabled={disabled}
              disabledPartIds={otherUsedPartIds}
              dark={true}
            />

            <PartSelector
              type="ASSIST_BLADE"
              label="ASSIST BLADE"
              value={data.assistBlade}
              onChange={(assistBlade) => onChange({ ...data, assistBlade })}
              disabled={disabled}
              disabledPartIds={otherUsedPartIds}
              dark={true}
            />
          </>
        )}

        <PartSelector
          type="RATCHET"
          label="RATCHET"
          value={data.ratchet}
          onChange={(ratchet) => onChange({ ...data, ratchet })}
          disabled={disabled}
          disabledPartIds={otherUsedPartIds}
          dark={true}
        />

        <PartSelector
          type="BIT"
          label="POINTE (BIT)"
          value={data.bit}
          onChange={(bit) => onChange({ ...data, bit })}
          disabled={disabled}
          disabledPartIds={otherUsedPartIds}
          dark={true}
        />
      </Box>

      {/* Stats Radar Chart */}
      <Box
        sx={{
          mt: 1,
          p: { xs: 2, md: 3 },
          bgcolor: '#080808',
          borderRadius: 4,
          border: '1px solid #222',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Box
            sx={{
              width: { xs: '100%', sm: '40%' },
              height: 200,
              display: 'flex',
              justifyContent: 'center',
              filter: 'drop-shadow(0 0 15px rgba(var(--rpb-primary-rgb), 0.2))',
            }}
          >
            <StatRadar stats={stats} size={200} />
          </Box>

          <Box
            sx={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                mb: 1,
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: '#666', fontWeight: '900', letterSpacing: 2 }}
                >
                  POIDS TOTAL
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ color: 'white', fontWeight: '900', lineHeight: 1 }}
                >
                  {stats.weight.toFixed(1)}
                  <span
                    style={{ fontSize: '1rem', color: '#444', marginLeft: 4 }}
                  >
                    g
                  </span>
                </Typography>
              </Box>
              <Chip
                label={isComplete ? 'CONFIG VALIDÉE' : 'CONFIG INCOMPLÈTE'}
                color={isComplete ? 'success' : 'default'}
                size="small"
                sx={{
                  fontWeight: '900',
                  borderRadius: 1.5,
                  fontSize: '0.65rem',
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <StatBar label="ATTAQUE" value={stats.attack} color="#ef4444" />
              <StatBar label="DÉFENSE" value={stats.defense} color="#3b82f6" />
              <StatBar
                label="ENDURANCE"
                value={stats.stamina}
                color="#22c55e"
              />
              <StatBar
                label="DASH"
                value={stats.dash}
                color="var(--rpb-secondary)"
                colorRgb="var(--rpb-secondary-rgb)"
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function StatBar({
  label,
  value,
  color,
  colorRgb,
}: {
  label: string;
  value: number;
  color: string;
  colorRgb?: string;
}) {
  // For CSS variable colors, use rgba() with the rgb variable for the glow
  // For hex colors, append alpha hex directly
  const glowShadow = colorRgb
    ? `0 0 12px rgba(${colorRgb}, 0.4)`
    : `0 0 12px ${color}66`;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: '900',
            color: '#666',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: '900', color: color }}
        >
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          height: 6,
          width: '100%',
          bgcolor: '#222',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${Math.min(value, 100)}%`,
            bgcolor: color,
            boxShadow: glowShadow,
            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </Box>
    </Box>
  );
}
