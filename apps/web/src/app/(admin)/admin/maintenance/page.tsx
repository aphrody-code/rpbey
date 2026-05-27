'use client';

import {
  CleaningServices,
  CloudDownload,
  DeleteSweep,
  Handyman,
  History,
  Refresh,
  Storage,
  Update,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useToast } from '@/components/ui';
import {
  actionClearTournamentCache,
  actionImportTournament,
  actionMergeDuplicates,
  actionRecalculateRankings,
  actionTriggerSyncParts,
} from '@/server/actions/maintenance';
import { archiveCurrentSeason } from '@/server/actions/season';
import RankingConfigForm from './_components/RankingConfigForm';

export default function MaintenancePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [challongeSlug, setChallongeSlug] = useState('');
  const [nextSeasonName, setNextSeasonName] = useState('');
  const { showToast } = useToast();

  const handleAction = async (
    id: string,
    action: () => Promise<{
      success?: boolean;
      message?: string;
      error?: string;
    }>,
  ) => {
    setLoading(id);
    try {
      const res = await action();
      if (res && (res.success || !res.error)) {
        showToast(res.message || 'Action réussie', 'success');
      } else {
        showToast(res?.error || 'Erreur inconnue', 'error');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleImport = async () => {
    if (!challongeSlug) return;
    handleAction('import', () => actionImportTournament(challongeSlug));
  };

  const handleArchive = async () => {
    if (!nextSeasonName) return;
    const slug = nextSeasonName
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^a-z0-9-]/g, '');
    handleAction('archive', () => archiveCurrentSeason(nextSeasonName, slug));
  };

  const tasks = [
    {
      id: 'recalc',
      title: 'Recalculer les Classements',
      description:
        'Réinitialise les profils et recalcule les points de tous les joueurs pour la saison active.',
      icon: <Refresh />,
      color: 'primary',
      action: actionRecalculateRankings,
    },
    {
      id: 'merge',
      title: 'Fusionner les Doublons',
      description:
        'Identifie les comptes "invités" (stubs) et les fusionne avec les comptes réels correspondants.',
      icon: <CleaningServices />,
      color: 'warning',
      action: actionMergeDuplicates,
    },
    {
      id: 'sync-parts',
      title: 'Sync Bey-Library',
      description:
        'Met à jour la base de données des pièces (Blades, Ratchets, Bits) depuis la bibliothèque source local.',
      icon: <Update />,
      color: 'info',
      action: actionTriggerSyncParts,
    },
    {
      id: 'clear-cache',
      title: 'Vider le Cache UI',
      description:
        'Nettoie les données de classement temporaires stockées dans les objets tournois.',
      icon: <DeleteSweep />,
      color: 'error',
      action: actionClearTournamentCache,
    },
  ];

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 'bold',
          }}
        >
          🛠️ Maintenance Système
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
          }}
        >
          Outils d'administration et de gestion de l'intégrité des données
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Import Section */}
            <Card variant="outlined">
              <CardHeader
                avatar={<CloudDownload color="primary" />}
                title={
                  <Typography
                    sx={{
                      fontWeight: 'bold',
                    }}
                  >
                    Importation Challonge Express
                  </Typography>
                }
                subheader="Importer un tournoi directement via son slug (ex: fr/B_TS3)"
              />
              <CardContent>
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="fr/slug-du-tournoi"
                    value={challongeSlug}
                    onChange={(e) => setChallongeSlug(e.target.value)}
                    disabled={loading !== null}
                  />
                  <Button
                    variant="contained"
                    onClick={handleImport}
                    disabled={loading !== null || !challongeSlug}
                    startIcon={
                      loading === 'import' ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <CloudDownload />
                      )
                    }
                  >
                    Importer
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Season Section */}
            <Card
              variant="outlined"
              sx={{
                border: '1px solid',
                borderColor: 'error.main',
                bgcolor: 'rgba(239, 68, 68, 0.02)',
              }}
            >
              <CardHeader
                avatar={<Update color="error" />}
                title={
                  <Typography
                    color="error"
                    sx={{
                      fontWeight: 'bold',
                    }}
                  >
                    Clore la Saison et Archiver
                  </Typography>
                }
                subheader="Archive les scores actuels dans l'historique et réinitialise les profils à zéro pour une nouvelle saison."
              />
              <CardContent>
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Nom de la NOUVELLE saison (ex: Saison 2026 - Printemps)"
                    value={nextSeasonName}
                    onChange={(e) => setNextSeasonName(e.target.value)}
                    disabled={loading !== null}
                  />
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleArchive}
                    disabled={loading !== null || !nextSeasonName}
                    startIcon={
                      loading === 'archive' ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <History />
                      )
                    }
                  >
                    Nouvelle Saison
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Ranking Config Section */}
            <RankingConfigForm />

            <Grid container spacing={3}>
              {tasks.map((task) => (
                <Grid size={{ xs: 12, sm: 6 }} key={task.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <CardHeader
                      avatar={task.icon}
                      title={
                        <Typography
                          sx={{
                            fontWeight: 'bold',
                          }}
                        >
                          {task.title}
                        </Typography>
                      }
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {task.description}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        color={
                          task.color as
                            | 'primary'
                            | 'warning'
                            | 'info'
                            | 'error'
                            | 'secondary'
                        }
                        onClick={() => handleAction(task.id, task.action)}
                        disabled={loading !== null}
                        startIcon={
                          loading === task.id ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            task.icon
                          )
                        }
                      >
                        {loading === task.id ? 'Exécution...' : 'Lancer'}
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardHeader title="💡 État du Système" avatar={<Storage />} />
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Database"
                      secondary="PostgreSQL 17 (Connecté)"
                    />
                    <Chip size="small" label="OK" color="success" />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Storage"
                      secondary="S3 Compatible (Connecté)"
                    />
                    <Chip size="small" label="OK" color="success" />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Dernier Recalcul"
                      secondary="Aujourd'hui, 14:30"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            <Alert severity="info" icon={<Handyman />}>
              Ces actions sont destructives ou modifient massivement la base de
              données. Assurez-vous d'avoir une sauvegarde avant toute opération
              majeure.
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
