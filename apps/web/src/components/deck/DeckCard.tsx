'use client';

/**
 * DeckCard - Display a deck with its 3 beys
 */

import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { StatRadar } from '@/components/ui/StatRadar';
import { type Part } from '@/lib/types';

export interface DeckBey {
  id: string;
  position: number;
  nickname: string | null;
  blade: Part | null;
  overBlade?: Part | null;
  ratchet: Part | null;
  bit: Part | null;
  lockChip?: Part | null;
  assistBlade?: Part | null;
}

export interface Deck {
  id: string;
  name: string;
  isActive: boolean;
  beys: DeckBey[];
  createdAt: string;
  updatedAt: string;
}

interface DeckCardProps {
  deck: Deck;
  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
}

function parseStat(stat: string | number | null | undefined): number {
  if (typeof stat === 'number') return stat;
  if (!stat) return 0;
  const match = String(stat).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

function calculateStats(bey: DeckBey) {
  const parts = [
    bey.blade,
    bey.overBlade,
    bey.ratchet,
    bey.bit,
    bey.lockChip,
    bey.assistBlade,
  ].filter(Boolean) as Part[];
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

function BeyLine({ bey }: { bey: DeckBey }) {
  const partsAvailable = bey.blade && bey.ratchet && bey.bit;
  const stats = calculateStats(bey);
  const isCX = bey.blade?.system === 'CX';

  return (
    <Box
      sx={{
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 1.5 }}>
        <Avatar
          src={bey.blade?.imageUrl || undefined}
          variant="rounded"
          sx={{
            width: 48,
            height: 48,
            bgcolor: 'background.paper',
            border: '2px solid',
            borderColor: isCX ? '#8b5cf6' : 'divider',
            boxShadow: isCX ? '0 0 10px rgba(139,92,246,0.2)' : 'none',
          }}
        >
          {bey.position}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{
                fontWeight: '900',
              }}
            >
              {bey.nickname ||
                (partsAvailable ? bey.blade?.name : 'Bey incomplet')}
            </Typography>
            {isCX && (
              <Chip
                label="CX"
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: '900',
                  bgcolor: 'rgba(139,92,246,0.1)',
                  color: '#8b5cf6',
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mt: 0.25,
            }}
          >
            {partsAvailable
              ? `${bey.ratchet?.name} • ${bey.bit?.name}`
              : 'Pièces manquantes'}
          </Typography>
        </Box>
      </Box>
      {partsAvailable && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: (theme) => alpha(theme.palette.divider, 0.03),
            p: 1.5,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <StatRadar stats={stats} size={80} />
          </Box>
          <Box
            sx={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 0.5,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: '900',
                  color: 'text.disabled',
                }}
              >
                ATK
              </Typography>
              <Typography
                sx={{ fontSize: '0.6rem', fontWeight: '900', color: '#ef4444' }}
              >
                {stats.attack}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: '900',
                  color: 'text.disabled',
                }}
              >
                DEF
              </Typography>
              <Typography
                sx={{ fontSize: '0.6rem', fontWeight: '900', color: '#3b82f6' }}
              >
                {stats.defense}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: '900',
                  color: 'text.disabled',
                }}
              >
                END
              </Typography>
              <Typography
                sx={{ fontSize: '0.6rem', fontWeight: '900', color: '#22c55e' }}
              >
                {stats.stamina}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: '900',
                  color: 'text.disabled',
                }}
              >
                POIDS
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: '900' }}>
                {stats.weight.toFixed(1)}g
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function DeckCard({
  deck,
  onEdit,
  onDelete,
  onActivate,
}: DeckCardProps) {
  const theme = useTheme();

  const handleExport = async () => {
    const el = document.getElementById(`deck-card-${deck.id}`);
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, {
        backgroundColor: '#111',
        useCORS: true,
        allowTaint: true,
        scale: 2, // Higher quality
      });
      const link = document.createElement('a');
      link.download = `deck-${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const sortedBeys = deck?.beys
    ? [...deck.beys].sort((a, b) => a.position - b.position)
    : [];

  return (
    <Card
      id={`deck-card-${deck.id}`}
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        border: '1px solid',
        borderColor: deck.isActive ? 'error.main' : 'divider',
        background: deck.isActive
          ? `linear-gradient(180deg, ${alpha(
              theme.palette.error.main,
              0.03,
            )} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`
          : theme.palette.background.paper,
        transition: 'all 0.25s ease-out',
        '&:hover': {
          borderColor: 'error.main',
          boxShadow: `0 12px 32px ${alpha(theme.palette.error.main, 0.1)}`,
          transform: 'translateY(-4px)',
        },
      }}
    >
      <CardContent sx={{ flex: 1, p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: '900',
                letterSpacing: '-0.01em',
              }}
            >
              {deck.name}
            </Typography>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
            >
              {deck.isActive ? (
                <Chip
                  size="small"
                  label="ACTIF"
                  color="error"
                  icon={<StarIcon sx={{ fontSize: '0.9rem !important' }} />}
                  sx={{ height: 20, fontWeight: '900', fontSize: '0.65rem' }}
                />
              ) : (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', fontWeight: 'bold' }}
                >
                  MAJ {new Date(deck.updatedAt).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={handleExport}
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.05),
                color: 'info.main',
                borderRadius: 1.5,
              }}
            >
              <DownloadIcon sx={{ fontSize: 18 }} />
            </IconButton>
            {onEdit && (
              <IconButton
                size="small"
                onClick={onEdit}
                sx={{
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  borderRadius: 1.5,
                }}
              >
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                size="small"
                onClick={onDelete}
                color="error"
                sx={{
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  borderRadius: 1.5,
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Stack>
        </Box>

        <Divider sx={{ mb: 1, borderStyle: 'dashed', opacity: 0.5 }} />

        <Box>
          {sortedBeys.map((bey) => (
            <BeyLine key={bey.id} bey={bey} />
          ))}
        </Box>
      </CardContent>
      {!deck.isActive && onActivate && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<StarOutlineIcon />}
            onClick={onActivate}
            fullWidth
            sx={{
              borderRadius: 2.5,
              fontWeight: '900',
              textTransform: 'none',
              fontSize: '0.8rem',
              py: 1,
            }}
          >
            Définir comme actif
          </Button>
        </Box>
      )}
    </Card>
  );
}
