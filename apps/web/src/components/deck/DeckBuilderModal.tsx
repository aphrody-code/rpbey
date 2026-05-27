'use client';

/**
 * DeckBuilderModal - Modal for creating/editing decks
 */

import { useMediaQuery, useTheme } from '@mui/material';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { validateDeck } from '@/lib/tournament-logic';
import { BeyBuilder, type BeyData } from './BeyBuilder';
import { type Deck } from './DeckCard';

interface DeckBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  deck?: Deck | null;
}

const emptyBey: BeyData = {
  blade: null,
  overBlade: null,
  ratchet: null,
  bit: null,
  lockChip: null,
  assistBlade: null,
  nickname: '',
};

export function DeckBuilderModal({
  open,
  onClose,
  onSave,
  deck,
}: DeckBuilderModalProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [beys, setBeys] = useState<[BeyData, BeyData, BeyData]>([
    { ...emptyBey },
    { ...emptyBey },
    { ...emptyBey },
  ]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Reset form when modal opens/closes or deck changes
  useEffect(() => {
    if (open) {
      if (deck) {
        setName(deck.name);
        setIsActive(deck.isActive);
        const sortedBeys = [...deck.beys].sort(
          (a, b) => a.position - b.position,
        );
        setBeys([
          {
            blade: sortedBeys[0]?.blade ?? null,
            overBlade:
              (sortedBeys[0] as { overBlade?: BeyData['overBlade'] })
                ?.overBlade ?? null,
            ratchet: sortedBeys[0]?.ratchet ?? null,
            bit: sortedBeys[0]?.bit ?? null,
            lockChip:
              (sortedBeys[0] as { lockChip?: BeyData['lockChip'] })?.lockChip ??
              null,
            assistBlade:
              (sortedBeys[0] as { assistBlade?: BeyData['assistBlade'] })
                ?.assistBlade ?? null,
            nickname: sortedBeys[0]?.nickname ?? '',
          },
          {
            blade: sortedBeys[1]?.blade ?? null,
            overBlade:
              (sortedBeys[1] as { overBlade?: BeyData['overBlade'] })
                ?.overBlade ?? null,
            ratchet: sortedBeys[1]?.ratchet ?? null,
            bit: sortedBeys[1]?.bit ?? null,
            lockChip:
              (sortedBeys[1] as { lockChip?: BeyData['lockChip'] })?.lockChip ??
              null,
            assistBlade:
              (sortedBeys[1] as { assistBlade?: BeyData['assistBlade'] })
                ?.assistBlade ?? null,
            nickname: sortedBeys[1]?.nickname ?? '',
          },
          {
            blade: sortedBeys[2]?.blade ?? null,
            overBlade:
              (sortedBeys[2] as { overBlade?: BeyData['overBlade'] })
                ?.overBlade ?? null,
            ratchet: sortedBeys[2]?.ratchet ?? null,
            bit: sortedBeys[2]?.bit ?? null,
            lockChip:
              (sortedBeys[2] as { lockChip?: BeyData['lockChip'] })?.lockChip ??
              null,
            assistBlade:
              (sortedBeys[2] as { assistBlade?: BeyData['assistBlade'] })
                ?.assistBlade ?? null,
            nickname: sortedBeys[2]?.nickname ?? '',
          },
        ]);
      } else {
        setName('');
        setIsActive(false);
        setBeys([{ ...emptyBey }, { ...emptyBey }, { ...emptyBey }]);
      }
      setSelectedIdx(0);
      setError(null);
      setValidationErrors([]);
    }
  }, [open, deck]);

  // Real-time validation
  useEffect(() => {
    const hasParts = beys.some((b) => b.blade || b.ratchet || b.bit);
    if (!hasParts) {
      setValidationErrors([]);
      return;
    }

    const isFullDeck = beys.every((b) => {
      const baseComplete = b.blade && b.ratchet && b.bit;
      if (!baseComplete) return false;
      if (b.blade?.system === 'CX') return !!b.lockChip && !!b.assistBlade;
      return true;
    });

    if (isFullDeck) {
      const deckToValidate = {
        beys: beys.map((b) => ({
          bladeId: b.blade?.id || '',
          ratchetId: b.ratchet?.id || '',
          bitId: b.bit?.id || '',
          bladeName: b.blade?.name,
          overBladeId: b.overBlade?.id,
          overBladeName: b.overBlade?.name,
          lockChipId: b.lockChip?.id,
          lockChipName: b.lockChip?.name,
          assistBladeId: b.assistBlade?.id,
          assistBladeName: b.assistBlade?.name,
        })),
      };
      const result = validateDeck(deckToValidate);
      setValidationErrors(result.isValid ? [] : result.errors);
    } else {
      setValidationErrors([]);
    }
  }, [beys]);

  const handleBeyChange = (index: number, data: BeyData) => {
    const newBeys = [...beys] as [BeyData, BeyData, BeyData];
    newBeys[index] = data;
    setBeys(newBeys);
  };

  // Get all used part IDs across all beys
  const usedPartIds = beys.flatMap((bey) =>
    [
      bey.blade?.id,
      bey.overBlade?.id,
      bey.ratchet?.id,
      bey.bit?.id,
      bey.lockChip?.name.toLowerCase().includes('metal')
        ? bey.lockChip.id
        : undefined,
      bey.assistBlade?.id,
    ].filter(Boolean),
  ) as string[];

  const isComplete = beys.every((bey) => {
    const baseComplete = bey.blade && bey.ratchet && bey.bit;
    if (!baseComplete) return false;
    if (bey.blade?.system === 'CX')
      return !!bey.overBlade && !!bey.lockChip && !!bey.assistBlade;
    return true;
  });
  const isValid = name.trim() && isComplete && validationErrors.length === 0;

  const handleSave = async () => {
    if (!isValid) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        isActive,
        beys: beys.map((bey, index) => ({
          position: index + 1,
          nickname: bey.nickname || null,
          bladeId: bey.blade?.id,
          overBladeId: bey.overBlade?.id || undefined,
          ratchetId: bey.ratchet?.id,
          bitId: bey.bit?.id,
          lockChipId: bey.lockChip?.id || undefined,
          assistBladeId: bey.assistBlade?.id || undefined,
        })),
      };

      const url = deck ? `/api/decks/${deck.id}` : '/api/decks';
      const method = deck ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Impossible d'enregistrer le deck");
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#0a0a0a',
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/dark-matter.png")',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          color: 'white',
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: '900',
            letterSpacing: 2,
          }}
        >
          {deck ? "MODIFIER L'ÉQUIPEMENT" : 'NOUVELLE DECK BOX'}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Typography
              variant="caption"
              sx={{ color: '#aaa', fontWeight: 'bold' }}
            >
              ACTIF POUR TOURNOIS
            </Typography>
          }
        />
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {validationErrors.length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {validationErrors[0]}
            </Alert>
          )}

          {/* 3D Overview / Selector Placeholder */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mb: 1,
            }}
          >
            {[0, 1, 2].map((idx) => (
              <Box
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                sx={{
                  flex: 1,
                  height: 120,
                  bgcolor: selectedIdx === idx ? '#222' : '#111',
                  border: '2px solid',
                  borderColor: selectedIdx === idx ? 'error.main' : '#222',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: '#1a1a1a',
                    borderColor: selectedIdx === idx ? 'error.main' : '#444',
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: selectedIdx === idx ? 'error.main' : '#666',
                    fontWeight: 'bold',
                    mb: 1,
                  }}
                >
                  BEY #{idx + 1}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: beys[idx]?.blade ? 'white' : '#444',
                    fontWeight: '900',
                    textAlign: 'center',
                    px: 1,
                  }}
                >
                  {beys[idx]?.blade?.name || 'VIDE'}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Selected Slot Editor */}
          <Box
            sx={{
              bgcolor: '#111',
              borderRadius: 4,
              border: '2px solid #222',
              p: 3,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="NOM DU DECK"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                variant="standard"
                placeholder="Equipe RPB"
                sx={{
                  flexGrow: 1,
                  '& .MuiInputBase-root': {
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: '900',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#555',
                    fontWeight: 'bold',
                  },
                }}
              />
            </Box>

            <BeyBuilder
              position={selectedIdx + 1}
              data={beys[selectedIdx]!}
              onChange={(data) => handleBeyChange(selectedIdx, data)}
              usedPartIds={usedPartIds}
              disabled={saving}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{ bgcolor: '#0a0a0a', borderTop: '1px solid #222', p: 3 }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ color: '#555' }}>
          ANNULER
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="error"
          disabled={!isValid || saving}
          startIcon={
            saving ? <CircularProgress size={20} color="inherit" /> : null
          }
          sx={{
            fontWeight: '900',
            px: 6,
            py: 1.5,
            borderRadius: 2,
            letterSpacing: 2,
          }}
        >
          {saving ? 'CHARGEMENT...' : "VALIDER L'ÉQUIPEMENT"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
