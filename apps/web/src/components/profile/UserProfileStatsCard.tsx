'use client';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsMmaIcon from '@mui/icons-material/SportsMma';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import {
  alpha,
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { type UserStats } from '@/lib/stats-types';

interface StatsCardProps {
  stats: UserStats;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}

function StatItem({
  icon,
  label,
  value,
  subValue,
  color = 'primary.main',
}: StatItemProps) {
  const theme = useTheme();

  // Extract main color from theme if possible, or use string
  let mainColor = color;
  if (color.includes('.')) {
    const parts = color.split('.');
    const [scope, shade] = parts;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const palette: any = theme.palette;
    if (scope && shade && palette[scope]?.[shade]) {
      mainColor = palette[scope][shade] as string;
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
        p: 2,
        borderRadius: 4,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.1),
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: alpha(mainColor, 0.05),
          borderColor: alpha(mainColor, 0.2),
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(mainColor, 0.1)}`,
        },
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(mainColor, 0.2)}, ${alpha(mainColor, 0.1)})`,
          color: mainColor,
          display: 'flex',
          boxShadow: `0 2px 8px ${alpha(mainColor, 0.15)}`,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: '900',
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: '500',
            mt: 0.5,
          }}
        >
          {label}
        </Typography>
        {subValue && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mt: 0.2,
              opacity: 0.8,
            }}
          >
            {subValue}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function UserProfileStatsCard({ stats }: StatsCardProps) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 6,
        border: '1px solid',
        borderColor: 'divider',
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          0.8,
        )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 24,
              bgcolor: 'primary.main',
              borderRadius: 2,
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
            }}
          >
            Statistiques Globales
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {/* Win/Loss */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatItem
              icon={<SportsMmaIcon />}
              label="Matchs"
              value={`${stats.wins}V - ${stats.losses}D`}
              subValue={`${stats.totalMatches} matchs joués`}
              color="primary.main"
            />
          </Grid>

          {/* Win Rate */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 4,
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.1),
                bgcolor: alpha(theme.palette.background.paper, 0.4),
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 'bold',
                  }}
                >
                  Taux de victoire
                </Typography>
                <Typography
                  variant="h5"
                  color={stats.winRate >= 50 ? 'success.main' : 'warning.main'}
                  sx={{
                    fontWeight: '900',
                  }}
                >
                  {stats.winRate.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.winRate}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: alpha(theme.palette.text.disabled, 0.1),
                  '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.info.main})`,
                    borderRadius: 5,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Sur {stats.totalMatches} matchs officiels
              </Typography>
            </Box>
          </Grid>

          {/* Tournaments */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatItem
              icon={<EmojiEventsIcon />}
              label="Tournois"
              value={stats.tournamentsWon}
              subValue={`${stats.tournamentsPlayed} participations`}
              color="warning.main"
            />
          </Grid>

          {/* Points / Rank */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatItem
              icon={<TrendingUpIcon />}
              label="Rang & Points"
              value={`#${stats.rank}`}
              subValue={`${stats.points.toLocaleString()} pts`}
              color="info.main"
            />
          </Grid>

          {/* Current Streak */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <StatItem
              icon={<WhatshotIcon />}
              label="Série actuelle"
              value={stats.currentStreak}
              subValue={`Record: ${stats.bestStreak}`}
              color={
                stats.currentStreak > 0 ? 'success.main' : 'text.secondary'
              }
            />
          </Grid>

          {/* Recent Form */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 4,
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.1),
                bgcolor: alpha(theme.palette.background.paper, 0.4),
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography
                  variant="body2"
                  gutterBottom
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 'bold',
                  }}
                >
                  Forme récente
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {stats.recentForm.length > 0 ? (
                    stats.recentForm.map((result, i) => (
                      <Box
                        key={`${i}-${result}`}
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          bgcolor:
                            result === 'W'
                              ? alpha(theme.palette.success.main, 0.2)
                              : alpha(theme.palette.error.main, 0.2),
                          color: result === 'W' ? 'success.main' : 'error.main',
                          border: '1px solid',
                          borderColor:
                            result === 'W'
                              ? alpha(theme.palette.success.main, 0.3)
                              : alpha(theme.palette.error.main, 0.3),
                        }}
                      >
                        {result}
                      </Box>
                    ))
                  ) : (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Aucun match récent
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
