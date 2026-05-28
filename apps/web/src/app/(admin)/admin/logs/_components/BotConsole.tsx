'use client';

import {
  CheckCircle,
  Circle,
  PlayArrow,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui';
import { useBotEvents } from '@/hooks/useBotEvents';
import type { BotStatus, LogEntry } from '@/lib/bot';

const LEVEL_COLOR: Record<string, string> = {
  error: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  debug: '#9ca3af',
};

interface Props {
  initialStatus: BotStatus | null;
  initialLogs: LogEntry[];
}

export function BotConsole({ initialStatus, initialLogs }: Props) {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [autoScroll, setAutoScroll] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real-time logs via the SSE bridge (/api/bot/events → bot WebSocket topic "logs").
  const { connected } = useBotEvents({
    topics: ['logs'],
    onEvent: (event) => {
      if (event.topic !== 'logs') return;
      const entry = event.data as LogEntry;
      if (!entry?.timestamp) return;
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(-500) : next;
      });
    },
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleRestart = async () => {
    if (!confirm('Redémarrer le bot Discord (rpb-bot.service) ?')) return;
    setRestarting(true);
    try {
      const res = await fetch('/api/admin/bot/restart', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (res.ok && data.success) {
        showToast(data.message || 'Redémarrage demandé', 'success');
      } else {
        showToast(data.message || 'Échec du redémarrage', 'error');
      }
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setRestarting(false);
    }
  };

  const isOnline = initialStatus?.status === 'running';

  const statusItems = useMemo(
    () =>
      initialStatus
        ? [
            { label: 'Uptime', value: initialStatus.uptimeFormatted },
            { label: 'Ping Discord', value: `${initialStatus.ping} ms` },
            {
              label: 'Membres',
              value: initialStatus.memberCount.toLocaleString('fr-FR'),
            },
            {
              label: 'En ligne',
              value: initialStatus.onlineCount.toLocaleString('fr-FR'),
            },
            { label: 'Mémoire', value: initialStatus.memoryUsage },
            { label: 'Runtime', value: initialStatus.runtime },
          ]
        : [],
    [initialStatus],
  );

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardHeader
          title={
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center' }}
            >
              <Circle
                sx={{
                  fontSize: 14,
                  color: isOnline ? 'success.main' : 'error.main',
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Bot Discord
              </Typography>
              <Chip
                size="small"
                label={
                  initialStatus
                    ? isOnline
                      ? 'En ligne'
                      : initialStatus.status === 'starting'
                        ? 'Démarrage'
                        : 'Hors ligne'
                    : 'Injoignable'
                }
                color={
                  isOnline
                    ? 'success'
                    : initialStatus?.status === 'starting'
                      ? 'warning'
                      : 'error'
                }
                variant="outlined"
              />
            </Stack>
          }
          action={
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleRestart}
              disabled={restarting}
              startIcon={
                restarting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              sx={{ mt: 1, mr: 1 }}
            >
              {restarting ? 'Redémarrage…' : 'Redémarrer le bot'}
            </Button>
          }
        />
        <Divider />
        <CardContent>
          {initialStatus ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(6, 1fr)',
                },
                gap: 2,
              }}
            >
              {statusItems.map((item) => (
                <Box key={item.label}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 'bold' }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Le bot ne répond pas sur l&apos;API (`/api/status`). Vérifiez que
              le service `rpb-bot.service` est actif.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader
          title={
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Console
            </Typography>
          }
          subheader={
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {connected ? (
                <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
              ) : (
                <PlayArrow sx={{ fontSize: 14, color: 'text.disabled' }} />
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {connected
                  ? 'Flux temps réel connecté'
                  : 'Connexion au flux…'}
              </Typography>
            </Stack>
          }
          action={
            <FormControlLabel
              sx={{ mr: 1 }}
              control={
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">Défilement auto</Typography>
              }
            />
          }
        />
        <Divider />
        <Box
          ref={scrollRef}
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            lineHeight: 1.6,
            p: 2,
            height: 480,
            overflowY: 'auto',
            bgcolor: '#0b0e14',
            color: '#d1d5db',
          }}
        >
          {logs.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: 'text.disabled', fontFamily: 'monospace' }}
            >
              Aucun log pour le moment.
            </Typography>
          ) : (
            logs.map((log, i) => (
              <Box
                key={`${log.timestamp}-${i}`}
                sx={{ display: 'flex', gap: 1, whiteSpace: 'pre-wrap' }}
              >
                <Box component="span" sx={{ color: '#6b7280', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                </Box>
                <Box
                  component="span"
                  sx={{
                    color: LEVEL_COLOR[log.level] ?? '#d1d5db',
                    fontWeight: 700,
                    flexShrink: 0,
                    width: 48,
                  }}
                >
                  {log.level.toUpperCase()}
                </Box>
                <Box component="span">{log.message}</Box>
              </Box>
            ))
          )}
        </Box>
      </Card>
    </Stack>
  );
}
