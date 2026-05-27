'use client';

import {
  Link as LinkIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

export default function AdminOverviewIntegrations(_props: {
  env: Record<string, string>;
}) {
  const [challongeStatus, setChallongeStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [, setChallongeMessage] = useState<string | null>(null);

  const testChallonge = async () => {
    setChallongeStatus('loading');
    setChallongeMessage(null);
    try {
      const res = await fetch('/api/admin/integrations/challonge', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setChallongeStatus('success');
        setChallongeMessage(data.message);
      } else {
        setChallongeStatus('error');
        setChallongeMessage(data.message);
      }
    } catch {
      setChallongeStatus('error');
      setChallongeMessage('Erreur lors du test');
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1}>
            <SettingsIcon />{' '}
            <Typography variant="h6">Intégrations & Services</Typography>
          </Stack>
        }
      />
      <CardContent>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <Box
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Challonge
              </Typography>
              <Chip
                label={challongeStatus === 'success' ? 'Connecté' : 'Vérifier'}
                color={challongeStatus === 'success' ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Button
              variant="contained"
              size="small"
              fullWidth
              startIcon={
                challongeStatus === 'loading' ? (
                  <CircularProgress size={16} />
                ) : (
                  <LinkIcon />
                )
              }
              onClick={testChallonge}
              disabled={challongeStatus === 'loading'}
            >
              Tester
            </Button>
          </Box>

          <Box
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Twitch
              </Typography>
              <Chip
                label="Actif"
                color="success"
                size="small"
                variant="outlined"
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Surveillance du stream tv_rpb
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Cloud
              </Typography>
              <Chip
                label="Configuré"
                color="info"
                size="small"
                variant="outlined"
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Google Drive & Sheets
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
