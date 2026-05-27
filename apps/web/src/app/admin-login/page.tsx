'use client';

import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [discordId, setDiscordId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion');
        setLoading(false);
        return;
      }

      router.push('/admin');
    } catch {
      setError('Erreur réseau');
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0a0a0f',
        background:
          'radial-gradient(circle at 50% 30%, #1a1a3e 0%, #0a0a0f 70%)',
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            bgcolor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 3,
          }}
        >
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Box
              sx={{
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h5"
                color="white"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Admin RPB
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                Connexion rapide avec Discord ID + PIN
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Discord ID"
              fullWidth
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="Ex: 790281823212273734"
              required
              slotProps={{
                input: {
                  sx: { bgcolor: '#0d1117', color: 'white' },
                },
              }}
            />

            <TextField
              label="PIN"
              fullWidth
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              slotProps={{
                input: {
                  sx: { bgcolor: '#0d1117', color: 'white' },
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || !discordId || !pin}
              sx={{ fontWeight: 'bold', py: 1.5 }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
