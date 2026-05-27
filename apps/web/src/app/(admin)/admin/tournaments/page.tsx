'use client';

import {
  CloudDownload,
  Delete,
  Edit,
  Link as LinkIcon,
  Search,
} from '@mui/icons-material';
import {
  Box,
  Button, // Add Button here
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import TablePagination from '@mui/material/TablePagination';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  PageHeader,
  useConfirmDialog,
  useToast,
  // Remove Button from here
} from '@/components/ui';
import { type Tournament } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDateShort } from '@/lib/utils';
import { getTournamentCategories } from '@/server/actions/ranking';
import {
  createTournament,
  deleteTournament,
  getTournaments,
  type TournamentInput,
  updateTournament,
} from './actions';
import { CommunitySyncDialog } from './CommunitySyncDialog';
import { TournamentDialog } from './TournamentDialog';

export default function AdminTournamentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<
    (Tournament & { _count: { participants: number } })[]
  >([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    totalTournaments: 0,
    activeTournaments: 0,
    totalParticipants: 0,
  });

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      // Clean up URL
      router.replace('/admin/tournaments');
    }
  }, [searchParams, router]);

  const debouncedSearch = useDebounce(search, 500);

  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const { showToast } = useToast();

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const [{ tournaments: data, total: totalCount, summary: stats }, cats] =
        await Promise.all([
          getTournaments(page + 1, rowsPerPage, debouncedSearch),
          getTournamentCategories(),
        ]);

      setTournaments(
        data as unknown as (Tournament & {
          _count: { participants: number };
        })[],
      );
      setTotal(totalCount);
      setSummary(stats);
      setCategories(cats);
    } catch {
      showToast('Erreur lors de la récupération des tournois', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, showToast]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAdd = () => {
    setSelectedTournament(null);
    setDialogOpen(true);
  };

  const handleSyncCommunity = () => {
    setSyncDialogOpen(true);
  };

  const handleEdit = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setDialogOpen(true);
  };

  const handleDelete = async (tournament: Tournament) => {
    const confirmed = await confirm({
      title: 'Supprimer le tournoi',
      message: `Êtes-vous sûr de vouloir supprimer "${tournament.name}" ? Tous les participants seront également retirés.`,
      confirmText: 'Supprimer',
      confirmColor: 'error',
    });

    if (confirmed) {
      try {
        await deleteTournament(tournament.id);
        showToast('Tournoi supprimé avec succès', 'success');
        fetchTournaments();
      } catch {
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const handleSubmit = async (data: TournamentInput) => {
    setSubmitting(true);
    try {
      if (selectedTournament) {
        await updateTournament(selectedTournament.id, data);
        showToast('Tournoi mis à jour', 'success');
      } else {
        await createTournament(data);
        showToast('Tournoi créé', 'success');
      }
      setDialogOpen(false);
      fetchTournaments();
    } catch {
      showToast("Erreur lors de l'enregistrement", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<
    string,
    'success' | 'warning' | 'default' | 'info' | 'error'
  > = {
    REGISTRATION_OPEN: 'success',
    REGISTRATION_CLOSED: 'warning',
    UPCOMING: 'info',
    COMPLETE: 'default',
    UNDERWAY: 'success',
    CHECKIN: 'info',
    CANCELLED: 'error',
  };

  const statusLabels: Record<string, string> = {
    REGISTRATION_OPEN: 'Inscriptions ouvertes',
    REGISTRATION_CLOSED: 'Inscriptions closes',
    UPCOMING: 'À venir',
    COMPLETE: 'Terminé',
    UNDERWAY: 'En cours',
    CHECKIN: 'Check-in',
    CANCELLED: 'Annulé',
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <PageHeader
          title="Tournois"
          description="Gérez les tournois Beyblade et les participants"
          actionLabel=""
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CloudDownload />}
            onClick={handleSyncCommunity}
          >
            Sync Challonge
          </Button>
          <Button variant="contained" onClick={handleAdd}>
            Nouveau tournoi
          </Button>
        </Box>
      </Box>
      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total tournois', value: summary.totalTournaments },
          { label: 'En cours / Ouverts', value: summary.activeTournaments },
          { label: 'Participants totaux', value: summary.totalParticipants },
        ].map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 4 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h3"
                  color="primary"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Rechercher un tournoi par nom ou description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: 'background.paper',
            },
          }}
        />
      </Box>
      {loading && tournaments.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
          }}
        >
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                zIndex: 1,
                borderRadius: 3,
              }}
            >
              <CircularProgress />
            </Box>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Participants</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tournaments.map((tournament) => (
                  <TableRow key={tournament.id} hover>
                    <TableCell>
                      <Typography
                        sx={{
                          fontWeight: 'bold',
                        }}
                      >
                        {tournament.name}
                      </Typography>
                      {tournament.challongeUrl && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mt: 0.5,
                          }}
                        >
                          <LinkIcon
                            sx={{ fontSize: 12, color: 'text.secondary' }}
                          />
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              color: 'text.secondary',
                              maxWidth: 200,
                            }}
                          >
                            {tournament.challongeUrl}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{formatDateShort(tournament.date)}</TableCell>
                    <TableCell>
                      {tournament._count.participants}/{tournament.maxPlayers}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          statusLabels[tournament.status] || tournament.status
                        }
                        color={statusColors[tournament.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Modifier">
                          <IconButton
                            onClick={() => handleEdit(tournament)}
                            size="small"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton
                            onClick={() => handleDelete(tournament)}
                            size="small"
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {tournaments.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Aucun tournoi trouvé
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Lignes par page:"
          />
        </Card>
      )}
      <TournamentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedTournament}
        loading={submitting}
        categories={categories}
      />
      <CommunitySyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSuccess={fetchTournaments}
      />
      {ConfirmDialogComponent}
    </Box>
  );
}
