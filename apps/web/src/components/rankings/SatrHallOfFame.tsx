'use client';

import CloseIcon from '@mui/icons-material/Close';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Modal,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { TrophyIcon } from '@/components/ui/Icons';
import { getTournamentTop10 } from '@/server/actions/satr';

interface Champion {
  tournament: string;
  winner: string;
  date: string;
}

interface TournamentMeta {
  slug: string;
  bbtNumber: number;
  participantsCount: number;
  matchesCount: number;
  format: string;
}

interface SatrHallOfFameProps {
  champions: Champion[];
  tournamentMetas?: TournamentMeta[];
}

export function SatrHallOfFame({
  champions,
  tournamentMetas = [],
}: SatrHallOfFameProps) {
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
    router.push(`/tournaments/satr?${params.toString()}`);
  };

  const handleShowTop10 = async (slug: string) => {
    setSelectedTournament(slug);
    setOpenTop10(true);
    setLoading(true);
    const res = await getTournamentTop10(slug);
    if (res.success && res.data) {
      setTop10Data(res.data);
    }
    setLoading(false);
  };

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
        <Box sx={{ display: 'flex', color: 'secondary.main' }}>
          <TrophyIcon size={18} />
        </Box>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 900,
            letterSpacing: 1.5,
            color: 'secondary.main',
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
            bgcolor: (t) => alpha(t.palette.secondary.main, 0.3),
            borderRadius: 0,
          },
          maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
        }}
      >
        {champions.map((c, i) => {
          const meta = _getMetaForChampion(c.tournament);
          return (
            <Box
              key={i}
              component={motion.div}
              whileHover={{ y: -4, scale: 1.02 }}
              sx={{
                p: 1.5,
                minWidth: 140,
                borderRadius: 3,
                position: 'relative',
                background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)',
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.secondary.main, 0.2),
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background:
                    'linear-gradient(90deg, transparent, var(--rpb-secondary), transparent)',
                  opacity: 0.4,
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
                  color: 'secondary.main',
                }}
              >
                <TrophyIcon size={60} />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: (t) => alpha(t.palette.secondary.main, 0.7),
                  fontWeight: 800,
                  mb: 0.25,
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                }}
              >
                {c.date}
              </Typography>
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
                  '&:hover': { color: 'secondary.main' },
                }}
              >
                {c.winner}
              </Typography>
              {meta && (
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
                  {meta.participantsCount} participants
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
                  color: 'rgba(255,255,255,0.3)',
                  minHeight: 0,
                  p: 0,
                  '&:hover': {
                    color: 'secondary.main',
                    bgcolor: 'transparent',
                  },
                }}
              >
                TOP 10
              </Button>
            </Box>
          );
        })}
      </Stack>
      <Modal
        open={openTop10}
        onClose={() => setOpenTop10(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper
          sx={{
            p: 2.5,
            width: '100%',
            maxWidth: 320,
            borderRadius: 4,
            bgcolor: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: '900',
                color: 'secondary.main',
                fontSize: '0.9rem',
                letterSpacing: 0.5,
              }}
            >
              TOP 10 • {selectedTournament?.replace('SATR_', '').toUpperCase()}
            </Typography>
            <IconButton
              onClick={() => setOpenTop10(false)}
              size="small"
              sx={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} color="warning" />
            </Box>
          ) : (
            <Stack spacing={0.75}>
              {top10Data.map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    p: 0.75,
                    px: 1.5,
                    borderRadius: 1.5,
                    bgcolor:
                      p.rank === 1
                        ? 'rgba(var(--rpb-secondary-rgb), 0.1)'
                        : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: p.rank === 1 ? 900 : 500,
                      fontSize: '0.8rem',
                    }}
                  >
                    {p.rank}. {p.name}
                  </Typography>
                  {p.rank === 1 && (
                    <TrophyIcon size={14} color="var(--rpb-secondary)" />
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Modal>
    </Box>
  );
}
