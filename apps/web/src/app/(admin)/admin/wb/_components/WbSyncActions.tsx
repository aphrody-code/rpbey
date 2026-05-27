'use client';

import CloudSyncIcon from '@mui/icons-material/CloudSync';
import LinkIcon from '@mui/icons-material/Link';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { toast } from 'sonner';
import { linkWbBladers, syncWbRanking } from '@/server/actions/wb';

export default function WbSyncActions() {
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingLinking, setLoadingLinking] = useState(false);

  const handleSyncRanking = async () => {
    setLoadingRanking(true);
    try {
      const result = await syncWbRanking();
      if (result.success) {
        toast.success(`Classement synchronisé (${result.count} joueurs)`);
      } else {
        toast.error(`Erreur: ${result.error}`);
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setLoadingRanking(false);
    }
  };

  const handleLinkBladers = async () => {
    setLoadingLinking(true);
    try {
      const result = await linkWbBladers();
      if (result.success) {
        toast.success(`${result.linkedCount} bladers liés avec succès !`);
      } else {
        toast.error(`Erreur: ${result.error}`);
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setLoadingLinking(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 'bold',
          }}
        >
          Classement Ultim Bataille
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          Recalcule le classement à partir des fichiers JSON de tournois
          (data/wb_history/).
        </Typography>
        <Button
          variant="contained"
          color="error"
          startIcon={
            loadingRanking ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CloudSyncIcon />
            )
          }
          onClick={handleSyncRanking}
          disabled={loadingRanking}
        >
          {loadingRanking ? 'Synchronisation...' : 'Synchroniser maintenant'}
        </Button>
      </Box>
      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 'bold',
          }}
        >
          Liaison des Comptes
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          Analyse les noms des bladers WB et tente de les lier aux comptes
          utilisateurs RPB existants.
        </Typography>
        <Button
          variant="outlined"
          startIcon={
            loadingLinking ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <LinkIcon />
            )
          }
          onClick={handleLinkBladers}
          disabled={loadingLinking}
        >
          {loadingLinking
            ? 'Liaison en cours...'
            : 'Lancer la liaison automatique'}
        </Button>
      </Box>
    </Stack>
  );
}
