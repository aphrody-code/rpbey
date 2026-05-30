"use client";

import {
  CheckCircle,
  Circle,
  Download,
  FilterList,
  PlayArrow,
  Refresh as RefreshIcon,
  Search,
} from "@mui/icons-material";
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
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui";
import { useBotEvents } from "@/hooks/useBotEvents";
import type { BotStatus, LogEntry } from "@/lib/bot";

// Semantic CSS vars emitted by MUI v9 — follow the theme (dark/light, dynamic color).
const LEVEL_COLOR: Record<string, string> = {
  error: "var(--mui-palette-error-main)",
  warn: "var(--mui-palette-warning-main)",
  info: "var(--mui-palette-primary-main)",
  debug: "var(--mui-palette-text-disabled)",
};

const ALL_LEVELS = ["error", "warn", "info", "debug"] as const;
type Level = (typeof ALL_LEVELS)[number];

interface Props {
  initialStatus: BotStatus | null;
  initialLogs: LogEntry[];
}

export function BotConsole({ initialStatus, initialLogs }: Props) {
  const { showToast } = useToast();

  // ── Logs state ──────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Restart state ────────────────────────────────────────────────────────────
  const [restarting, setRestarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Refresh state ────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);

  // ── Filter state (client-side only) ─────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [activeLevels, setActiveLevels] = useState<Level[]>([...ALL_LEVELS]);

  // ── SSE real-time ────────────────────────────────────────────────────────────
  const { connected } = useBotEvents({
    topics: ["logs"],
    onEvent: (event) => {
      if (event.topic !== "logs") return;
      const entry = event.data as LogEntry;
      if (!entry?.timestamp) return;
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(-500) : next;
      });
    },
  });

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // ── Filtered view (memoized) ─────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return logs.filter((log) => {
      const levelMatch = activeLevels.includes((log.level as Level) ?? "info");
      if (!levelMatch) return false;
      if (!needle) return true;
      return log.message.toLowerCase().includes(needle);
    });
  }, [logs, activeLevels, searchText]);

  // ── Level counts ──────────────────────────────────────────────────────────────
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      counts[log.level] = (counts[log.level] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  // ── Restart ──────────────────────────────────────────────────────────────────
  const handleRestartConfirm = useCallback(async () => {
    setRestarting(true);
    setConfirmOpen(false);
    try {
      const res = await fetch("/api/admin/bot/restart", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (res.ok && data.success) {
        showToast(data.message ?? "Redémarrage demande", "success");
      } else {
        showToast(data.message ?? "Echec du redemarrage", "error");
      }
    } catch {
      showToast("Erreur reseau", "error");
    } finally {
      setRestarting(false);
    }
  }, [showToast]);

  // ── Manual refresh (re-fetch last 200 logs from BFF) ─────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/bot/logs?tail=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { logs?: LogEntry[] };
      if (Array.isArray(data.logs)) {
        setLogs(data.logs);
        showToast("Logs rafraichis", "success");
      }
    } catch {
      showToast("Impossible de rafraichir les logs", "error");
    } finally {
      setRefreshing(false);
    }
  }, [showToast]);

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExportTxt = useCallback(() => {
    const lines = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] ${l.level.toUpperCase().padEnd(5)} ${l.message}`,
      )
      .join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // ── Level toggle ─────────────────────────────────────────────────────────────
  const handleLevelChange = useCallback((_: React.MouseEvent, value: Level[]) => {
    // Always keep at least one level active.
    if (value.length > 0) setActiveLevels(value);
  }, []);

  const isOnline = initialStatus?.status === "running";

  const statusItems = useMemo(
    () =>
      initialStatus
        ? [
            { label: "Uptime", value: initialStatus.uptimeFormatted },
            { label: "Ping Discord", value: `${initialStatus.ping} ms` },
            {
              label: "Membres",
              value: initialStatus.memberCount.toLocaleString("fr-FR"),
            },
            {
              label: "En ligne",
              value: initialStatus.onlineCount.toLocaleString("fr-FR"),
            },
            { label: "Memoire", value: initialStatus.memoryUsage },
            { label: "Runtime", value: initialStatus.runtime },
          ]
        : [],
    [initialStatus],
  );

  return (
    <>
      {/* MUI Dialog confirmation restart */}
      <ConfirmDialog
        open={confirmOpen}
        title="Redemarrer le bot Discord ?"
        message="Le service rpb-bot.service va etre redemarrepar systemd. Les commandes en cours seront interrompues (~5 s)."
        confirmText="Redemarrer"
        cancelText="Annuler"
        confirmColor="error"
        loading={restarting}
        onConfirm={handleRestartConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <Stack spacing={3}>
        {/* ── Bot status card ────────────────────────────────────────── */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Circle
                  sx={{
                    fontSize: 14,
                    color: isOnline ? "success.main" : "error.main",
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Bot Discord
                </Typography>
                <Chip
                  size="small"
                  label={
                    initialStatus
                      ? isOnline
                        ? "En ligne"
                        : initialStatus.status === "starting"
                          ? "Demarrage"
                          : "Hors ligne"
                      : "Injoignable"
                  }
                  color={
                    isOnline
                      ? "success"
                      : initialStatus?.status === "starting"
                        ? "warning"
                        : "error"
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
                onClick={() => setConfirmOpen(true)}
                disabled={restarting}
                startIcon={
                  restarting ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
                }
                sx={{ mt: 1, mr: 1 }}
              >
                {restarting ? "Redemarrage..." : "Redemarrer le bot"}
              </Button>
            }
          />
          <Divider />
          <CardContent>
            {initialStatus ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    sm: "repeat(3, 1fr)",
                    md: "repeat(6, 1fr)",
                  },
                  gap: 2,
                }}
              >
                {statusItems.map((item) => (
                  <Box key={item.label}>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", display: "block" }}
                    >
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontWeight: "bold" }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Le bot ne repond pas sur l&apos;API (`/api/status`). Verifiez que le service
                `rpb-bot.service` est actif.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* ── Console card ──────────────────────────────────────────── */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Console
                </Typography>
                {/* SSE connection indicator */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  {connected ? (
                    <CheckCircle sx={{ fontSize: 14, color: "success.main" }} />
                  ) : (
                    <PlayArrow sx={{ fontSize: 14, color: "text.disabled" }} />
                  )}
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {connected ? "Flux temps reel" : "Connexion..."}
                  </Typography>
                </Stack>
                {/* Filtered count */}
                <Chip
                  size="small"
                  label={`${filteredLogs.length} / ${logs.length}`}
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              </Stack>
            }
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1, mr: 1 }}>
                {/* Auto-scroll toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Defilement auto</Typography>}
                />
                {/* Manual refresh */}
                <Tooltip title="Rafraichir les logs">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      aria-label="Rafraichir les logs"
                    >
                      {refreshing ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RefreshIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                {/* Export .txt */}
                <Tooltip title="Exporter en .txt">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleExportTxt}
                      disabled={filteredLogs.length === 0}
                      aria-label="Exporter en TXT"
                    >
                      <Download fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {/* Export .json */}
                <Tooltip title="Exporter en .json">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleExportJson}
                    disabled={filteredLogs.length === 0}
                    sx={{ fontSize: "0.7rem", py: 0.5 }}
                  >
                    JSON
                  </Button>
                </Tooltip>
              </Stack>
            }
          />
          <Divider />

          {/* ── Filters toolbar ──────────────────────────────────────── */}
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              {/* Text search */}
              <TextField
                size="small"
                placeholder="Rechercher dans les logs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                sx={{ flex: 1, minWidth: 200 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {/* Level filter */}
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <FilterList fontSize="small" sx={{ color: "text.secondary" }} />
                <ToggleButtonGroup
                  size="small"
                  value={activeLevels}
                  onChange={handleLevelChange}
                  aria-label="Filtrer par niveau"
                >
                  {ALL_LEVELS.map((lvl) => (
                    <ToggleButton
                      key={lvl}
                      value={lvl}
                      aria-label={lvl}
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.7rem",
                        px: 1,
                        py: 0.25,
                        color: LEVEL_COLOR[lvl],
                        "&.Mui-selected": {
                          color: LEVEL_COLOR[lvl],
                          bgcolor: `${LEVEL_COLOR[lvl]}22`,
                        },
                      }}
                    >
                      {lvl.toUpperCase()}
                      {levelCounts[lvl] !== undefined && (
                        <Box component="span" sx={{ ml: 0.5, fontSize: "0.65rem", opacity: 0.7 }}>
                          {levelCounts[lvl]}
                        </Box>
                      )}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* ── Log console output ───────────────────────────────────── */}
          <Box
            ref={scrollRef}
            sx={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              lineHeight: 1.6,
              p: 2,
              height: 480,
              overflowY: "auto",
              bgcolor: "background.default",
              color: "text.primary",
            }}
          >
            {filteredLogs.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.disabled", fontFamily: "monospace" }}>
                {logs.length === 0
                  ? "Aucun log pour le moment."
                  : "Aucun log correspondant aux filtres actifs."}
              </Typography>
            ) : (
              filteredLogs.map((log, i) => (
                <Box
                  key={`${log.timestamp}-${i}`}
                  sx={{ display: "flex", gap: 1, whiteSpace: "pre-wrap" }}
                >
                  <Box component="span" sx={{ color: "text.disabled", flexShrink: 0 }}>
                    {new Date(log.timestamp).toLocaleTimeString("fr-FR")}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      color: LEVEL_COLOR[log.level] ?? "text.primary",
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
    </>
  );
}
