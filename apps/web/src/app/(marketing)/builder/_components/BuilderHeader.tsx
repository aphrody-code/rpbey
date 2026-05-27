'use client';

import {
  Add,
  Close,
  Construction,
  Redo,
  Share,
  Undo,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { useBuilder } from './BuilderContext';

export function BuilderHeader() {
  const { state, dispatch, canUndo, canRedo, shareUrl } = useBuilder();
  const { data: session } = useSession();

  const handleShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Lien de partage copié !');
  };

  // Load saved decks on mount if authenticated
  useEffect(() => {
    if (!session?.user) return;
    dispatch({ type: 'SET_LOADING_DECKS', loading: true });

    fetch('/api/decks')
      .then((res) => res.json())
      .then(({ data }) => {
        if (data) {
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
      })
      .catch(() => toast.error('Impossible de charger vos decks'))
      .finally(() => dispatch({ type: 'SET_LOADING_DECKS', loading: false }));
  }, [session?.user, dispatch]);

  const handleLoadDeck = useCallback(
    async (deckId: string) => {
      try {
        const res = await fetch(`/api/decks/${deckId}`);
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        dispatch({
          type: 'LOAD_DECK',
          deck: {
            id: data.id,
            name: data.name,
            isActive: data.isActive,
            beys: (data.items || []).map(
              (item: {
                blade: unknown;
                ratchet: unknown;
                bit: unknown;
                assistBlade?: unknown;
                nickname?: string;
              }) => ({
                blade: item.blade,
                ratchet: item.ratchet,
                bit: item.bit,
                assistBlade: item.assistBlade ?? null,
                nickname: item.nickname || '',
              }),
            ),
          },
        });
        toast.success(`Deck "${data.name}" charge`);
      } catch {
        toast.error('Impossible de charger ce deck');
      }
    },
    [dispatch],
  );

  const handleDeleteDeck = useCallback(
    async (deckId: string, e: React.SyntheticEvent) => {
      e.stopPropagation();
      try {
        const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        dispatch({ type: 'DELETE_DECK', deckId });
        toast.success('Deck supprime');
      } catch {
        toast.error('Impossible de supprimer ce deck');
      }
    },
    [dispatch],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 'auto' }}>
        <Construction sx={{ fontSize: 32, color: 'error.main' }} />
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: '900',
              lineHeight: 1.1,
            }}
          >
            DECK BUILDER
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 'bold',
            }}
          >
            CONFIGURATION 3ON3
          </Typography>
        </Box>
      </Box>
      {/* Tools: Undo, Redo, Share */}
      <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
        <Tooltip title="Annuler (Ctrl+Z)" arrow>
          <span>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!canUndo}
              sx={{ bgcolor: alpha('#000', 0.03) }}
            >
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Rétablir (Ctrl+Y)" arrow>
          <span>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!canRedo}
              sx={{ bgcolor: alpha('#000', 0.03) }}
            >
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Partager le brouillon" arrow>
          <IconButton
            size="small"
            onClick={handleShare}
            sx={{ bgcolor: alpha('#000', 0.03), color: 'info.main' }}
          >
            <Share fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          alignItems: 'center',
          overflow: 'auto',
          maxWidth: { xs: '100%', md: '60%' },
          pb: 0.5,
          '&::-webkit-scrollbar': { height: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
        }}
      >
        {state.loadingDecks && (
          <>
            <Skeleton variant="rounded" width={80} height={28} />
            <Skeleton variant="rounded" width={80} height={28} />
          </>
        )}

        {state.savedDecks.map((deck) => (
          <Chip
            key={deck.id}
            label={deck.name}
            variant={state.deckId === deck.id ? 'filled' : 'outlined'}
            onClick={() => handleLoadDeck(deck.id)}
            onDelete={(e) => handleDeleteDeck(deck.id, e)}
            deleteIcon={<Close sx={{ fontSize: '14px !important' }} />}
            size="small"
            sx={{
              fontWeight: 'bold',
              fontSize: '0.75rem',
              borderRadius: 2,
              ...(state.deckId === deck.id && {
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.15),
                color: 'error.main',
                borderColor: 'error.main',
              }),
              ...(deck.isActive &&
                state.deckId !== deck.id && {
                  border: '1px solid',
                  borderColor: 'success.main',
                }),
            }}
          />
        ))}

        <IconButton
          size="small"
          onClick={() => dispatch({ type: 'NEW_DECK' })}
          sx={{
            width: 28,
            height: 28,
            border: '1px dashed',
            borderColor: 'divider',
            '&:hover': { borderColor: 'error.main', color: 'error.main' },
          }}
        >
          <Add sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
