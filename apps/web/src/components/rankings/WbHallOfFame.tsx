'use client';

import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Modal,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { TrophyIcon } from '@/components/ui/Icons';
import { getWbTournamentTop10 } from '@/server/actions/wb';

interface Champion {
  tournament: string;
  winner: string;
  date: string;
}

interface WbTournamentMeta {
  slug: string;
  ubNumber: number;
  label: string;
  participantsCount: number;
  matchesCount: number;
  format: string;
  isHorsSerie?: boolean;
}

interface TournamentInfo {
  theme: string;
  description: string;
  rules: string[];
  color: string;
  icon: string;
  participants: number;
}

/* ─── Tournament Themes & Info ─── */

const TOURNAMENT_INFO: Record<number, TournamentInfo> = {
  1: {
    theme: 'La Genèse',
    description:
      "Le tout premier tournoi Ultime Bataille de Wild Breakers. L'événement fondateur qui a lancé la scène compétitive Beyblade X en France.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#f7d301',
    icon: '⚡',
    participants: 28,
  },
  2: {
    theme: 'Le Retour',
    description:
      "Deuxième édition avec une croissance immédiate. 10 nouveaux joueurs rejoignent l'arène pour un bracket plus compétitif.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#e68002',
    icon: '🔥',
    participants: 38,
  },
  3: {
    theme: 'La Confirmation',
    description:
      'Le tournoi qui a confirmé la régularité de la série. Yorel signe un doublé historique avec sa deuxième victoire.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#ce0c07',
    icon: '🏆',
    participants: 38,
  },
  4: {
    theme: 'Nouvel Horizon',
    description:
      "Lunar s'impose pour la première fois et ouvre la voie à de nouveaux champions. La méta commence à se diversifier.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#3b82f6',
    icon: '🌙',
    participants: 37,
  },
  5: {
    theme: 'Le Cinquième Élément',
    description:
      "40 joueurs franchissent la barre pour la première fois. Narugo domine avec un parcours quasi-parfait dans le winner's bracket.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#22c55e',
    icon: '🌿',
    participants: 40,
  },
  6: {
    theme: 'Le Chaos',
    description:
      "Yuto s'impose dans un bracket particulièrement imprévisible. De nombreux upsets et un loser's bracket épique.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#a855f7',
    icon: '🌀',
    participants: 39,
  },
  7: {
    theme: 'La Montée en Puissance',
    description:
      "Record de 43 participants. Leirya s'impose dans le tournoi le plus compétitif à date et marque l'arrivée de la série UX.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#ec4899',
    icon: '⚔️',
    participants: 43,
  },
  8: {
    theme: "L'Ère Xymore",
    description:
      'Début de la domination Xymore. Une victoire clinique et méthodique qui annonce un règne de deux tournois consécutifs.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#06b6d4',
    icon: '💎',
    participants: 37,
  },
  9: {
    theme: 'Le Doublé',
    description:
      '50 joueurs — nouveau record ! Xymore confirme avec un deuxième titre consécutif. Le premier joueur à réaliser un doublé depuis Yorel.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#06b6d4',
    icon: '👑',
    participants: 50,
  },
  10: {
    theme: 'Le Cap des 10',
    description:
      "Dixième édition historique. Shishi met fin à la série Xymore et s'inscrit au palmarès dans un tournoi anniversaire mémorable.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#f59e0b',
    icon: '🔟',
    participants: 45,
  },
  11: {
    theme: 'Le Renouveau',
    description:
      'Fred surprend tout le monde avec une victoire inattendue. Le tournoi le plus ouvert de la saison avec un bracket compact de 32 joueurs.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#84cc16',
    icon: '🌱',
    participants: 32,
  },
  12: {
    theme: 'Beytise 3',
    description:
      'Le plus grand tournoi à ce jour : 67 joueurs ! Édition spéciale crossover « Beytise 3 ». Philouragan domine un bracket massif.',
    rules: [
      'Double Élimination',
      '4 Points pour gagner',
      '1on1',
      'Édition spéciale',
    ],
    color: '#ef4444',
    icon: '🎪',
    participants: 67,
  },
  13: {
    theme: 'Harmonie et Résonance',
    description:
      "Lewis 973 s'impose dans un tournoi thématique axé sur l'harmonie entre Blade et Ratchet. 46 joueurs pour un bracket équilibré.",
    rules: [
      'Double Élimination',
      '4 Points pour gagner',
      '1on1',
      'Thème : Harmonie',
    ],
    color: '#8b5cf6',
    icon: '🎵',
    participants: 46,
  },
};

function getUbNumber(tournament: string): number {
  const match = tournament.match(/(\d+)$/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

/* ─── Props ─── */

interface WbHallOfFameProps {
  champions: Champion[];
  tournamentMetas?: WbTournamentMeta[];
}

export function WbHallOfFame({
  champions,
  tournamentMetas = [],
}: WbHallOfFameProps) {
  const _getMetaForChampion = (tournament: string) => {
    const slug = tournament.toLowerCase().replace('_', '_');
    return tournamentMetas.find((m) => m.slug === slug);
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openTop10, setOpenTop10] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(
    null,
  );
  const [top10Data, setTop10Data] = useState<
    Array<{ rank: number; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const handleChampionClick = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', name);
    params.set('view', 'career');
    params.set('page', '1');
    router.push(`/tournaments/wb?${params.toString()}`);
  };

  const handleShowTop10 = async (slug: string) => {
    setSelectedTournament(slug);
    setOpenTop10(true);
    setLoading(true);
    const res = await getWbTournamentTop10(slug);
    if (res.success && res.data) {
      setTop10Data(res.data);
    }
    setLoading(false);
  };

  // Get info for modal
  const selectedUbNumber = selectedTournament
    ? getUbNumber(selectedTournament)
    : 0;
  const selectedInfo = TOURNAMENT_INFO[selectedUbNumber];
  const selectedChampion = champions.find(
    (c) => c.tournament === selectedTournament,
  );

  return (
    <Box sx={{ mb: 4 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mb: 1.5,
          px: 1,
        }}
      >
        <Box sx={{ display: 'flex', color: 'primary.main' }}>
          <TrophyIcon size={18} />
        </Box>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 900,
            letterSpacing: 1.5,
            color: 'primary.main',
            fontSize: '0.65rem',
          }}
        >
          Hall of Fame
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          overflowX: 'auto',
          pb: 2,
          px: 1,
          pt: 0.5,
          '&::-webkit-scrollbar': { height: '3px' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(var(--rpb-primary-rgb), 0.3)',
            borderRadius: 0,
          },
          maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
        }}
      >
        {champions.map((c, i) => {
          const meta = _getMetaForChampion(c.tournament);
          const ubNum = getUbNumber(c.tournament);
          const info = TOURNAMENT_INFO[ubNum];
          return (
            <Box
              key={i}
              component={motion.div}
              whileHover={{ y: -4, scale: 1.02 }}
              sx={{
                p: 1.5,
                minWidth: 160,
                borderRadius: 3,
                position: 'relative',
                background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)',
                border: '1px solid',
                borderColor: info
                  ? alpha(info.color, 0.25)
                  : 'rgba(var(--rpb-primary-rgb), 0.2)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: info
                    ? `linear-gradient(90deg, ${info.color}, ${alpha(info.color, 0.3)})`
                    : 'linear-gradient(90deg, transparent, var(--rpb-primary), transparent)',
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -10,
                  right: -10,
                  opacity: 0.05,
                  transform: 'rotate(15deg)',
                  color: 'primary.main',
                }}
              >
                <TrophyIcon size={60} />
              </Box>
              {/* Theme icon + UB number */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mb: 0.5,
                }}
              >
                {info && (
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>
                    {info.icon}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: info
                      ? info.color
                      : 'rgba(var(--rpb-primary-rgb), 0.7)',
                    fontWeight: 900,
                    fontSize: '0.6rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {c.date}
                </Typography>
              </Box>
              {/* Theme name */}
              {info && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: alpha('#fff', 0.4),
                    fontWeight: 700,
                    fontSize: '0.55rem',
                    mb: 0.5,
                    fontStyle: 'italic',
                  }}
                >
                  {info.theme}
                </Typography>
              )}
              {/* Winner name */}
              <Typography
                variant="body2"
                onClick={() => handleChampionClick(c.winner)}
                sx={{
                  fontWeight: '900',
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',

                  '&:hover': {
                    color: info ? info.color : 'primary.main',
                  },
                }}
              >
                {c.winner}
              </Typography>
              {/* Participants */}
              {(meta || info) && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 700,
                    fontSize: '0.55rem',
                    mt: 0.25,
                  }}
                >
                  {meta?.participantsCount || info?.participants} participants
                </Typography>
              )}
              <Button
                size="small"
                fullWidth
                variant="text"
                onClick={() => handleShowTop10(c.tournament)}
                sx={{
                  mt: 0.5,
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  color: info
                    ? alpha(info.color, 0.6)
                    : 'rgba(255,255,255,0.3)',
                  minHeight: 0,
                  p: 0,
                  '&:hover': {
                    color: info ? info.color : 'primary.main',
                    bgcolor: 'transparent',
                  },
                }}
              >
                TOP 10 & INFOS
              </Button>
            </Box>
          );
        })}
      </Stack>
      {/* ── Modal: Tournament Info + Top 10 ── */}
      <Modal
        open={openTop10}
        onClose={() => setOpenTop10(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper
          sx={{
            p: 0,
            width: '100%',
            maxWidth: 420,
            borderRadius: 4,
            bgcolor: '#111',
            border: '1px solid',
            borderColor: selectedInfo
              ? alpha(selectedInfo.color, 0.2)
              : 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Tournament Header */}
          {selectedInfo && (
            <Box
              sx={{
                p: 2.5,
                pb: 2,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(ellipse at 30% 50%, ${alpha(selectedInfo.color, 0.12)} 0%, transparent 70%)`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${selectedInfo.color}, ${alpha(selectedInfo.color, 0.3)})`,
                },
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Close button */}
                <IconButton
                  onClick={() => setOpenTop10(false)}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>

                {/* Icon + UB label */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem' }}>
                    {selectedInfo.icon}
                  </Typography>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 900,
                        color: selectedInfo.color,
                        letterSpacing: 1.5,
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      UB #{selectedUbNumber}
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 900,
                        color: '#f5f0f0',
                        lineHeight: 1.2,
                        fontSize: '1.1rem',
                      }}
                    >
                      {selectedInfo.theme}
                    </Typography>
                  </Box>
                </Box>

                {/* Description */}
                <Typography
                  variant="body2"
                  sx={{
                    color: alpha('#fff', 0.5),
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    mb: 1.5,
                  }}
                >
                  {selectedInfo.description}
                </Typography>

                {/* Rules chips */}
                <Box
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}
                >
                  {selectedInfo.rules.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.6rem',
                        height: 22,
                        bgcolor: alpha(selectedInfo.color, 0.1),
                        color: alpha(selectedInfo.color, 0.8),
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ))}
                </Box>

                {/* Stats row */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      alignItems: 'center',
                    }}
                  >
                    <GroupsIcon
                      sx={{ fontSize: 14, color: alpha('#fff', 0.3) }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: alpha('#fff', 0.5),
                        fontSize: '0.7rem',
                      }}
                    >
                      {selectedInfo.participants} joueurs
                    </Typography>
                  </Stack>
                  {selectedChampion && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{
                        alignItems: 'center',
                      }}
                    >
                      <EmojiEventsIcon
                        sx={{ fontSize: 14, color: selectedInfo.color }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 900,
                          color: selectedInfo.color,
                          fontSize: '0.7rem',
                        }}
                      >
                        {selectedChampion.winner}
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {/* Separator */}
          <Box
            sx={{
              height: 1,
              bgcolor: selectedInfo
                ? alpha(selectedInfo.color, 0.1)
                : alpha('#fff', 0.05),
            }}
          />

          {/* Top 10 List */}
          <Box sx={{ p: 2.5, pt: 2 }}>
            <Typography
              variant="overline"
              sx={{
                fontWeight: 900,
                letterSpacing: 1.5,
                color: selectedInfo
                  ? alpha(selectedInfo.color, 0.7)
                  : 'rgba(var(--rpb-primary-rgb), 0.7)',
                fontSize: '0.6rem',
                display: 'block',
                mb: 1,
              }}
            >
              Top 10 Finalistes
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress
                  size={24}
                  sx={{ color: selectedInfo?.color || 'error.main' }}
                />
              </Box>
            ) : (
              <Stack spacing={0.5}>
                {top10Data.map((p) => (
                  <Box
                    key={p.rank}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 0.75,
                      px: 1.5,
                      borderRadius: 2,
                      bgcolor:
                        p.rank === 1
                          ? selectedInfo
                            ? alpha(selectedInfo.color, 0.1)
                            : 'rgba(var(--rpb-primary-rgb), 0.1)'
                          : p.rank <= 3
                            ? alpha('#fff', 0.03)
                            : 'transparent',
                      border:
                        p.rank === 1
                          ? `1px solid ${selectedInfo ? alpha(selectedInfo.color, 0.2) : 'rgba(var(--rpb-primary-rgb), 0.2)'}`
                          : '1px solid transparent',
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      {/* Rank badge */}
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor:
                            p.rank === 1
                              ? selectedInfo?.color || 'var(--rpb-primary)'
                              : p.rank === 2
                                ? '#C0C0C0'
                                : p.rank === 3
                                  ? '#CD7F32'
                                  : alpha('#fff', 0.06),
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          color: p.rank <= 3 ? '#000' : alpha('#fff', 0.5),
                        }}
                      >
                        {p.rank}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight:
                            p.rank === 1 ? 900 : p.rank <= 3 ? 700 : 500,
                          fontSize: '0.8rem',
                          color:
                            p.rank === 1
                              ? selectedInfo?.color || '#fff'
                              : '#fff',
                        }}
                      >
                        {p.name}
                      </Typography>
                    </Box>
                    {p.rank === 1 && (
                      <TrophyIcon
                        size={14}
                        color={selectedInfo?.color || 'var(--rpb-primary)'}
                      />
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
}
