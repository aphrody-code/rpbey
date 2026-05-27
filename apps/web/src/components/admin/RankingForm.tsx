'use client';

import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

interface RankingRules {
  participation: number;
  matchWin: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  top8: number;
}

export function RankingForm({ initialRules }: { initialRules: RankingRules }) {
  const [rules, setRules] = useState<RankingRules>(initialRules);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange =
    (field: keyof RankingRules) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRules({ ...rules, [field]: parseInt(event.target.value, 10) || 0 });
    };

  const handleSubmit = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/ranking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });

      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');

      setSuccess('Règles mises à jour et classement recalculé avec succès !');
    } catch {
      setError('Impossible de mettre à jour le classement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Match & Participation
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mb: 3,
                }}
              >
                Points attribués pour l'activité de base.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="Participation"
                  type="number"
                  value={rules.participation}
                  onChange={handleChange('participation')}
                  helperText="Points reçus juste pour s'être inscrit et check-in."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">pts</InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Victoire par Match"
                  type="number"
                  value={rules.matchWin}
                  onChange={handleChange('matchWin')}
                  helperText="Bonus pour chaque match remporté dans l'arbre."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">pts</InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom color="secondary">
                Performance & Podium
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mb: 3,
                }}
              >
                Points bonus selon le classement final.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="1ère Place (Vainqueur)"
                  type="number"
                  value={rules.firstPlace}
                  onChange={handleChange('firstPlace')}
                  color="warning"
                  focused
                />
                <TextField
                  label="2ème Place"
                  type="number"
                  value={rules.secondPlace}
                  onChange={handleChange('secondPlace')}
                />
                <TextField
                  label="3ème Place"
                  type="number"
                  value={rules.thirdPlace}
                  onChange={handleChange('thirdPlace')}
                />
                <TextField
                  label="Top 8"
                  type="number"
                  value={rules.top8}
                  onChange={handleChange('top8')}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          sx={{ px: 4 }}
        >
          {loading ? 'Recalcul en cours...' : 'Sauvegarder & Recalculer'}
        </Button>
      </Box>
    </Box>
  );
}
