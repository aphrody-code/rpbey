'use client';

import { CloudDownload } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useToast } from '@/components/ui';
import { type ChallongeTournament } from '@/lib/challonge';
import {
  importTournamentFromChallonge,
  syncCommunityTournaments,
} from './actions';

interface CommunitySyncDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CommunitySyncDialog({
  open,
  onClose,
  onSuccess,
}: CommunitySyncDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<ChallongeTournament[]>([]);
  const [fetched, setFetched] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSync = async () => {
    setLoading(true);
    try {
      const data = await syncCommunityTournaments();
      setTournaments(data);
      setFetched(true);
    } catch {
      showToast(
        'Erreur lors de la synchronisation avec la communauté',
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (tournament: ChallongeTournament) => {
    setImporting(tournament.id);
    try {
      await importTournamentFromChallonge(tournament.id);
      showToast(
        `Tournoi "${tournament.attributes.name}" importé avec succès`,
        'success',
      );
      setTournaments((prev) => prev.filter((t) => t.id !== tournament.id));
      onSuccess();
    } catch {
      showToast("Erreur lors de l'import du tournoi", 'error');
    } finally {
      setImporting(null);
    }
  };

  const handleClose = () => {
    setTournaments([]);
    setFetched(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudDownload /> Synchronisation Communauté
      </DialogTitle>
      <DialogContent dividers>
        {!fetched ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
              gap: 2,
            }}
          >
            <Typography>
              Rechercher les nouveaux tournois de la communauté Challonge
              configurée.
            </Typography>
            <Button
              variant="contained"
              onClick={handleSync}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={20} /> : <CloudDownload />
              }
            >
              {loading ? 'Recherche en cours...' : 'Rechercher les tournois'}
            </Button>
          </Box>
        ) : tournaments.length === 0 ? (
          <Alert severity="info">Aucun nouveau tournoi trouvé.</Alert>
        ) : (
          <List>
            {tournaments.map((tournament) => (
              <ListItem key={tournament.id} divider>
                <ListItemText
                  primary={tournament.attributes.name}
                  secondary={
                    <>
                      {new Date(
                        tournament.attributes.startAt || '',
                      ).toLocaleDateString()}{' '}
                      •{tournament.attributes.tournamentType} •
                      {tournament.attributes.state}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleImport(tournament)}
                    disabled={!!importing}
                  >
                    {importing === tournament.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      'Importer'
                    )}
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}
