'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  DynamicBarChart as BarChart,
  DynamicPieChart as PieChart,
} from '@/components/ui/DynamicCharts';

interface StatsChartsProps {
  registrations: { month: string; count: number }[];
  tournaments: { month: string; count: number }[];
  matchesStatus: { status: string; count: number }[];
}

export function StatsCharts({
  registrations,
  tournaments,
  matchesStatus,
}: StatsChartsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Grid container spacing={3} sx={{ mt: 3 }}>
      {/* User Growth */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
            height: '100%',
            transition: 'box-shadow 0.2s',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: 'bold',
              }}
            >
              Croissance Utilisateurs & Tournois
            </Typography>
            <Box sx={{ height: 350, width: '100%' }}>
              {registrations.length > 0 ? (
                <BarChart
                  xAxis={[
                    {
                      scaleType: 'band',
                      data: registrations.map((d) => d.month),
                    },
                  ]}
                  series={[
                    {
                      data: registrations.map((d) => d.count),
                      label: 'Nouveaux Inscrits',
                      color: '#3b82f6',
                    },
                    {
                      data: tournaments.map((d) => d.count),
                      label: 'Tournois Créés',
                      color: theme.palette.secondary.main,
                    },
                  ]}
                  height={isMobile ? 250 : 300}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <Typography
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Aucune donnée disponible
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {/* Match Status Distribution */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
            height: '100%',
            transition: 'box-shadow 0.2s',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: 'bold',
              }}
            >
              État des Matchs
            </Typography>
            <Box
              sx={{
                height: 350,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {matchesStatus.length > 0 ? (
                <PieChart
                  series={[
                    {
                      data: matchesStatus.map((s, i) => ({
                        id: i,
                        value: s.count,
                        label: s.status,
                        color:
                          s.status === 'Terminé'
                            ? '#22c55e'
                            : s.status === 'En cours'
                              ? '#3b82f6'
                              : '#94a3b8',
                      })),
                      innerRadius: 40,
                      outerRadius: 100,
                      paddingAngle: 4,
                      cornerRadius: 6,
                      highlightScope: { fade: 'global', highlight: 'item' },
                      faded: {
                        innerRadius: 30,
                        additionalRadius: -30,
                        color: 'gray',
                      },
                    },
                  ]}
                  margin={{ right: 5 }}
                  height={isMobile ? 250 : 300}
                  slotProps={{
                    legend: {
                      // hidden: true, // Moved to prop
                    },
                  }}
                />
              ) : (
                <Typography
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Aucun match enregistré
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
