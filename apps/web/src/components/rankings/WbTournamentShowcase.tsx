'use client';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

/* ─── Tournament Themes & Rules ─── */

interface TournamentInfo {
  number: number;
  name: string;
  theme: string;
  description: string;
  rules: string[];
  color: string;
  icon: string;
  participants: number;
  winner: string;
  format: string;
}

const TOURNAMENTS: TournamentInfo[] = [
  {
    number: 1,
    name: 'Ultime Bataille #1',
    theme: 'La Genèse',
    description:
      "Le tout premier tournoi Ultime Bataille de Wild Breakers. L'événement fondateur qui a lancé la scène compétitive Beyblade X en France.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#f7d301',
    icon: '⚡',
    participants: 28,
    winner: 'Vergil Yorel',
    format: 'Double Élimination',
  },
  {
    number: 2,
    name: 'Ultime Bataille #2',
    theme: 'Le Retour',
    description:
      "Deuxième édition avec une croissance immédiate. 10 nouveaux joueurs rejoignent l'arène pour un bracket plus compétitif.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#e68002',
    icon: '🔥',
    participants: 38,
    winner: 'Younsi',
    format: 'Double Élimination',
  },
  {
    number: 3,
    name: 'Ultime Bataille #3',
    theme: 'La Confirmation',
    description:
      'Le tournoi qui a confirmé la régularité de la série. Yorel signe un doublé historique avec sa deuxième victoire.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#ce0c07',
    icon: '🏆',
    participants: 38,
    winner: 'Yorel',
    format: 'Double Élimination',
  },
  {
    number: 4,
    name: 'Ultime Bataille #4',
    theme: 'Nouvel Horizon',
    description:
      "Lunar s'impose pour la première fois et ouvre la voie à de nouveaux champions. La méta commence à se diversifier.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#3b82f6',
    icon: '🌙',
    participants: 37,
    winner: 'Lunar',
    format: 'Double Élimination',
  },
  {
    number: 5,
    name: 'Ultime Bataille #5',
    theme: 'Le Cinquième Élément',
    description:
      "40 joueurs franchissent la barre pour la première fois. Narugo domine avec un parcours quasi-parfait dans le winner's bracket.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#22c55e',
    icon: '🌿',
    participants: 40,
    winner: 'Narugo',
    format: 'Double Élimination',
  },
  {
    number: 6,
    name: 'Ultime Bataille #6',
    theme: 'Le Chaos',
    description:
      "Yuto s'impose dans un bracket particulièrement imprévisible. De nombreux upsets et un loser's bracket épique.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#a855f7',
    icon: '🌀',
    participants: 39,
    winner: 'Yuto',
    format: 'Double Élimination',
  },
  {
    number: 7,
    name: 'Ultime Bataille #7',
    theme: 'La Montée en Puissance',
    description:
      "Record de 43 participants. Leirya s'impose dans le tournoi le plus compétitif à date et marque l'arrivée de la série UX.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#ec4899',
    icon: '⚔️',
    participants: 43,
    winner: 'Leirya',
    format: 'Double Élimination',
  },
  {
    number: 8,
    name: 'Ultime Bataille #8',
    theme: "L'Ère Xymore",
    description:
      'Début de la domination Xymore. Une victoire clinique et méthodique qui annonce un règne de deux tournois consécutifs.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#06b6d4',
    icon: '💎',
    participants: 37,
    winner: 'Xymore',
    format: 'Double Élimination',
  },
  {
    number: 9,
    name: 'Ultime Bataille #9',
    theme: 'Le Doublé',
    description:
      '50 joueurs — nouveau record ! Xymore confirme avec un deuxième titre consécutif. Le premier joueur à réaliser un doublé depuis Yorel.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#06b6d4',
    icon: '👑',
    participants: 50,
    winner: 'Xymore',
    format: 'Double Élimination',
  },
  {
    number: 10,
    name: 'Ultime Bataille #10',
    theme: 'Le Cap des 10',
    description:
      "Dixième édition historique. Shishi met fin à la série Xymore et s'inscrit au palmarès dans un tournoi anniversaire mémorable.",
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#f59e0b',
    icon: '🔟',
    participants: 45,
    winner: 'Shishi',
    format: 'Double Élimination',
  },
  {
    number: 11,
    name: 'Ultime Bataille #11',
    theme: 'Le Renouveau',
    description:
      'Fred surprend tout le monde avec une victoire inattendue. Le tournoi le plus ouvert de la saison avec un bracket compact de 32 joueurs.',
    rules: ['Double Élimination', '4 Points pour gagner', '1on1'],
    color: '#84cc16',
    icon: '🌱',
    participants: 32,
    winner: 'Fred',
    format: 'Double Élimination',
  },
  {
    number: 12,
    name: 'Ultime Bataille #12',
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
    winner: 'Philouragan',
    format: 'Double Élimination',
  },
  {
    number: 13,
    name: 'Ultime Bataille #13',
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
    winner: 'Lewis 973',
    format: 'Double Élimination',
  },
];

/* ─── Component ─── */

export function WbTournamentShowcase() {
  return (
    <Box sx={{ mb: 4 }}>
      {/* Section header */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mb: 2,
        }}
      >
        <SportsKabaddiIcon sx={{ fontSize: 18, color: 'var(--rpb-primary)' }} />
        <Typography
          variant="overline"
          sx={{
            fontWeight: 900,
            letterSpacing: 1.5,
            color: 'var(--rpb-primary)',
            fontSize: '0.65rem',
          }}
        >
          Tous les Tournois
        </Typography>
        <Chip
          label={`${TOURNAMENTS.length} éditions`}
          size="small"
          sx={{
            fontWeight: 800,
            fontSize: '0.6rem',
            height: 20,
            bgcolor: alpha('#fff', 0.05),
            color: alpha('#fff', 0.5),
          }}
        />
      </Stack>
      {/* Tournament Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: '1fr 1fr 1fr',
          },
          gap: 2,
        }}
      >
        {[...TOURNAMENTS].reverse().map((t) => (
          <Paper
            key={t.number}
            elevation={0}
            sx={{
              p: 0,
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: '#0a0a0a',
              border: '1px solid',
              borderColor: alpha(t.color, 0.15),
              transition: 'all 0.25s ease',
              '&:hover': {
                borderColor: alpha(t.color, 0.4),
                transform: 'translateY(-3px)',
                boxShadow: `0 8px 25px ${alpha(t.color, 0.15)}`,
              },
            }}
          >
            {/* Top accent bar */}
            <Box
              sx={{
                height: 3,
                background: `linear-gradient(90deg, ${t.color}, ${alpha(t.color, 0.3)})`,
              }}
            />

            {/* Header row */}
            <Box
              sx={{
                px: 2,
                pt: 1.5,
                pb: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>
                  {t.icon}
                </Typography>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      color: t.color,
                      letterSpacing: 1,
                      fontSize: '0.6rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    UB #{t.number}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 900,
                      color: '#f5f0f0',
                      fontSize: '0.85rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {t.theme}
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={t.format.split(' ')[0]}
                size="small"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.55rem',
                  height: 18,
                  bgcolor: alpha(t.color, 0.1),
                  color: alpha(t.color, 0.8),
                }}
              />
            </Box>

            {/* Description */}
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: alpha('#fff', 0.45),
                  fontSize: '0.72rem',
                  lineHeight: 1.55,
                  minHeight: 44,
                }}
              >
                {t.description}
              </Typography>
            </Box>

            {/* Rules chips */}
            <Box
              sx={{
                px: 2,
                pb: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              {t.rules.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.55rem',
                    height: 18,
                    bgcolor: alpha('#fff', 0.04),
                    color: alpha('#fff', 0.4),
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Box>

            {/* Footer stats */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: '1px solid',
                borderColor: alpha('#fff', 0.04),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Stack direction="row" spacing={2}>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <GroupsIcon
                    sx={{ fontSize: 13, color: alpha('#fff', 0.3) }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: alpha('#fff', 0.5),
                      fontSize: '0.65rem',
                    }}
                  >
                    {t.participants}
                  </Typography>
                </Stack>
              </Stack>

              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: 'center',
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: 13, color: t.color }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 900,
                    color: t.color,
                    fontSize: '0.7rem',
                  }}
                >
                  {t.winner}
                </Typography>
              </Stack>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
