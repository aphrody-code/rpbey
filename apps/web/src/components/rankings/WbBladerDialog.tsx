'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { type WbBlader } from '@/lib/types';
import {
  getWbPlayerTournamentMatches,
  getWbTournamentMeta,
  getWbTournamentTop10,
} from '@/server/actions/wb';

interface MatchDetail {
  opponent: string;
  scores: string;
  won: boolean;
  round: number;
}

interface TournamentExpandData {
  top10: Array<{ rank: number; name: string }>;
  matches: MatchDetail[];
  participantsCount: number;
  format: string;
}

interface WbBladerDialogProps {
  blader: WbBlader | null;
  open: boolean;
  onClose: () => void;
}

export function WbBladerDialog({ blader, open, onClose }: WbBladerDialogProps) {
  const [expandedTournament, setExpandedTournament] = useState<string | null>(
    null,
  );
  const [expandData, setExpandData] = useState<TournamentExpandData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  if (!blader) return null;

  const history = blader.history as Array<{
    tournament: string;
    wins: number;
    losses: number;
    rank?: number;
  }>;
  const totalMatches = blader.totalWins + blader.totalLosses;
  const winrate =
    totalMatches > 0
      ? ((blader.totalWins / totalMatches) * 100).toFixed(1)
      : '0';

  const HS_DISPLAY_NAMES: Record<string, string> = {
    wb_hs_patoo: 'HS: Défi Patoo',
    wb_hs_phase2: 'HS: Phase 2',
  };

  const formatTournamentLabel = (slug: string) => {
    if (HS_DISPLAY_NAMES[slug]) return HS_DISPLAY_NAMES[slug];
    const ubMatch = slug.match(/wb_ub(\d+)/);
    if (ubMatch?.[1]) return `UB ${ubMatch[1]}`;
    return slug.toUpperCase().replace('_', ' ');
  };

  const getChallongeUrl = (tournamentSlug: string) => {
    const slug = tournamentSlug.toLowerCase();
    return `https://challonge.com/fr/${slug}`;
  };

  const handleToggleExpand = async (slug: string) => {
    if (expandedTournament === slug) {
      setExpandedTournament(null);
      return;
    }

    setExpandedTournament(slug);
    setLoading(true);
    setExpandData(null);

    const [top10Res, matchesRes, metaRes] = await Promise.all([
      getWbTournamentTop10(slug),
      getWbPlayerTournamentMatches(slug, blader.name),
      getWbTournamentMeta(slug),
    ]);

    setExpandData({
      top10: top10Res.success && top10Res.data ? top10Res.data : [],
      matches: matchesRes.success && matchesRes.data ? matchesRes.data : [],
      participantsCount: metaRes.success
        ? (metaRes.data?.participantsCount ?? 0)
        : 0,
      format: metaRes.success ? (metaRes.data?.format ?? '') : '',
    });
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: { sx: { borderRadius: 3 } },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
          }}
        >
          Parcours : {blader.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Winrate
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                {winrate}%
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Matchs
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                {totalMatches}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Tournois
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                {blader.tournamentsCount}
              </Typography>
            </Box>
          </Stack>

          {blader.linkedUserId && (
            <Button
              variant="outlined"
              startIcon={<AccountCircleIcon />}
              component={Link}
              href={`/profile/${blader.linkedUserId}`}
              fullWidth
              sx={{ mb: 2, borderRadius: 2, textTransform: 'none' }}
            >
              Voir le Profil RPB
            </Button>
          )}

          <Divider />
        </Box>
        <List sx={{ pt: 0, maxHeight: 500, overflow: 'auto' }}>
          {history
            .slice()
            .reverse()
            .map((h, index) => (
              <Box key={index}>
                <ListItem
                  divider={
                    !expandedTournament || expandedTournament !== h.tournament
                  }
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleToggleExpand(h.tournament)}
                  secondaryAction={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: 'center',
                      }}
                    >
                      <IconButton
                        size="small"
                        component="a"
                        href={getChallongeUrl(h.tournament)}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <OpenInNewIcon sx={{ fontSize: 18, opacity: 0.5 }} />
                      </IconButton>
                      {expandedTournament === h.tournament ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )}
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={formatTournamentLabel(h.tournament)}
                    secondary={`${h.wins}W - ${h.losses}L`}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                        },
                      },
                    }}
                  />
                  <Chip
                    label={`#${h.rank || '?'}`}
                    size="small"
                    color={h.rank && h.rank <= 3 ? 'warning' : 'default'}
                    sx={{
                      fontWeight: 'bold',
                      mr: 2,
                      minWidth: 45,
                      bgcolor:
                        h.rank === 1
                          ? '#FFD700'
                          : h.rank === 2
                            ? '#C0C0C0'
                            : h.rank === 3
                              ? '#CD7F32'
                              : undefined,
                      color: h.rank && h.rank <= 3 ? 'black' : 'inherit',
                    }}
                  />
                </ListItem>

                <Collapse
                  in={expandedTournament === h.tournament}
                  timeout="auto"
                  unmountOnExit
                >
                  <Box
                    sx={{
                      bgcolor: 'action.hover',
                      px: 2,
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {loading ? (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          py: 2,
                        }}
                      >
                        <CircularProgress size={20} />
                      </Box>
                    ) : expandData ? (
                      <>
                        {expandData.participantsCount > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: 'text.secondary',
                              mb: 1,
                              fontWeight: 600,
                            }}
                          >
                            {expandData.participantsCount} participants
                            {expandData.format ? ` • ${expandData.format}` : ''}
                          </Typography>
                        )}

                        {expandData.matches.length > 0 && (
                          <>
                            <Typography
                              variant="overline"
                              sx={{
                                fontWeight: 900,
                                color: 'primary.main',
                                mb: 0.5,
                                display: 'block',
                              }}
                            >
                              Matchs
                            </Typography>
                            <Stack spacing={0.25} sx={{ mb: 1.5 }}>
                              {expandData.matches.map((m, i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.25,
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: '0.8rem',
                                      color: m.won
                                        ? 'success.main'
                                        : 'error.main',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {m.won ? 'W' : 'L'} vs {m.opponent}
                                  </Typography>
                                  <Chip
                                    label={m.scores}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                      height: 20,
                                      borderColor: m.won
                                        ? 'success.main'
                                        : 'error.main',
                                      color: m.won
                                        ? 'success.main'
                                        : 'error.main',
                                    }}
                                  />
                                </Box>
                              ))}
                            </Stack>
                          </>
                        )}

                        <Typography
                          variant="overline"
                          sx={{
                            fontWeight: 900,
                            color: 'primary.main',
                            mb: 0.5,
                            display: 'block',
                          }}
                        >
                          Top 10 du tournoi
                        </Typography>
                        <Stack spacing={0.5}>
                          {expandData.top10.map((top, i) => (
                            <Box
                              key={i}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight:
                                    top.name === blader.name ? 900 : 500,
                                  color:
                                    top.name === blader.name
                                      ? 'primary.main'
                                      : 'inherit',
                                }}
                              >
                                {top.rank}. {top.name}
                              </Typography>
                              {top.rank === 1 && (
                                <Typography sx={{ fontSize: '0.8rem' }}>
                                  🏆
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </>
                    ) : null}
                  </Box>
                </Collapse>
              </Box>
            ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
