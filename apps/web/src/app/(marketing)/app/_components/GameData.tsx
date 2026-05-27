'use client';

import { Box, Card, CardContent, Chip, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

const SCORING = [
  {
    name: 'Xtreme Finish',
    points: 3,
    color: '#ef4444',
    desc: 'Le Bey adverse entre dans la zone Xtreme et ne peut pas revenir.',
  },
  {
    name: 'Over Finish',
    points: 2,
    color: '#f59e0b',
    desc: 'Le Bey adverse entre dans la zone Over et ne peut pas revenir.',
  },
  {
    name: 'Burst Finish',
    points: 2,
    color: '#a855f7',
    desc: 'Le Bey adverse éclate dans la zone de combat.',
  },
  {
    name: 'Spin Finish',
    points: 1,
    color: '#3b82f6',
    desc: "Le Bey adverse s'arrête de tourner dans la zone de combat.",
  },
  {
    name: 'Own Finish',
    points: 1,
    color: '#22c55e',
    desc: 'Xtreme/Over Finish sans que le Bey adverse ait touché le vôtre.',
  },
  {
    name: 'Penalty Point',
    points: 1,
    color: '#6b7280',
    desc: 'Erreur de lancement avec pénalité en cours.',
  },
];

const MATCH_TYPES = [
  {
    name: '4 Points',
    desc: 'Premier à 4 points — Format officiel',
    official: true,
  },
  { name: '5 Points', desc: 'Premier à 5 points', official: false },
  { name: '7 Points', desc: 'Premier à 7 points', official: false },
  {
    name: 'Best of 3 (4pts)',
    desc: '3 sets de 4 points, 2 sets pour gagner',
    official: true,
  },
];

const BATTLE_TYPES = [
  { name: '1on1', desc: 'Un seul Bey pour tout le match', official: true },
  { name: '3on3', desc: 'Deck de 3 Beys dans un ordre fixe', official: true },
  {
    name: 'Counter',
    desc: "Deck de 3, le gagnant choisit d'abord, le perdant contre",
    official: false,
  },
];

const DECK_RULES = [
  'Deck de 3 Beyblades maximum',
  'Pas plus de 1 copie de chaque pièce',
  'Exception : Lock Chips basiques (même design) sans limite',
  'Metal Lock Chips (Valkyrie, Emperor) : limité à 1',
  'Lightning L-Drago (Upper & Rapid-Hit) = même pièce',
  'Recolors = même pièce / Retools = pièces différentes',
];

const BANNED_PARTS = [
  { name: 'MN / Metal Needle (bit)', reason: 'Endommage les stadiums' },
];

const POWERCORES = [
  { name: 'Absorb', color: '#22c55e', desc: 'Absorbe les coups adverses' },
  {
    name: 'BurstEnhancer',
    color: '#ef4444',
    desc: 'Augmente les chances de Burst',
  },
  { name: 'Dissipate', color: '#3b82f6', desc: "Dissipe l'énergie cinétique" },
  { name: 'Helios', color: '#f59e0b', desc: 'PowerCore solaire premium' },
  { name: 'Toxic', color: '#a855f7', desc: 'PowerCore toxique spécial' },
];

const BATTLEPASS_SEASONS = [
  { name: 'Saison 1', badge: 'Battlepass-Badge-Season1.webp' },
  { name: 'Saison 2', badge: 'Battlepass-Badge-Season2.webp' },
  { name: 'Saison 3', badge: 'Battlepass-Badge-Season3.webp' },
  { name: 'Saison 4', badge: 'Battlepass-Badge-Season4.webp' },
  { name: 'Saison 5', badge: 'Battlepass-Badge-Season5.webp' },
  { name: 'Legacy', badge: 'Battlepass-Badge_Legacy.webp' },
];

const XP_REWARDS = [
  { xp: 200, items: 'Configuration Slot, PowerCore' },
  { xp: 250, items: 'Récompense standard' },
  { xp: 500, items: 'Récompense avancée' },
  { xp: 6000, items: 'Récompense majeure' },
];

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: '900',
          mb: 2,
          color,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box sx={{ width: 4, height: 20, bgcolor: color, borderRadius: 2 }} />
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function GameData() {
  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
          border: '1px solid',
          borderColor: (t) => alpha(t.palette.primary.main, 0.15),
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: '900',
            mb: 1,
          }}
        >
          Données extraites de l'application
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Règles officielles, mécaniques de jeu, systèmes de progression et
          contenu dataminé de l'app Beyblade X.
        </Typography>
      </Paper>
      {/* Scoring */}
      <Section title="Système de scoring" color="#ef4444">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 2,
          }}
        >
          {SCORING.map((s) => (
            <Card
              key={s.name}
              variant="outlined"
              sx={{ borderRadius: 3, borderColor: alpha(s.color, 0.2) }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: '900',
                      fontSize: '0.9rem',
                    }}
                  >
                    {s.name}
                  </Typography>
                  <Chip
                    label={`${s.points} pt${s.points > 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      fontWeight: 900,
                      bgcolor: alpha(s.color, 0.12),
                      color: s.color,
                      height: 22,
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                  }}
                >
                  {s.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Section>
      {/* Match & Battle Types */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <Section title="Formats de match" color="#3b82f6">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {MATCH_TYPES.map((m) => (
              <Paper
                key={m.name}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: '900',
                    fontSize: '0.85rem',
                    minWidth: 100,
                  }}
                >
                  {m.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    flex: 1,
                  }}
                >
                  {m.desc}
                </Typography>
                {m.official && (
                  <Chip
                    label="OFFICIEL"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      bgcolor: alpha('#22c55e', 0.12),
                      color: '#22c55e',
                    }}
                  />
                )}
              </Paper>
            ))}
          </Box>
        </Section>

        <Section title="Types de combat" color="#a855f7">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {BATTLE_TYPES.map((b) => (
              <Paper
                key={b.name}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: '900',
                    fontSize: '0.85rem',
                    minWidth: 80,
                  }}
                >
                  {b.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    flex: 1,
                  }}
                >
                  {b.desc}
                </Typography>
                {b.official && (
                  <Chip
                    label="OFFICIEL"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      bgcolor: alpha('#22c55e', 0.12),
                      color: '#22c55e',
                    }}
                  />
                )}
              </Paper>
            ))}
          </Box>
        </Section>
      </Box>
      {/* Deck Rules + Banned */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <Section title="Règles de deck" color="#f59e0b">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {DECK_RULES.map((r, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#f59e0b',
                    mt: 0.8,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {r}
                </Typography>
              </Box>
            ))}
          </Box>
        </Section>

        <Section title="Pièces bannies" color="#ef4444">
          {BANNED_PARTS.map((p) => (
            <Paper
              key={p.name}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#ef4444', 0.04),
                border: '1px solid',
                borderColor: alpha('#ef4444', 0.15),
              }}
            >
              <Typography
                sx={{
                  fontWeight: '900',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                }}
              >
                {p.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {p.reason}
              </Typography>
            </Paper>
          ))}
        </Section>
      </Box>
      {/* Datamined: PowerCores */}
      <Section title="PowerCores (dataminé)" color="#22c55e">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(5, 1fr)',
            },
            gap: 2,
          }}
        >
          {POWERCORES.map((pc) => (
            <Card
              key={pc.name}
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: alpha(pc.color, 0.2),
                textAlign: 'center',
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box
                  component="img"
                  src={`/app-assets/sprites/Battlepass-${pc.name}-PowerCore.webp`}
                  alt={pc.name}
                  sx={{
                    width: 48,
                    height: 48,
                    mx: 'auto',
                    mb: 1,
                    filter: `drop-shadow(0 0 6px ${alpha(pc.color, 0.4)})`,
                  }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Typography
                  sx={{
                    fontWeight: '900',
                    fontSize: '0.8rem',
                    color: pc.color,
                  }}
                >
                  {pc.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.65rem',
                  }}
                >
                  {pc.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Section>
      {/* Datamined: Battlepass Seasons */}
      <Section title="Battlepass — Saisons (dataminé)" color="#f59e0b">
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {BATTLEPASS_SEASONS.map((s) => (
            <Paper
              key={s.name}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha('#f59e0b', 0.15),
                textAlign: 'center',
                minWidth: 100,
              }}
            >
              <Box
                component="img"
                src={`/app-assets/sprites/${s.badge}`}
                alt={s.name}
                sx={{
                  width: 56,
                  height: 56,
                  mx: 'auto',
                  mb: 1,
                  filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.3))',
                }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Typography
                sx={{
                  fontWeight: '900',
                  fontSize: '0.75rem',
                }}
              >
                {s.name}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Section>
      {/* XP Rewards */}
      <Section title="Récompenses XP (dataminé)" color="#a855f7">
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {XP_REWARDS.map((r) => (
            <Paper
              key={r.xp}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha('#a855f7', 0.15),
                minWidth: 140,
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Box
                  component="img"
                  src={`/app-assets/textures/${r.xp}SeasonXP_icon.webp`}
                  alt=""
                  sx={{ width: 24, height: 24 }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Typography
                  sx={{
                    fontWeight: '900',
                    color: '#a855f7',
                    fontSize: '0.85rem',
                  }}
                >
                  {r.xp} XP
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {r.items}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Section>
      {/* Arena Backgrounds */}
      <Section title="Fonds d'arène (dataminé)" color="#3b82f6">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 2,
          }}
        >
          {[
            'arena-background.webp',
            'arena-background_locked.webp',
            'arena-backgroundwithoutbar.webp',
          ].map((f) => (
            <Box
              key={f}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: alpha('#3b82f6', 0.15),
              }}
            >
              <Box
                component="img"
                src={`/app-assets/sprites/${f}`}
                alt={f}
                sx={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <Box sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.3)' }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                  }}
                >
                  {f.replace('.webp', '').replace(/-/g, ' ')}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Section>
      {/* Footer */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: alpha('#fff', 0.02),
          textAlign: 'center',
          mt: 4,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
          }}
        >
          Données extraites de l'application Beyblade X v2.x — Certaines
          fonctionnalités sont en développement et peuvent ne pas être
          disponibles dans l'app.
        </Typography>
      </Paper>
    </Box>
  );
}
