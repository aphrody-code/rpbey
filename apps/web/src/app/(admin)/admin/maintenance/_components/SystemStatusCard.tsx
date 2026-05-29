"use client";

import { OpenInNew, Storage } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { botStatus as sdkBotStatus } from "@rpbey/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BotStatus } from "@/lib/bot";

/**
 * Carte d'état système live — interroge l'API réelle du bot via le bridge
 * `/api/bot/status` (proxy serveur → :3001). Remplace les valeurs mockées
 * codées en dur (S3, « Dernier recalcul 14:30 »).
 */
export default function SystemStatusCard() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    // SDK @rpbey/api-client (GET /api/v1/bot/status → enveloppe { ok, data: { status } }).
    // Sans API_BASE le client tape la même origine. Le BotStatus brut de l'ancienne
    // route /api/bot/status est ici niché sous data.status (null si le bot est injoignable).
    sdkBotStatus()
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data?.ok) {
          setState("offline");
          return;
        }
        const data = res.data.data.status;
        setStatus(data);
        setState(data?.status === "running" ? "ok" : "offline");
      })
      .catch(() => {
        if (!cancelled) setState("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card variant="outlined">
      <CardHeader title="État du Système" avatar={<Storage />} />
      <CardContent>
        <List dense>
          <ListItem>
            <ListItemText primary="Base de données" secondary="PostgreSQL (local)" />
            <Chip size="small" label="OK" color="success" />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Bot Discord"
              secondary={
                state === "loading"
                  ? "Vérification…"
                  : state === "ok"
                    ? `En ligne · ${status?.uptimeFormatted ?? ""}`
                    : "Injoignable"
              }
            />
            {state === "loading" ? (
              <CircularProgress size={16} />
            ) : (
              <Chip
                size="small"
                label={state === "ok" ? "OK" : "KO"}
                color={state === "ok" ? "success" : "error"}
              />
            )}
          </ListItem>
          {status && (
            <ListItem>
              <ListItemText
                primary="Ping Discord"
                secondary={`${status.ping} ms · ${status.memberCount.toLocaleString("fr-FR")} membres`}
              />
            </ListItem>
          )}
        </List>
        <Button
          component={Link}
          href="/admin/logs"
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<OpenInNew />}
          sx={{ mt: 1 }}
        >
          Console &amp; logs
        </Button>
      </CardContent>
    </Card>
  );
}
