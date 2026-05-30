"use client";

import { Delete, Gavel, Inbox, Refresh, Search, Warning } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TablePagination from "@mui/material/TablePagination";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

interface Warning {
  id: string;
  discordId: string;
  moderator: string;
  reason: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  channelId: string;
  userId: string;
  type: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
}

export default function AdminModerationPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);

  // Warnings
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [warningsTotal, setWarningsTotal] = useState(0);
  const [warningsLoading, setWarningsLoading] = useState(true);
  const [warnSearch, setWarnSearch] = useState("");
  const [warnPage, setWarnPage] = useState(0);
  const [warnPageSize, setWarnPageSize] = useState(25);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketPage, setTicketPage] = useState(0);
  const [ticketPageSize, setTicketPageSize] = useState(25);
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");

  const fetchWarnings = useCallback(async () => {
    setWarningsLoading(true);
    try {
      const url = new URL("/api/admin/moderation/warnings", window.location.origin);
      url.searchParams.set("page", String(warnPage + 1));
      url.searchParams.set("pageSize", String(warnPageSize));
      if (warnSearch) url.searchParams.set("search", warnSearch);
      const res = await fetch(url.toString());
      const data = await res.json();
      setWarnings(data.warnings ?? []);
      setWarningsTotal(data.total ?? 0);
    } catch {
      showToast("Erreur chargement warnings", "error");
    } finally {
      setWarningsLoading(false);
    }
  }, [warnPage, warnPageSize, warnSearch, showToast]);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const url = new URL("/api/admin/moderation/tickets", window.location.origin);
      url.searchParams.set("page", String(ticketPage + 1));
      url.searchParams.set("pageSize", String(ticketPageSize));
      if (ticketStatusFilter) url.searchParams.set("status", ticketStatusFilter);
      const res = await fetch(url.toString());
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setTicketsTotal(data.total ?? 0);
    } catch {
      showToast("Erreur chargement tickets", "error");
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketPage, ticketPageSize, ticketStatusFilter, showToast]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDeleteWarning = async (id: string) => {
    if (!confirm("Supprimer ce warning ?")) return;
    const res = await fetch(`/api/admin/moderation/warnings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur suppression", "error");
      return;
    }
    showToast("Warning supprime", "success");
    fetchWarnings();
  };

  const handleCloseTicket = async (id: string) => {
    const res = await fetch(`/api/admin/moderation/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    if (!res.ok) {
      showToast("Erreur mise a jour", "error");
      return;
    }
    showToast("Ticket ferme", "success");
    fetchTickets();
  };

  const ticketStatusColor = (s: string): "success" | "warning" | "default" => {
    const up = s.toUpperCase();
    if (up === "OPEN") return "warning";
    if (up === "CLOSED") return "success";
    return "default";
  };

  return (
    <Box>
      <PageHeader
        title="Moderation"
        description="Warnings et tickets du serveur Discord."
        actionLabel=""
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Warning color="warning" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {warningsTotal}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Warnings totaux
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Inbox color="error" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {tickets.filter((t) => t.status.toUpperCase() === "OPEN").length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Tickets ouverts (page)
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Gavel color="primary" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {ticketsTotal}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Tickets totaux
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Warnings (${warningsTotal})`} icon={<Warning />} iconPosition="start" />
        <Tab label={`Tickets (${ticketsTotal})`} icon={<Inbox />} iconPosition="start" />
      </Tabs>

      {/* ── WARNINGS ── */}
      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Rechercher (Discord ID, modérateur, raison)..."
              value={warnSearch}
              onChange={(e) => {
                setWarnSearch(e.target.value);
                setWarnPage(0);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1 }}
            />
            <Tooltip title="Rafraichir">
              <IconButton onClick={fetchWarnings}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
          {warningsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card variant="outlined">
              <Box sx={{ overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    "& th, & td": {
                      p: 1.5,
                      textAlign: "left",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                    "& th": { fontWeight: 700, color: "text.secondary", fontSize: "0.8rem" },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Discord ID</th>
                      <th>Moderateur</th>
                      <th>Raison</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warnings.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {w.discordId}
                          </Typography>
                        </td>
                        <td>{w.moderator}</td>
                        <td>
                          <Typography
                            variant="body2"
                            sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {w.reason}
                          </Typography>
                        </td>
                        <td>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {formatDateTime(w.createdAt)}
                          </Typography>
                        </td>
                        <td>
                          <Tooltip title="Supprimer ce warning">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteWarning(w.id)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                    {warnings.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <Alert severity="info" sx={{ m: 2 }}>
                            Aucun warning.
                          </Alert>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Box>
              </Box>
              <TablePagination
                component="div"
                count={warningsTotal}
                page={warnPage}
                rowsPerPage={warnPageSize}
                onPageChange={(_, p) => setWarnPage(p)}
                onRowsPerPageChange={(e) => {
                  setWarnPageSize(Number(e.target.value));
                  setWarnPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
                labelRowsPerPage="Lignes:"
              />
            </Card>
          )}
        </Box>
      )}

      {/* ── TICKETS ── */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center" }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {["", "OPEN", "CLOSED"].map((s) => (
                <Button
                  key={s}
                  size="small"
                  variant={ticketStatusFilter === s ? "contained" : "outlined"}
                  onClick={() => {
                    setTicketStatusFilter(s);
                    setTicketPage(0);
                  }}
                >
                  {s === "" ? "Tous" : s}
                </Button>
              ))}
            </Box>
            <Tooltip title="Rafraichir">
              <IconButton onClick={fetchTickets}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
          {ticketsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card variant="outlined">
              <Box sx={{ overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    "& th, & td": {
                      p: 1.5,
                      textAlign: "left",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                    "& th": { fontWeight: 700, color: "text.secondary", fontSize: "0.8rem" },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Channel ID</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Cree le</th>
                      <th>Ferme le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {t.channelId}
                          </Typography>
                        </td>
                        <td>{t.type}</td>
                        <td>
                          <Chip label={t.status} color={ticketStatusColor(t.status)} size="small" />
                        </td>
                        <td>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {formatDateTime(t.createdAt)}
                          </Typography>
                        </td>
                        <td>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {t.closedAt ? formatDateTime(t.closedAt) : "—"}
                          </Typography>
                        </td>
                        <td>
                          {t.status.toUpperCase() !== "CLOSED" && (
                            <Tooltip title="Fermer le ticket">
                              <Button size="small" onClick={() => handleCloseTicket(t.id)}>
                                Fermer
                              </Button>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    ))}
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Alert severity="info" sx={{ m: 2 }}>
                            Aucun ticket.
                          </Alert>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Box>
              </Box>
              <TablePagination
                component="div"
                count={ticketsTotal}
                page={ticketPage}
                rowsPerPage={ticketPageSize}
                onPageChange={(_, p) => setTicketPage(p)}
                onRowsPerPageChange={(e) => {
                  setTicketPageSize(Number(e.target.value));
                  setTicketPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
                labelRowsPerPage="Lignes:"
              />
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
