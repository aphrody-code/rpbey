'use client';

import {
  Add,
  FiberManualRecord,
  Launch,
  Refresh,
  Remove,
  RestartAlt,
  SwapHoriz,
  Videocam,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui';
import {
  getStreamPlayers,
  getStreamState,
  getTshStatus,
  resetStreamScores,
  setStreamMatch,
  swapStreamPlayers,
  updateStreamState,
} from '@/server/actions/stream';

const PHASES = [
  'Bey-Tamashii Séries',
  'Ultime Bataille',
  'Poules',
  'Phase finale',
  'Arbre Winner',
  'Arbre Loser',
  'Top 8',
  'Top 16',
  'Exhibition',
];

const MATCH_LABELS = [
  'Grande Finale',
  'Grande Finale - Reset',
  'Finale Winner',
  'Demi-finale Winner',
  'Quart de finale Winner',
  'Finale Loser',
  'Demi-finale Loser',
  'Tour 1 Winner',
  'Tour 2 Winner',
  'Tour 3 Winner',
  'Tour 1 Loser',
  'Tour 2 Loser',
  'Tour 3 Loser',
];

interface StreamState {
  score?: {
    '1'?: {
      team?: {
        '1'?: {
          player?: { '1'?: { name?: string; prefix?: string } };
          score?: number;
          color?: string;
        };
        '2'?: {
          player?: { '1'?: { name?: string; prefix?: string } };
          score?: number;
          color?: string;
        };
      };
      best_of?: number;
      phase?: string;
      match?: string;
    };
  };
  tournament?: {
    name?: string;
    format?: string;
    organizer?: string;
  };
}

export default function StreamConfigPage() {
  const toast = useToast();
  const [tshStatus, setTshStatus] = useState<{
    running: boolean;
    url: string;
  }>({ running: false, url: '' });
  const [, setState] = useState<StreamState | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [phase, setPhase] = useState('Bey-Tamashii Séries');
  const [match, setMatch] = useState('');
  const [bestOf, setBestOf] = useState(7);
  const [tournamentName, setTournamentName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statusRes, stateRes, playersRes] = await Promise.all([
      getTshStatus(),
      getStreamState(),
      getStreamPlayers(),
    ]);

    setTshStatus(statusRes);
    if (playersRes.ok) setPlayers(playersRes.players);

    if (stateRes.ok && stateRes.state) {
      const s = stateRes.state as StreamState;
      setState(s);

      const s1 = s.score?.['1'];
      if (s1) {
        const t1 = s1.team?.['1'];
        const t2 = s1.team?.['2'];
        const p1 = t1?.player?.['1'];
        const p2 = t2?.player?.['1'];

        if (p1?.name)
          setPlayer1(p1.prefix ? `${p1.prefix} | ${p1.name}` : p1.name);
        if (p2?.name)
          setPlayer2(p2.prefix ? `${p2.prefix} | ${p2.name}` : p2.name);
        setScore1(t1?.score ?? 0);
        setScore2(t2?.score ?? 0);
        if (s1.phase) setPhase(s1.phase);
        if (s1.match) setMatch(s1.match);
        if (s1.best_of) setBestOf(s1.best_of);
      }
      if (s.tournament?.name) setTournamentName(s.tournament.name);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const parsePlayerInput = (input: string) => {
    const pipeMatch = input.match(/^(.+?)\s*\|\s*(.+)$/);
    if (pipeMatch?.[1] && pipeMatch[2])
      return { prefix: pipeMatch[1].trim(), name: pipeMatch[2].trim() };
    return { prefix: '', name: input.trim() };
  };

  const handleApply = async () => {
    const p1 = parsePlayerInput(player1);
    const p2 = parsePlayerInput(player2);

    const res = await setStreamMatch({
      player1: p1.name,
      player2: p2.name,
      prefix1: p1.prefix,
      prefix2: p2.prefix,
      score1,
      score2,
      phase,
      match,
      bestOf,
    });

    if (res.ok) {
      toast.showToast('Match mis à jour');
      loadData();
    } else {
      toast.showError(res.error || 'Erreur');
    }
  };

  const handleSwap = async () => {
    const res = await swapStreamPlayers();
    if (res.ok) {
      toast.showToast('Joueurs inversés');
      loadData();
    } else {
      toast.showError('error' in res ? res.error || 'Erreur' : 'Erreur');
    }
  };

  const handleResetScores = async () => {
    const res = await resetStreamScores();
    if (res.ok) {
      toast.showToast('Scores réinitialisés');
      setScore1(0);
      setScore2(0);
    } else {
      toast.showError(res.error || 'Erreur');
    }
  };

  const handleUpdateTournament = async () => {
    const type = phase.includes('Tamashii')
      ? 'bts'
      : phase.includes('Ultime')
        ? 'wb'
        : 'standard';
    const res = await updateStreamState({
      tournament: {
        name: tournamentName,
        format:
          type === 'bts' ? '3on3 Double Élimination' : '1v1 Double Élimination',
        organizer:
          type === 'bts' ? 'RPB' : type === 'wb' ? 'Wild Breakers' : 'RPB',
      },
    });
    if (res.ok) {
      toast.showToast('Tournoi mis à jour');
    } else {
      toast.showError(res.error || 'Erreur');
    }
  };

  const handleScoreChange = async (team: '1' | '2', delta: number) => {
    const newScore =
      team === '1' ? Math.max(0, score1 + delta) : Math.max(0, score2 + delta);

    if (team === '1') setScore1(newScore);
    else setScore2(newScore);

    await updateStreamState({
      score: { '1': { team: { [team]: { score: newScore } } } },
    });
  };

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography>Chargement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 'bold',
            }}
          >
            <Videocam sx={{ mr: 1, verticalAlign: 'middle' }} />
            Configuration Stream
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Contrôlez le Tournament Stream Helper en temps réel
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip
            icon={<FiberManualRecord sx={{ fontSize: 12 }} />}
            label={tshStatus.running ? 'TSH Actif' : 'TSH Arrêté'}
            color={tshStatus.running ? 'success' : 'error'}
            variant="outlined"
          />
          <IconButton onClick={loadData} size="small">
            <Refresh />
          </IconButton>
        </Stack>
      </Stack>
      <Grid container spacing={3}>
        {/* ─── Scoreboard Control ─── */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: 'bold',
              }}
            >
              Scoreboard
            </Typography>

            {/* Score Display */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Player 1 */}
                <Stack
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    Joueur 1
                  </Typography>
                  <Typography
                    variant="h5"
                    noWrap
                    sx={{
                      fontWeight: '900',
                      color: 'primary.main',
                    }}
                  >
                    {player1 || '—'}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleScoreChange('1', -1)}
                      disabled={score1 <= 0}
                      sx={{
                        bgcolor: (theme) =>
                          alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <Remove fontSize="small" />
                    </IconButton>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: '900',
                        color: 'primary.main',
                        minWidth: 50,
                        textAlign: 'center',
                      }}
                    >
                      {score1}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleScoreChange('1', 1)}
                      sx={{
                        bgcolor: (theme) =>
                          alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>

                {/* VS / Swap */}
                <Stack
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 'bold',
                    }}
                  >
                    VS
                  </Typography>
                  <IconButton
                    onClick={handleSwap}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <SwapHoriz />
                  </IconButton>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<RestartAlt />}
                    onClick={handleResetScores}
                  >
                    Reset
                  </Button>
                </Stack>

                {/* Player 2 */}
                <Stack
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    Joueur 2
                  </Typography>
                  <Typography
                    variant="h5"
                    noWrap
                    sx={{
                      fontWeight: '900',
                      color: 'secondary.main',
                    }}
                  >
                    {player2 || '—'}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleScoreChange('2', -1)}
                      disabled={score2 <= 0}
                      sx={{
                        bgcolor: (theme) =>
                          alpha(theme.palette.secondary.main, 0.1),
                      }}
                    >
                      <Remove fontSize="small" />
                    </IconButton>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: '900',
                        color: 'secondary.main',
                        minWidth: 50,
                        textAlign: 'center',
                      }}
                    >
                      {score2}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleScoreChange('2', 1)}
                      sx={{
                        bgcolor: (theme) =>
                          alpha(theme.palette.secondary.main, 0.1),
                      }}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Stack>

              {/* Phase & Match */}
              <Divider sx={{ my: 2 }} />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'center',
                }}
              >
                <Chip
                  label={phase || 'Phase'}
                  color="primary"
                  variant="outlined"
                />
                <Chip label={match || 'Match'} variant="outlined" />
                <Chip label={`BO${bestOf}`} variant="outlined" />
              </Stack>
            </Paper>

            {/* Player Selection */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  freeSolo
                  options={players}
                  value={player1}
                  onInputChange={(_, v) => setPlayer1(v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Joueur 1 (Rouge)"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderColor: 'primary.main',
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  freeSolo
                  options={players}
                  value={player2}
                  onInputChange={(_, v) => setPlayer2(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Joueur 2 (Or)" size="small" />
                  )}
                />
              </Grid>
            </Grid>

            {/* Match Info */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Phase</InputLabel>
                  <Select
                    value={phase}
                    label="Phase"
                    onChange={(e) => setPhase(e.target.value)}
                  >
                    {PHASES.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Autocomplete
                  freeSolo
                  options={MATCH_LABELS}
                  value={match}
                  onInputChange={(_, v) => setMatch(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Match / Tour" size="small" />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Best Of</InputLabel>
                  <Select
                    value={bestOf}
                    label="Best Of"
                    onChange={(e) => setBestOf(Number(e.target.value))}
                  >
                    {[3, 5, 7, 9, 11].map((n) => (
                      <MenuItem key={n} value={n}>
                        BO{n} (FT{Math.ceil(n / 2)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Button
              variant="contained"
              fullWidth
              onClick={handleApply}
              sx={{
                py: 1.5,
                fontWeight: 700,
                fontSize: '1rem',
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              Appliquer le match
            </Button>
          </Paper>
        </Grid>

        {/* ─── Sidebar ─── */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            {/* TSH Status */}
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  TSH Status
                </Typography>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Statut
                    </Typography>
                    <Chip
                      size="small"
                      label={tshStatus.running ? 'En ligne' : 'Hors ligne'}
                      color={tshStatus.running ? 'success' : 'error'}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Port
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'bold',
                      }}
                    >
                      5000
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Joueurs
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'bold',
                      }}
                    >
                      {players.length}
                    </Typography>
                  </Stack>
                  {tshStatus.running && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Launch />}
                      href={tshStatus.url}
                      target="_blank"
                      fullWidth
                    >
                      Ouvrir les overlays
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Tournament Info */}
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Tournoi
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Nom du tournoi"
                    size="small"
                    fullWidth
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleUpdateTournament}
                    fullWidth
                  >
                    Mettre à jour
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Quick Presets */}
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Presets rapides
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setPhase('Bey-Tamashii Séries');
                      setBestOf(7);
                      toast.showInfo('Preset BTS chargé (BO7/FT4)');
                    }}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    Bey-Tamashii (BO7 / FT4)
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setPhase('Ultime Bataille');
                      setBestOf(5);
                      toast.showInfo('Preset WB chargé (BO5/FT3)');
                    }}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    Ultime Bataille (BO5 / FT3)
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setPhase('Grande Finale');
                      setBestOf(9);
                      toast.showInfo('Preset Grande Finale chargé (BO9/FT5)');
                    }}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    Grande Finale (BO9 / FT5)
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* API Links */}
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Liens API
                </Typography>
                <Stack spacing={1}>
                  <Alert
                    severity="info"
                    variant="outlined"
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <strong>Stream API</strong>
                    <br />
                    /api/stream — Liste tournois
                    <br />
                    /api/stream/[id] — Données TSH
                  </Alert>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<Launch />}
                    href="/api/stream"
                    target="_blank"
                  >
                    /api/stream
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
