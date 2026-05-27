/**
 * RPB - Tournament Detail Page
 * View and manage a single tournament with bracket
 */

'use client';

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import HistoryIcon from '@mui/icons-material/History';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/People';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadarIcon from '@mui/icons-material/Radar';
import SensorsIcon from '@mui/icons-material/Sensors';
import SyncIcon from '@mui/icons-material/Sync';
import TableViewIcon from '@mui/icons-material/TableView';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ParticipantList, TournamentBracket } from '@/components/tournaments';
import { reportChallongeMatch } from './actions';

interface TournamentDetailPageProps {
  params: Promise<{ id: string }>;
}

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  format: string;
  maxPlayers: number;
  status: string;
  challongeId: string | null;
  challongeUrl: string | null;
  participants: Array<{
    id: string;
    seed: number | null;
    userId: string;
    user: {
      id: string;
      name: string;
      profile?: {
        bladerName?: string;
        avatarUrl?: string;
      };
      decks?: Array<{
        id: string;
        name: string;
        isActive: boolean;
      }>;
    };
  }>;
  matches: Array<{
    id: string;
    round: number;
    state: string;
    score: string | null;
    player1: {
      id: string;
      name: string;
      profile?: {
        bladerName?: string;
        avatarUrl?: string;
      };
    } | null;
    player2: {
      id: string;
      name: string;
      profile?: {
        bladerName?: string;
        avatarUrl?: string;
      };
    } | null;
    winner: {
      id: string;
      name: string;
      profile?: {
        bladerName?: string;
        avatarUrl?: string;
      };
    } | null;
  }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getStatusColor(status: string) {
  switch (status) {
    case 'UPCOMING':
      return 'info';
    case 'ONGOING':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'default';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'UPCOMING':
      return 'À venir';
    case 'ONGOING':
      return 'En cours';
    case 'COMPLETED':
      return 'Terminé';
    case 'CANCELLED':
      return 'Annulé';
    default:
      return status;
  }
}

interface LiveData {
  standings: Array<{
    rank: number;
    name: string;
    challongeUsername?: string;
    challongeProfileUrl?: string;
    wins: number;
    losses: number;
  }>;
  stations: Array<{
    stationId: number | string;
    name: string;
    currentMatch?: {
      matchId: number;
      identifier: string;
      round: number;
      player1: string | null;
      player2: string | null;
      scores: string;
      state: string;
    } | null;
    status: 'idle' | 'active' | 'paused';
  }>;
  activityLog: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
  lastUpdated: string;
}

export default function TournamentDetailPage({
  params,
}: TournamentDetailPageProps) {
  const { id } = use(params);
  const [tab, setTab] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<LiveData | null>(null);

  const { data, isLoading, error } = useSWR<{ data: Tournament }>(
    `/api/tournaments/${id}`,
    fetcher,
  );

  const tournament = data?.data;

  const fetchLiveData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}/live`);
      if (res.ok) {
        const response = await res.json();
        setLiveData(response.data);
      }
    } catch {
      // Silently fail
    }
  }, [id]);

  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  const handleReportMatch = async (
    matchId: string,
    reportData: { winnerId: string; score: string },
  ) => {
    try {
      const result = await reportChallongeMatch(id, matchId, reportData);
      if (result.success) {
        mutate(`/api/tournaments/${id}`);
      } else {
        alert(`Erreur report: ${result.error}`);
      }
    } catch (err) {
      console.error('Failed to report:', err);
    }
  };

  const handleAction = async (
    action: 'start' | 'finalize' | 'sync' | 'sync_participants',
  ) => {
    setActionLoading(action);
    try {
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        mutate(`/api/tournaments/${id}`);
      } else {
        const err = await response.json();
        alert(`Erreur: ${err.error || 'Action échouée'}`);
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!confirm('Retirer ce participant ?')) return;

    try {
      await fetch(`/api/tournaments/${id}/participants?userId=${userId}`, {
        method: 'DELETE',
      });
      mutate(`/api/tournaments/${id}`);
    } catch (err) {
      console.error('Failed to remove participant:', err);
    }
  };

  const handleScrapeLive = async () => {
    setActionLoading('scrape');
    try {
      const response = await fetch(`/api/tournaments/${id}/live`, {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        setLiveData({
          standings: result.data.standings,
          stations: result.data.stations,
          activityLog: result.data.activityLog,
          lastUpdated: new Date().toISOString(),
        });
        mutate(`/api/tournaments/${id}`);
      } else {
        const err = await response.json();
        alert(`Erreur scrape: ${err.error || 'Scrape échoué'}`);
      }
    } catch (err) {
      console.error('Scrape failed:', err);
      alert('Erreur lors du scrape live');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    if (!tournament) return;
    setActionLoading('export');
    try {
      // Use the new CSV Export API
      const url = `/api/admin/export/tournament/${id}`;

      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `RPB_Export_${tournament.name.replace(/[^a-z0-9]/gi, '_')}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      alert("Une erreur est survenue lors de l'export");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ py: 4 }}>
        <Skeleton
          variant="rectangular"
          height={200}
          sx={{ borderRadius: 2, mb: 3 }}
        />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (error || !tournament) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">Tournoi introuvable</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          href="/admin"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          Admin
        </Link>
        <Link
          href="/admin/tournaments"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          Tournois
        </Link>
        <Typography
          sx={{
            color: 'text.primary',
          }}
        >
          {tournament.name}
        </Typography>
      </Breadcrumbs>
      {/* Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  {tournament.name}
                </Typography>
                <Chip
                  label={getStatusLabel(tournament.status)}
                  color={
                    getStatusColor(tournament.status) as
                      | 'info'
                      | 'warning'
                      | 'success'
                      | 'error'
                  }
                />
              </Box>

              {tournament.description && (
                <Typography
                  sx={{
                    color: 'text.secondary',
                    mb: 2,
                    maxWidth: 600,
                  }}
                >
                  {tournament.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarTodayIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {new Date(tournament.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>

                {tournament.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {tournament.location}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PeopleIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {tournament.participants.length} / {tournament.maxPlayers}{' '}
                    participants
                  </Typography>
                </Box>

                <Chip
                  label={tournament.format}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <ButtonGroup variant="outlined" size="small">
                {tournament.challongeId && tournament.status === 'UPCOMING' && (
                  <Button
                    startIcon={<PlayArrowIcon />}
                    onClick={() => handleAction('start')}
                    disabled={actionLoading !== null}
                    color="success"
                  >
                    {actionLoading === 'start' ? 'Démarrage...' : 'Démarrer'}
                  </Button>
                )}
                {tournament.challongeId && tournament.status === 'ONGOING' && (
                  <Button
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleAction('finalize')}
                    disabled={actionLoading !== null}
                    color="primary"
                  >
                    {actionLoading === 'finalize'
                      ? 'Finalisation...'
                      : 'Finaliser'}
                  </Button>
                )}
                {tournament.challongeId && (
                  <Button
                    startIcon={<SyncIcon />}
                    onClick={() => handleAction('sync')}
                    disabled={actionLoading !== null}
                    title="Sync Matchs"
                  >
                    {actionLoading === 'sync' ? 'Sync...' : 'Sync Matchs'}
                  </Button>
                )}
                {tournament.challongeId && (
                  <Button
                    startIcon={<PeopleOutlineIcon />}
                    onClick={() => handleAction('sync_participants')}
                    disabled={actionLoading !== null}
                    title="Sync Participants"
                  >
                    {actionLoading === 'sync_participants'
                      ? 'Sync...'
                      : 'Sync Part.'}
                  </Button>
                )}
              </ButtonGroup>

              {tournament.challongeUrl && (
                <Button
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  href={tournament.challongeUrl}
                  target="_blank"
                  rel="noopener"
                >
                  Challonge
                </Button>
              )}

              {tournament.challongeUrl && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<RadarIcon />}
                  onClick={handleScrapeLive}
                  disabled={actionLoading !== null}
                  color="warning"
                >
                  {actionLoading === 'scrape' ? 'Scraping...' : 'Scrape Live'}
                </Button>
              )}

              <Button
                size="small"
                variant="outlined"
                startIcon={<TableViewIcon />}
                onClick={handleExport}
                disabled={actionLoading !== null}
                color="success"
              >
                {actionLoading === 'export' ? 'Export...' : 'Exporter (Sheets)'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Bracket" />
        <Tab label={`Participants (${tournament.participants.length})`} />
        <Tab
          icon={<LeaderboardIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={`Classement (${liveData?.standings?.length ?? 0})`}
        />
        <Tab
          icon={<SensorsIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={`Stadiums (${liveData?.stations?.length ?? 0})`}
        />
        <Tab
          icon={<HistoryIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={`Journal (${liveData?.activityLog?.length ?? 0})`}
        />
      </Tabs>
      {/* Tab Panels */}
      {tab === 0 && (
        <Card>
          <CardContent>
            <TournamentBracket
              matches={tournament.matches}
              canReport={tournament.status === 'ONGOING'}
              onReportMatch={handleReportMatch}
            />
          </CardContent>
        </Card>
      )}
      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <ParticipantList
              participants={tournament.participants}
              maxPlayers={tournament.maxPlayers}
              canManage={tournament.status === 'UPCOMING'}
              onRemove={handleRemoveParticipant}
            />
          </Grid>
        </Grid>
      )}
      {/* Standings Tab */}
      {tab === 2 && (
        <Card>
          <CardContent>
            {liveData?.standings && liveData.standings.length > 0 ? (
              <Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 100px 100px',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                    }}
                  >
                    #
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                    }}
                  >
                    Joueur
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  >
                    W / L
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textAlign: 'right',
                    }}
                  >
                    Challonge
                  </Typography>
                </Box>
                {liveData.standings.map((s) => (
                  <Box
                    key={s.rank}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 100px 100px',
                      gap: 1,
                      px: 2,
                      py: 1,
                      alignItems: 'center',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Chip
                      label={s.rank}
                      size="small"
                      color={s.rank <= 3 ? 'primary' : 'default'}
                      sx={{ width: 32, fontWeight: 900 }}
                    />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        {s.name}
                      </Typography>
                      {s.challongeUsername && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          @{s.challongeUsername}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        textAlign: 'center',
                      }}
                    >
                      <strong style={{ color: '#4caf50' }}>{s.wins}</strong>
                      {' / '}
                      <strong style={{ color: '#f44336' }}>{s.losses}</strong>
                    </Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      {s.challongeProfileUrl && (
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          href={s.challongeProfileUrl}
                          target="_blank"
                          rel="noopener"
                          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                        >
                          Profil
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                Aucun classement disponible. Lancez un &quot;Scrape Live&quot;
                pour récupérer les données.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      {/* Stadiums Tab */}
      {tab === 3 && (
        <Grid container spacing={2}>
          {liveData?.stations && liveData.stations.length > 0 ? (
            liveData.stations.map((station) => {
              const isActive = station.status === 'active';
              const isPaused = station.status === 'paused';
              return (
                <Grid key={station.stationId} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      border: '2px solid',
                      borderColor: isActive
                        ? 'success.main'
                        : isPaused
                          ? 'warning.main'
                          : 'divider',
                    }}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 800,
                          }}
                        >
                          {station.name}
                        </Typography>
                        <Chip
                          icon={<FiberManualRecordIcon sx={{ fontSize: 8 }} />}
                          label={
                            isActive ? 'En cours' : isPaused ? 'Pause' : 'Libre'
                          }
                          size="small"
                          color={
                            isActive
                              ? 'success'
                              : isPaused
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </Box>
                      {station.currentMatch ? (
                        <Box
                          sx={{
                            p: 1.5,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              textAlign: 'center',
                            }}
                          >
                            {station.currentMatch.player1 ?? '???'}{' '}
                            <Chip
                              label={station.currentMatch.scores || 'VS'}
                              size="small"
                              color="primary"
                              sx={{ fontWeight: 900, mx: 1 }}
                            />{' '}
                            {station.currentMatch.player2 ?? '???'}
                          </Typography>
                          {station.currentMatch.round !== 0 && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                textAlign: 'center',
                                display: 'block',
                                mt: 0.5,
                              }}
                            >
                              Round {station.currentMatch.round}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            textAlign: 'center',
                          }}
                        >
                          Aucun match
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          ) : (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                Aucun stadium disponible. Lancez un &quot;Scrape Live&quot; pour
                récupérer les données.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}
      {/* Activity Log Tab */}
      {tab === 4 && (
        <Card>
          <CardContent>
            {liveData?.activityLog && liveData.activityLog.length > 0 ? (
              <Box>
                {liveData.activityLog.map((entry, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      py: 1,
                      borderBottom:
                        i < liveData.activityLog.length - 1
                          ? '1px solid'
                          : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        minWidth: 60,
                        flexShrink: 0,
                      }}
                    >
                      {entry.timestamp ? formatLogTime(entry.timestamp) : '—'}
                    </Typography>
                    <Chip
                      label={entry.type}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.65rem',
                        height: 20,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {entry.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                Aucun journal disponible. Lancez un &quot;Scrape Live&quot; pour
                récupérer les données.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      {/* Last updated */}
      {liveData?.lastUpdated && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            mt: 2,
            textAlign: 'right',
          }}
        >
          Dernière mise à jour live :{' '}
          {new Date(liveData.lastUpdated).toLocaleString('fr-FR')}
        </Typography>
      )}
    </Box>
  );
}

function formatLogTime(ts: string): string {
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}
