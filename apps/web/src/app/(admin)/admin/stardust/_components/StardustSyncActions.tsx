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
import { linkStardustBladers, syncStardustRanking } from '@/server/actions/stardust';

export default function StardustSyncActions() {
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingLinking, setLoadingLinking] = useState(false);

  const handleSync = async () => {
    setLoadingRanking(true);
    try {
      const result = await syncStardustRanking();
      if (result.success) {
        toast.success(
          `Classement synchronisé (${result.count} joueurs, ${result.tournamentCount} tournois)`,
        );
      } else {
        toast.error(`Erreur: ${result.error}`);
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setLoadingRanking(false);
    }
  };

  const handleLink = async () => {
    setLoadingLinking(true);
    try {
      const result = await linkStardustBladers();
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
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          Classement Stardust
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Recalcule le classement à partir des tournois marqués catégorie
          &laquo;&nbsp;STARDUST&nbsp;&raquo; en base.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={
            loadingRanking ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CloudSyncIcon />
            )
          }
          onClick={handleSync}
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
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          Liaison des comptes
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Lie automatiquement les bladers Stardust aux comptes utilisateurs RPB
          via nom / tag Discord.
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
          onClick={handleLink}
          disabled={loadingLinking}
        >
          {loadingLinking ? 'Liaison...' : 'Lancer la liaison automatique'}
        </Button>
      </Box>
    </Stack>
  );
}
