'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useState } from 'react';
import { type Part } from '@/lib/types';
import { BattleArena } from './BattleArena';

const TYPE_COLORS: Record<string, string> = {
  ATTACK: '#ef4444',
  DEFENSE: '#3b82f6',
  STAMINA: '#22c55e',
  BALANCE: '#a855f7',
};

function parseStat(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

interface BeyCombo {
  blade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
}

function getComboStats(combo: BeyCombo) {
  const parts = [combo.blade, combo.ratchet, combo.bit].filter(
    Boolean,
  ) as Part[];
  return {
    attack: parts.reduce((s, p) => s + parseStat(p.attack), 0),
    defense: parts.reduce((s, p) => s + parseStat(p.defense), 0),
    stamina: parts.reduce((s, p) => s + parseStat(p.stamina), 0),
    dash: parts.reduce((s, p) => s + parseStat(p.dash), 0),
    burst: parts.reduce((s, p) => s + parseStat(p.burst), 0),
    type: combo.blade?.beyType || 'BALANCE',
  };
}

function PartSelector({
  label,
  parts,
  value,
  onChange,
}: {
  label: string;
  parts: Part[];
  value: Part | null;
  onChange: (part: Part | null) => void;
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: '900',
          color: 'text.secondary',
          mb: 0.5,
          display: 'block',
        }}
      >
        {label}
      </Typography>
      <Select
        size="small"
        fullWidth
        value={value?.id || ''}
        onChange={(e) => {
          const part = parts.find((p) => p.id === e.target.value) || null;
          onChange(part);
        }}
        sx={{
          borderRadius: 2,
          fontWeight: 700,
          fontSize: '0.85rem',
          '& .MuiSelect-select': { py: 1 },
        }}
        displayEmpty
      >
        <MenuItem value="">
          <em>Sélectionner...</em>
        </MenuItem>
        {parts.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

function ComboCard({
  title,
  combo,
  blades,
  ratchets,
  bits,
  onUpdate,
  color,
}: {
  title: string;
  combo: BeyCombo;
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
  onUpdate: (combo: BeyCombo) => void;
  color: string;
}) {
  const stats = getComboStats(combo);
  const isComplete = combo.blade && combo.ratchet && combo.bit;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        border: '2px solid',
        borderColor: alpha(color, 0.3),
        bgcolor: alpha(color, 0.03),
        flex: 1,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: '900',
            color,
            mb: 2,
          }}
        >
          {title}
        </Typography>

        <PartSelector
          label="Blade"
          parts={blades}
          value={combo.blade}
          onChange={(p) => onUpdate({ ...combo, blade: p })}
        />
        <PartSelector
          label="Ratchet"
          parts={ratchets}
          value={combo.ratchet}
          onChange={(p) => onUpdate({ ...combo, ratchet: p })}
        />
        <PartSelector
          label="Bit"
          parts={bits}
          value={combo.bit}
          onChange={(p) => onUpdate({ ...combo, bit: p })}
        />

        {isComplete && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {combo.blade?.beyType && (
              <Chip
                label={combo.blade.beyType}
                size="small"
                sx={{
                  fontWeight: 900,
                  bgcolor: TYPE_COLORS[combo.blade.beyType] || '#888',
                  color: '#fff',
                  alignSelf: 'flex-start',
                }}
              />
            )}
            {[
              { label: 'ATK', value: stats.attack, color: '#ef4444' },
              { label: 'DEF', value: stats.defense, color: '#3b82f6' },
              { label: 'END', value: stats.stamina, color: '#22c55e' },
              { label: 'DSH', value: stats.dash, color: '#fbbf24' },
            ].map((s) => (
              <Box key={s.label}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.3,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                    }}
                  >
                    {s.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: '900',
                      color: s.color,
                      fontSize: '0.7rem',
                    }}
                  >
                    {s.value}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(s.value / 3, 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(s.color, 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: s.color,
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

interface CombatTabProps {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
}

// AI difficulty presets
const _AI_STYLES = [
  { label: 'Débutant', value: 'easy', color: '#22c55e', strategy: 'random' },
  {
    label: 'Intermédiaire',
    value: 'medium',
    color: '#f59e0b',
    strategy: 'balanced',
  },
  {
    label: 'Expert',
    value: 'hard',
    color: '#ef4444',
    strategy: 'optimized',
  },
] as const;

type BattleMode = 'pvp' | 'ai';
type AIDifficulty = 'easy' | 'medium' | 'hard';

function buildAICombo(
  blades: Part[],
  ratchets: Part[],
  bits: Part[],
  difficulty: AIDifficulty,
): BeyCombo {
  const randPart = (parts: Part[]) =>
    parts[Math.floor(Math.random() * parts.length)] || null;

  if (difficulty === 'easy') {
    return {
      blade: randPart(blades),
      ratchet: randPart(ratchets),
      bit: randPart(bits),
    };
  }

  // Medium/Hard: pick parts with better stats
  const sortByStatTotal = (parts: Part[]) =>
    [...parts].sort((a, b) => {
      const totalA =
        parseStat(a.attack) + parseStat(a.defense) + parseStat(a.stamina);
      const totalB =
        parseStat(b.attack) + parseStat(b.defense) + parseStat(b.stamina);
      return totalB - totalA;
    });

  const sortedBlades = sortByStatTotal(blades);
  const sortedRatchets = sortByStatTotal(ratchets);
  const sortedBits = sortByStatTotal(bits);

  if (difficulty === 'hard') {
    // Pick from top 5 with slight randomness
    const topN = 5;
    return {
      blade:
        sortedBlades[
          Math.floor(Math.random() * Math.min(topN, sortedBlades.length))
        ] || null,
      ratchet:
        sortedRatchets[
          Math.floor(Math.random() * Math.min(topN, sortedRatchets.length))
        ] || null,
      bit:
        sortedBits[
          Math.floor(Math.random() * Math.min(topN, sortedBits.length))
        ] || null,
    };
  }

  // Medium: pick from top 30%
  const topPct = 0.3;
  return {
    blade:
      sortedBlades[
        Math.floor(
          Math.random() * Math.max(1, Math.floor(sortedBlades.length * topPct)),
        )
      ] || null,
    ratchet:
      sortedRatchets[
        Math.floor(
          Math.random() *
            Math.max(1, Math.floor(sortedRatchets.length * topPct)),
        )
      ] || null,
    bit:
      sortedBits[
        Math.floor(
          Math.random() * Math.max(1, Math.floor(sortedBits.length * topPct)),
        )
      ] || null,
  };
}

export function CombatTab({ blades, ratchets, bits }: CombatTabProps) {
  const [mode, _setMode] = useState<BattleMode>('ai');
  const [aiDifficulty, _setAiDifficulty] = useState<AIDifficulty>('medium');
  const [p1, setP1] = useState<BeyCombo>({
    blade: null,
    ratchet: null,
    bit: null,
  });
  const [p2, setP2] = useState<BeyCombo>({
    blade: null,
    ratchet: null,
    bit: null,
  });
  const [_inArena, setInArena] = useState(false);
  const [_arenaP2, setArenaP2] = useState<BeyCombo>({
    blade: null,
    ratchet: null,
    bit: null,
  });
  const [_aiName, setAiName] = useState('IA');

  const p1Ready = p1.blade && p1.ratchet && p1.bit;
  const p2Ready = p2.blade && p2.ratchet && p2.bit;
  const canBattle = mode === 'ai' ? p1Ready : p1Ready && p2Ready;

  const handleBattle = useCallback(() => {
    if (!canBattle) return;

    let opponent = p2;

    if (mode === 'ai') {
      opponent = buildAICombo(blades, ratchets, bits, aiDifficulty);
      setP2(opponent);
      const names = [
        'VALT',
        'AIGA',
        'DRUM',
        'HIKARU',
        'BIRD',
        'XANDER',
        'SISCO',
        'FREE',
        'LUI',
        'LAIN',
        'RASHAD',
        'BEL',
      ];
      setAiName(names[Math.floor(Math.random() * names.length)] || 'IA');
    }

    setArenaP2(opponent);
    setInArena(true);
  }, [canBattle, p2, mode, aiDifficulty, blades, ratchets, bits]);

  const randomize = useCallback(() => {
    const randPart = (parts: Part[]) =>
      parts[Math.floor(Math.random() * parts.length)] || null;
    setP1({
      blade: randPart(blades),
      ratchet: randPart(ratchets),
      bit: randPart(bits),
    });
    if (mode === 'pvp') {
      setP2({
        blade: randPart(blades),
        ratchet: randPart(ratchets),
        bit: randPart(bits),
      });
    }
  }, [blades, ratchets, bits, mode]);

  // Convert combo to BattleArena stats
  const toBeyStats = (combo: BeyCombo, fallbackName: string) => {
    const stats = getComboStats(combo);
    return {
      name: combo.blade?.name || fallbackName,
      attack: stats.attack,
      defense: stats.defense,
      stamina: stats.stamina,
      dash: stats.dash,
      burst: stats.burst,
      weight:
        (combo.blade?.weight || 30) +
        (combo.ratchet?.weight || 7) +
        (combo.bit?.weight || 2),
      type: stats.type,
      color: TYPE_COLORS[stats.type] || '#888',
      imageUrl: combo.blade?.imageUrl,
    };
  };

  // If in arena, render BattleArena
  if (_inArena && p1.blade && (mode === 'ai' || _arenaP2.blade)) {
    const opponent = mode === 'ai' ? _arenaP2 : p2;
    return (
      <BattleArena
        p1Stats={toBeyStats(p1, 'Joueur 1')}
        p2Stats={toBeyStats(opponent, mode === 'ai' ? _aiName : 'Joueur 2')}
        mode={mode}
        aiDifficulty={aiDifficulty}
        onBack={() => {
          setInArena(false);
        }}
      />
    );
  }

  return (
    <Box>
      {/* Mode selector + title */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: '900',
          }}
        >
          Simulateur de Combat
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Mode toggle */}
          <Chip
            label="vs IA"
            clickable
            onClick={() => {
              _setMode('ai');
            }}
            sx={{
              fontWeight: 900,
              fontSize: '0.75rem',
              borderRadius: 2,
              bgcolor: mode === 'ai' ? 'primary.main' : 'transparent',
              color: mode === 'ai' ? '#fff' : 'text.secondary',
              border: '1px solid',
              borderColor: mode === 'ai' ? 'primary.main' : 'divider',
            }}
          />
          <Chip
            label="vs Joueur"
            clickable
            onClick={() => {
              _setMode('pvp');
            }}
            sx={{
              fontWeight: 900,
              fontSize: '0.75rem',
              borderRadius: 2,
              bgcolor: mode === 'pvp' ? '#3b82f6' : 'transparent',
              color: mode === 'pvp' ? '#fff' : 'text.secondary',
              border: '1px solid',
              borderColor: mode === 'pvp' ? '#3b82f6' : 'divider',
            }}
          />

          {/* AI difficulty (only in AI mode) */}
          {mode === 'ai' &&
            _AI_STYLES.map((ai) => (
              <Chip
                key={ai.value}
                label={ai.label}
                clickable
                onClick={() => _setAiDifficulty(ai.value)}
                size="small"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.7rem',
                  borderRadius: 2,
                  bgcolor: aiDifficulty === ai.value ? ai.color : 'transparent',
                  color: aiDifficulty === ai.value ? '#fff' : 'text.disabled',
                  border: '1px solid',
                  borderColor:
                    aiDifficulty === ai.value ? ai.color : alpha(ai.color, 0.2),
                }}
              />
            ))}

          <Button
            size="small"
            onClick={randomize}
            sx={{ fontWeight: 900, borderRadius: 2, ml: 'auto' }}
          >
            Aléatoire
          </Button>
        </Box>
      </Box>
      {/* Combo selectors */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: mode === 'pvp' ? '1fr auto 1fr' : '1fr auto 1fr',
          },
          gap: { xs: 1, md: 3 },
          mb: 4,
          alignItems: 'start',
        }}
      >
        <ComboCard
          title="Mon Beyblade"
          combo={p1}
          blades={blades}
          ratchets={ratchets}
          bits={bits}
          onUpdate={setP1}
          color="#ef4444"
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 1, md: 0 },
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: '900',
              color: 'text.disabled',
              fontSize: { xs: '1.5rem', md: '2rem' },
            }}
          >
            VS
          </Typography>
        </Box>

        {mode === 'pvp' ? (
          <ComboCard
            title="Joueur 2"
            combo={p2}
            blades={blades}
            ratchets={ratchets}
            bits={bits}
            onUpdate={setP2}
            color="#3b82f6"
          />
        ) : (
          <Card
            elevation={0}
            sx={{
              borderRadius: 4,
              border: '2px dashed',
              borderColor: alpha('#3b82f6', 0.3),
              bgcolor: alpha('#3b82f6', 0.03),
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              gap: 1.5,
              p: 3,
            }}
          >
            <Box
              component="img"
              src="/bbx-icons/btn-battle.webp"
              sx={{
                width: 48,
                height: 48,
                opacity: 0.5,
                filter: 'grayscale(0.5)',
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: '900',
                color: '#3b82f6',
              }}
            >
              {_aiName} (IA)
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                textAlign: 'center',
              }}
            >
              L'IA choisira son Beyblade au lancement du combat
            </Typography>
            <Chip
              label={
                _AI_STYLES.find((a) => a.value === aiDifficulty)?.label ||
                'Medium'
              }
              size="small"
              sx={{
                fontWeight: 900,
                fontSize: '0.7rem',
                bgcolor: alpha(
                  _AI_STYLES.find((a) => a.value === aiDifficulty)?.color ||
                    '#f59e0b',
                  0.15,
                ),
                color:
                  _AI_STYLES.find((a) => a.value === aiDifficulty)?.color ||
                  '#f59e0b',
              }}
            />
          </Card>
        )}
      </Box>
      {/* Battle button */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Button
          variant="contained"
          size="large"
          disabled={!canBattle}
          onClick={handleBattle}
          sx={{
            fontWeight: 900,
            borderRadius: 3,
            px: 6,
            py: 2,
            fontSize: '1.1rem',
            bgcolor: 'primary.main',
            letterSpacing: 2,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          LANCER LE COMBAT
        </Button>
      </Box>
    </Box>
  );
}
