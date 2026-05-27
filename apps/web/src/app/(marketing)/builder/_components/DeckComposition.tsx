'use client';

import { Add, Close, Download, Save, Visibility } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DeckBoxDisplay } from '@/components/deck/DeckBoxDisplay';
import { type Deck } from '@/components/deck/DeckCard';
import { useSession } from '@/lib/auth-client';
import { validateDeck } from '@/lib/tournament-logic';
import { BeySlotCard } from './BeySlotCard';
import { clearDraft, isCXBlade, useBuilder } from './BuilderContext';

export function DeckComposition() {
  const { state, dispatch } = useBuilder();
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);

  const allComplete = state.beys.every((b) => {
    const baseComplete = !!b.blade && !!b.ratchet && !!b.bit;
    if (!baseComplete) return false;
    if (isCXBlade(b)) {
      return !!b.lockChip && !!b.assistBlade;
    }
    return true;
  });

  const previewDeck = useMemo(() => {
    return {
      id: state.deckId || 'preview',
      name: state.deckName || 'Nouveau Deck',
      isActive: state.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      beys: state.beys.map((b, i) => ({
        id: `slot-${i}`,
        position: i + 1,
        nickname: b.nickname || null,
        blade: b.blade,
        overBlade: b.overBlade,
        ratchet: b.ratchet,
        bit: b.bit,
        lockChip: b.lockChip,
        assistBlade: b.assistBlade,
      })),
    };
  }, [state]);

  const validation = useMemo(() => {
    if (!allComplete) return null;
    return validateDeck({
      beys: state.beys.map((b) => ({
        bladeId: b.blade?.id ?? '',
        ratchetId: b.ratchet?.id ?? '',
        bitId: b.bit?.id ?? '',
        bladeName: b.blade?.name ?? '',
        overBladeId: b.overBlade?.id,
        overBladeName: b.overBlade?.name,
        lockChipId: b.lockChip?.id,
        lockChipName: b.lockChip?.name,
        assistBladeId: b.assistBlade?.id,
        assistBladeName: b.assistBlade?.name,
      })),
    });
  }, [state.beys, allComplete]);

  const handleSave = useCallback(async () => {
    if (!session?.user) {
      toast.error('Connectez-vous pour sauvegarder vos decks', {
        action: {
          label: 'Se connecter',
          onClick: () => window.location.assign('/dashboard'),
        },
      });
      return;
    }

    if (!state.deckName.trim()) {
      toast.error('Donnez un nom à votre deck');
      return;
    }

    if (!allComplete) {
      toast.error('Complétez les 3 Beys avant de sauvegarder');
      return;
    }

    if (validation && !validation.isValid) {
      toast.error(validation.errors[0]);
      return;
    }

    setIsSaving(true);
    const payload = {
      name: state.deckName,
      isActive: state.isActive,
      beys: state.beys.map((b, i) => ({
        position: i + 1,
        nickname: b.nickname,
        bladeId: b.blade?.id ?? '',
        ratchetId: b.ratchet?.id ?? '',
        bitId: b.bit?.id ?? '',
        overBladeId: b.overBlade?.id || undefined,
        lockChipId: b.lockChip?.id || undefined,
        assistBladeId: b.assistBlade?.id || undefined,
      })),
    };

    try {
      const url = state.deckId ? `/api/decks/${state.deckId}` : '/api/decks';
      const method = state.deckId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }

      toast.success(state.deckId ? 'Deck mis à jour !' : 'Deck créé !');
      clearDraft();

      const decksRes = await fetch('/api/decks');
      if (decksRes.ok) {
        const { data } = await decksRes.json();
        dispatch({
          type: 'SET_SAVED_DECKS',
          decks: data.map(
            (d: {
              id: string;
              name: string;
              isActive: boolean;
              updatedAt: string;
            }) => ({
              id: d.id,
              name: d.name,
              isActive: d.isActive,
              updatedAt: d.updatedAt,
            }),
          ),
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde',
      );
    } finally {
      setIsSaving(false);
    }
  }, [session, state, allComplete, validation, dispatch]);

  const handleNewDeck = () => {
    if (
      confirm(
        'Voulez-vous vraiment créer un nouveau deck ? Le brouillon actuel sera effacé.',
      )
    ) {
      dispatch({ type: 'NEW_DECK' });
      clearDraft();
      toast.info('Nouveau deck prêt !');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Nom de votre deck..."
          variant="filled"
          size="small"
          value={state.deckName}
          onChange={(e) =>
            dispatch({ type: 'SET_DECK_NAME', name: e.target.value })
          }
          sx={{
            flex: 1,
            '& .MuiFilledInput-root': {
              borderRadius: 3,
              fontWeight: '900',
              bgcolor: (theme) => alpha(theme.palette.action.hover, 0.04),
              '&:before, &:after': { display: 'none' },
            },
          }}
        />
        <Tooltip title="Visualiser dans la boîte" arrow>
          <span>
            <IconButton
              onClick={() => setBoxOpen(true)}
              disabled={!allComplete}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
                color: 'info.main',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
                },
                '&.Mui-disabled': { bgcolor: 'transparent', opacity: 0.3 },
              }}
            >
              <Visibility />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Nouveau deck" arrow>
          <IconButton
            onClick={handleNewDeck}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              bgcolor: (theme) => alpha(theme.palette.action.hover, 0.06),
              color: 'text.secondary',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.action.hover, 0.1),
              },
            }}
          >
            <Add />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <BeySlotCard key={i} slotIndex={i} />
        ))}
      </Box>
      <Box sx={{ mt: 1 }}>
        {validation && !validation.isValid ? (
          <Alert
            severity="error"
            sx={{
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha('#ef4444', 0.2),
              bgcolor: alpha('#ef4444', 0.02),
            }}
          >
            {validation.errors.map((err, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 'bold',
                }}
              >
                • {err}
              </Typography>
            ))}
          </Alert>
        ) : allComplete && validation?.isValid ? (
          <Alert
            severity="success"
            sx={{
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha('#22c55e', 0.2),
              bgcolor: alpha('#22c55e', 0.02),
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: '900',
              }}
            >
              DECK VALIDE ET PRÊT POUR LE TOURNOI !
            </Typography>
          </Alert>
        ) : (
          <Alert
            severity="info"
            sx={{
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha('#3b82f6', 0.2),
              bgcolor: alpha('#3b82f6', 0.02),
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'bold',
              }}
            >
              Complétez les 3 Beyblades pour valider votre deck.
            </Typography>
          </Alert>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={state.isActive}
              onChange={(e) =>
                dispatch({ type: 'SET_IS_ACTIVE', isActive: e.target.checked })
              }
              size="medium"
              color="error"
            />
          }
          label={
            <Typography
              variant="body2"
              sx={{
                fontWeight: '900',
                color: 'text.primary',
              }}
            >
              DÉFINIR COMME ÉQUIPEMENT ACTIF
            </Typography>
          }
          sx={{
            ml: 0.5,
            bgcolor: alpha('#000', 0.02),
            p: 1.5,
            borderRadius: 3,
            width: '100%',
            mr: 0,
            transition: 'all 0.2s',
            '&:hover': { bgcolor: alpha('#000', 0.04) },
          }}
        />

        <Button
          variant="contained"
          startIcon={
            isSaving ? <CircularProgress size={20} color="inherit" /> : <Save />
          }
          onClick={handleSave}
          disabled={!allComplete || !state.deckName.trim() || isSaving}
          fullWidth
          color="error"
          sx={{
            borderRadius: 4,
            fontWeight: '900',
            py: 2,
            textTransform: 'uppercase',
            fontSize: '1rem',
            letterSpacing: 1,
            boxShadow: (theme) =>
              `0 10px 30px ${alpha(theme.palette.error.main, 0.3)}`,
            '&:hover': {
              boxShadow: (theme) =>
                `0 15px 40px ${alpha(theme.palette.error.main, 0.4)}`,
            },
          }}
        >
          {isSaving
            ? 'Sauvegarde...'
            : state.deckId
              ? 'Mettre à jour le deck'
              : 'Enregistrer le deck'}
        </Button>

        {state.deckId && state.deckId !== 'preview' && (
          <Button
            component="a"
            href={`/api/decks/${state.deckId}/card`}
            download={`${state.deckName || 'deck'}.png`}
            variant="outlined"
            startIcon={<Download />}
            fullWidth
            sx={{
              borderRadius: 4,
              fontWeight: 700,
              py: 1.5,
              textTransform: 'none',
            }}
          >
            Télécharger en image
          </Button>
        )}
      </Box>
      <Dialog
        open={boxOpen}
        onClose={() => setBoxOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 6,
              bgcolor: 'background.paper',
              backgroundImage: 'none',
              overflow: 'visible',
              p: 2,
            },
          },
        }}
      >
        <DialogContent sx={{ p: 0, overflow: 'visible' }}>
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={() => setBoxOpen(false)}
              sx={{
                position: 'absolute',
                top: -28,
                right: -28,
                bgcolor: 'background.paper',
                boxShadow: 3,
                zIndex: 100,
                '&:hover': { bgcolor: 'error.main', color: '#fff' },
              }}
            >
              <Close />
            </IconButton>
            <DeckBoxDisplay deck={previewDeck as Deck} />
          </Box>
        </DialogContent>
      </Dialog>
      {!session?.user && (
        <Button
          variant="outlined"
          size="small"
          href="/dashboard"
          sx={{
            fontWeight: 'bold',
            fontSize: '0.75rem',
            letterSpacing: 1,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            },
          }}
        >
          CONNECTEZ-VOUS POUR SAUVEGARDER VOS DECKS
        </Button>
      )}
    </Box>
  );
}
