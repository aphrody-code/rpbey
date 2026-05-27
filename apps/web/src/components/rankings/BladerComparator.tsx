'use client';

import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import {
  Avatar,
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Slide,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { type TransitionProps } from '@mui/material/transitions';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import React, { forwardRef } from 'react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { type ProfileWithUser } from './RankingsTable';

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface BladerComparatorProps {
  selectedBladers: ProfileWithUser[];
  onRemove: (id: string) => void;
  onClear: () => void;
  currentPage: number;
  allProfiles: ProfileWithUser[];
}

const COLOR_B = '#3b82f6';

function CompareRadar({
  bladerA,
  bladerB,
  nameA,
  nameB,
}: {
  bladerA: ProfileWithUser;
  bladerB: ProfileWithUser;
  nameA: string;
  nameB: string;
}) {
  const totalA = bladerA.wins + bladerA.losses;
  const totalB = bladerB.wins + bladerB.losses;
  const wrA = totalA > 0 ? (bladerA.wins / totalA) * 100 : 0;
  const wrB = totalB > 0 ? (bladerB.wins / totalB) * 100 : 0;
  const maxPoints = Math.max(bladerA.rankingPoints, bladerB.rankingPoints, 1);
  const maxWins = Math.max(bladerA.wins, bladerB.wins, 1);
  const maxMatches = Math.max(totalA, totalB, 1);
  const maxTW = Math.max(bladerA.tournamentWins, bladerB.tournamentWins, 1);

  const data = [
    {
      stat: 'Points',
      A: (bladerA.rankingPoints / maxPoints) * 100,
      B: (bladerB.rankingPoints / maxPoints) * 100,
      fullMark: 100,
    },
    {
      stat: 'Victoires',
      A: (bladerA.wins / maxWins) * 100,
      B: (bladerB.wins / maxWins) * 100,
      fullMark: 100,
    },
    {
      stat: 'Matchs',
      A: (totalA / maxMatches) * 100,
      B: (totalB / maxMatches) * 100,
      fullMark: 100,
    },
    {
      stat: 'Win Rate',
      A: wrA,
      B: wrB,
      fullMark: 100,
    },
    {
      stat: 'Tournois',
      A: maxTW > 0 ? (bladerA.tournamentWins / maxTW) * 100 : 0,
      B: maxTW > 0 ? (bladerB.tournamentWins / maxTW) * 100 : 0,
      fullMark: 100,
    },
  ];

  return (
    <Box sx={{ width: '100%', height: { xs: 240, sm: 300 }, mx: 'auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{
              fill: 'rgba(255,255,255,0.6)',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <Radar
            name={nameA}
            dataKey="A"
            stroke="var(--rpb-primary)"
            fill="var(--rpb-primary)"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name={nameB}
            dataKey="B"
            stroke={COLOR_B}
            fill={COLOR_B}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
            iconType="circle"
            iconSize={8}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
}

const EXP_LABELS: Record<string, string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
  EXPERT: 'Expert',
  VETERAN: 'Vétéran',
};

const TYPE_LABELS: Record<string, string> = {
  ATTACK: 'Attaque',
  DEFENSE: 'Défense',
  STAMINA: 'Endurance',
  BALANCE: 'Équilibre',
};

function BladerDetailCard({
  blader,
  color,
  rank,
}: {
  blader: ProfileWithUser;
  color: string;
  rank: string | number;
}) {
  const total = blader.wins + blader.losses;
  const wr = total > 0 ? ((blader.wins / total) * 100).toFixed(1) : '0.0';

  const allDetails: {
    label: string;
    value: string | number | null | undefined;
  }[] = [
    { label: 'Rang', value: `#${rank}` },
    { label: 'Points', value: blader.rankingPoints || null },
    { label: 'Victoires', value: blader.wins || null },
    { label: 'Défaites', value: blader.losses || null },
    { label: 'Matchs', value: total || null },
    { label: 'Win Rate', value: total > 0 ? `${wr}%` : null },
    { label: 'Tournois gagnés', value: blader.tournamentWins || null },
    {
      label: 'Tournois joués',
      value: blader.user?._count?.tournaments || null,
    },
    {
      label: 'Type favori',
      value: blader.favoriteType
        ? TYPE_LABELS[blader.favoriteType] || blader.favoriteType
        : null,
    },
    {
      label: 'Niveau',
      value: blader.experience
        ? EXP_LABELS[blader.experience] || blader.experience
        : null,
    },
    { label: 'Challonge', value: blader.challongeUsername || null },
  ];

  const details = allDetails.filter((d) => d.value != null);

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: alpha(color, 0.04),
        border: '1px solid',
        borderColor: alpha(color, 0.15),
      }}
    >
      {details.map((d) => (
        <Box
          key={d.label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 0.4,
            '&:not(:last-child)': {
              borderBottom: '1px solid',
              borderColor: 'rgba(255,255,255,0.04)',
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              fontWeight: 600,
            }}
          >
            {d.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.75rem', sm: '0.8rem' },
              color: 'text.primary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {d.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function CompareTable({
  bladerA,
  bladerB,
}: {
  bladerA: ProfileWithUser;
  bladerB: ProfileWithUser;
}) {
  const totalA = bladerA.wins + bladerA.losses;
  const totalB = bladerB.wins + bladerB.losses;
  const wrA = totalA > 0 ? (bladerA.wins / totalA) * 100 : 0;
  const wrB = totalB > 0 ? (bladerB.wins / totalB) * 100 : 0;

  const rows = [
    {
      label: 'Points',
      valA: bladerA.rankingPoints,
      valB: bladerB.rankingPoints,
    },
    { label: 'Victoires', valA: bladerA.wins, valB: bladerB.wins },
    { label: 'Défaites', valA: bladerA.losses, valB: bladerB.losses },
    { label: 'Matchs', valA: totalA, valB: totalB },
    { label: 'Win Rate', valA: wrA, valB: wrB, suffix: '%', decimals: 1 },
    {
      label: 'Tournois gagnés',
      valA: bladerA.tournamentWins,
      valB: bladerB.tournamentWins,
    },
  ];

  return (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      {rows.map((row) => {
        const aWins = row.valA > row.valB;
        const bWins = row.valB > row.valA;
        const fmt = (v: number) =>
          row.decimals
            ? `${v.toFixed(row.decimals)}${row.suffix || ''}`
            : `${v}${row.suffix || ''}`;
        const diff = row.valA - row.valB;
        const diffStr =
          diff === 0
            ? '='
            : `${diff > 0 ? '+' : ''}${row.decimals ? diff.toFixed(row.decimals) : diff}${row.suffix || ''}`;

        return (
          <Box
            key={row.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              py: { xs: 0.6, sm: 0.8 },
              px: { xs: 1, sm: 1.5 },
              borderRadius: 1.5,
              '&:nth-of-type(odd)': {
                bgcolor: 'rgba(255,255,255,0.02)',
              },
            }}
          >
            <Typography
              sx={{
                flex: 1,
                textAlign: 'right',
                fontWeight: aWins ? 800 : 500,
                color: aWins ? 'primary.main' : 'text.secondary',
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(row.valA)}
            </Typography>
            <Box
              sx={{
                width: { xs: 90, sm: 120 },
                textAlign: 'center',
                flexShrink: 0,
                px: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {row.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.6rem', sm: '0.65rem' },
                  fontWeight: 600,
                  color: (t) =>
                    diff === 0
                      ? t.palette.text.disabled
                      : diff > 0
                        ? alpha(t.palette.primary.main, 0.7)
                        : alpha(COLOR_B, 0.7),
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {diffStr}
              </Typography>
            </Box>
            <Typography
              sx={{
                flex: 1,
                textAlign: 'left',
                fontWeight: bWins ? 800 : 500,
                color: bWins ? COLOR_B : 'text.secondary',
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(row.valB)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function BladerComparator({
  selectedBladers,
  onRemove,
  onClear,
  currentPage,
  allProfiles,
}: BladerComparatorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const canCompare = selectedBladers.length === 2;

  const getRank = (profile: ProfileWithUser) => {
    const index = allProfiles.findIndex((p) => p.id === profile.id);
    return index >= 0 ? (currentPage - 1) * 100 + index + 1 : '?';
  };

  if (selectedBladers.length === 0) return null;

  return (
    <>
      {/* Floating comparison bar */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            bottom: isMobile ? 90 : 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            width: isMobile ? 'calc(100% - 24px)' : 'auto',
            maxWidth: 560,
          }}
        >
          <Box
            sx={{
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(20px)',
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: { xs: 2.5, sm: 3 },
              px: { xs: 1.5, sm: 2 },
              py: { xs: 1, sm: 1.5 },
              boxShadow: `0 8px 32px ${alpha('#000', 0.5)}`,
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 1.5 },
            }}
          >
            <CompareArrowsIcon
              sx={{
                color: 'primary.main',
                fontSize: { xs: '1.1rem', sm: '1.3rem' },
                flexShrink: 0,
              }}
            />

            <Stack
              direction="row"
              spacing={0.5}
              sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}
            >
              {selectedBladers.map((blader) => (
                <Chip
                  key={blader.id}
                  label={blader.bladerName || blader.user?.name || 'Blader'}
                  avatar={
                    <Avatar
                      src={blader.user?.image || undefined}
                      sx={{ width: 20, height: 20 }}
                    />
                  }
                  onDelete={() => onRemove(blader.id)}
                  deleteIcon={
                    <RemoveCircleOutlineIcon
                      sx={{ fontSize: '0.9rem !important' }}
                    />
                  }
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    maxWidth: { xs: 120, sm: 160 },
                    height: { xs: 28, sm: 32 },
                    '& .MuiChip-label': {
                      fontSize: { xs: '0.7rem', sm: '0.8rem' },
                      px: { xs: 0.5, sm: 1 },
                    },
                  }}
                />
              ))}
              {selectedBladers.length === 1 && !isMobile && (
                <Chip
                  icon={<PersonIcon />}
                  label="2e blader..."
                  size="small"
                  variant="outlined"
                  sx={{
                    opacity: 0.5,
                    borderStyle: 'dashed',
                    height: { xs: 28, sm: 32 },
                    '& .MuiChip-label': {
                      fontSize: { xs: '0.7rem', sm: '0.8rem' },
                    },
                  }}
                />
              )}
            </Stack>

            <Button
              variant="contained"
              size="small"
              disabled={!canCompare}
              onClick={() => setDialogOpen(true)}
              startIcon={!isMobile ? <CompareArrowsIcon /> : undefined}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.5, sm: 0.75 },
                minWidth: { xs: 'auto', sm: 120 },
                fontSize: { xs: '0.75rem', sm: '0.8rem' },
              }}
            >
              {isMobile ? 'VS' : 'Comparer'}
            </Button>

            <IconButton
              size="small"
              onClick={onClear}
              sx={{ opacity: 0.5, p: { xs: 0.5, sm: 1 } }}
            >
              <CloseIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
            </IconButton>
          </Box>
        </motion.div>
      </AnimatePresence>
      {/* Comparison Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slots={{
          transition: Transition,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.default',
              backgroundImage: 'none',
              borderRadius: isMobile ? 0 : 3,
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '30%',
                background: (t) =>
                  `radial-gradient(ellipse at 50% -20%, ${alpha(t.palette.primary.main, 0.08)} 0%, transparent 70%)`,
                pointerEvents: 'none',
              },
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrowsIcon
              color="primary"
              sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,
                fontSize: { xs: '1rem', sm: '1.25rem' },
              }}
            >
              Comparaison
            </Typography>
          </Box>
          <IconButton onClick={() => setDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          {canCompare && (
            <Box>
              {/* Header with both bladers */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'space-around',
                  mb: { xs: 2, sm: 3 },
                  gap: { xs: 1, sm: 2 },
                }}
              >
                {selectedBladers.map((blader, idx) => {
                  const bladerColor =
                    idx === 0 ? theme.palette.primary.main : COLOR_B;
                  const rank = getRank(blader);
                  return (
                    <Box key={blader.id} sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                        <Link
                          href={
                            blader.userId ? `/profile/${blader.userId}` : '#'
                          }
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <Avatar
                            src={blader.user?.image || undefined}
                            sx={{
                              width: { xs: 48, sm: 68 },
                              height: { xs: 48, sm: 68 },
                              mx: 'auto',
                              mb: 0.5,
                              border: '2px solid',
                              borderColor: bladerColor,
                              boxShadow: `0 0 16px ${alpha(bladerColor, 0.25)}`,
                            }}
                          />
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{
                              fontWeight: 900,
                              fontSize: { xs: '0.8rem', sm: '0.95rem' },
                            }}
                          >
                            {blader.bladerName || blader.user?.name || 'Blader'}
                          </Typography>
                        </Link>
                        <Chip
                          icon={
                            <EmojiEventsIcon
                              sx={{ fontSize: '0.75rem !important' }}
                            />
                          }
                          label={`#${rank}`}
                          size="small"
                          sx={{
                            mt: 0.5,
                            height: 22,
                            bgcolor: alpha(bladerColor, 0.1),
                            color: bladerColor,
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </Box>
                      <BladerDetailCard
                        blader={blader}
                        color={bladerColor}
                        rank={rank}
                      />
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ mb: { xs: 2, sm: 3 } }} />

              {/* Stats comparison */}
              <CompareRadar
                bladerA={selectedBladers[0]!}
                bladerB={selectedBladers[1]!}
                nameA={
                  selectedBladers[0]?.bladerName ||
                  selectedBladers[0]?.user?.name ||
                  'Blader A'
                }
                nameB={
                  selectedBladers[1]?.bladerName ||
                  selectedBladers[1]?.user?.name ||
                  'Blader B'
                }
              />

              {/* Detailed stats table */}
              <CompareTable
                bladerA={selectedBladers[0]!}
                bladerB={selectedBladers[1]!}
              />

              {/* Summary */}
              <Box
                sx={{
                  mt: { xs: 2, sm: 3 },
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.1),
                  textAlign: 'center',
                }}
              >
                {(() => {
                  const a = selectedBladers[0]!;
                  const b = selectedBladers[1]!;
                  let scoreA = 0;
                  let scoreB = 0;
                  if (a.rankingPoints > b.rankingPoints) scoreA++;
                  else if (b.rankingPoints > a.rankingPoints) scoreB++;
                  if (a.wins > b.wins) scoreA++;
                  else if (b.wins > a.wins) scoreB++;
                  const totalA = a.wins + a.losses;
                  const totalB = b.wins + b.losses;
                  if (totalA > totalB) scoreA++;
                  else if (totalB > totalA) scoreB++;
                  const wrA = totalA > 0 ? a.wins / totalA : 0;
                  const wrB = totalB > 0 ? b.wins / totalB : 0;
                  if (wrA > wrB) scoreA++;
                  else if (wrB > wrA) scoreB++;
                  if (a.tournamentWins > b.tournamentWins) scoreA++;
                  else if (b.tournamentWins > a.tournamentWins) scoreB++;

                  const nameA = a.bladerName || a.user?.name || 'Blader A';
                  const nameB = b.bladerName || b.user?.name || 'Blader B';
                  const total = 5;

                  if (scoreA > scoreB) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        }}
                      >
                        <span style={{ color: 'var(--rpb-primary)' }}>
                          {nameA}
                        </span>{' '}
                        domine dans {scoreA}catégorie
                        {scoreA > 1 ? 's' : ''}sur {total}
                      </Typography>
                    );
                  }
                  if (scoreB > scoreA) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        }}
                      >
                        <span style={{ color: COLOR_B }}>{nameB}</span>domine
                        dans {scoreB}catégorie
                        {scoreB > 1 ? 's' : ''}sur {total}
                      </Typography>
                    );
                  }
                  return (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                      }}
                    >
                      Égalité parfaite !
                    </Typography>
                  );
                })()}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
