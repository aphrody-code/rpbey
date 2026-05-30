"use client";

import { CheckCircle, Delete, Groups, Refresh, Search, VerifiedUser } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TablePagination from "@mui/material/TablePagination";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

interface AdminTeam {
  id: string;
  name: string;
  tag: string;
  captainId: string;
  memberCount: number;
  isPublic: boolean;
  isVerified: boolean;
  createdAt: string;
}

export default function AdminEquipesPage() {
  const { showToast } = useToast();
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/teams", window.location.origin);
      url.searchParams.set("page", String(page + 1));
      url.searchParams.set("pageSize", String(pageSize));
      if (search) url.searchParams.set("search", search);
      const res = await fetch(url.toString());
      const data = await res.json();
      setTeams(data.teams ?? []);
      setTotal(data.total ?? 0);
    } catch {
      showToast("Erreur chargement equipes", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showToast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleToggleVerify = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: !current }),
    });
    if (!res.ok) {
      showToast("Erreur mise a jour", "error");
      return;
    }
    showToast(current ? "Verification retiree" : "Equipe verifiee", "success");
    fetchTeams();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'equipe "${name}" ? Cette action est irreversible.`)) return;
    const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur suppression", "error");
      return;
    }
    showToast("Equipe supprimee", "success");
    fetchTeams();
  };

  const verifiedCount = teams.filter((t) => t.isVerified).length;
  const publicCount = teams.filter((t) => t.isPublic).length;

  return (
    <Box>
      <PageHeader
        title="Equipes"
        description="Gestion de toutes les equipes (publiques et privees)."
        actionLabel=""
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Groups color="primary" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {total}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Equipes au total
              </Typography>
            </Box>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <VerifiedUser color="success" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {verifiedCount}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Verifiees (page)
              </Typography>
            </Box>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CheckCircle color="info" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {publicCount}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Publiques (page)
              </Typography>
            </Box>
          </Stack>
        </Card>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Rechercher par nom ou tag..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
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
          <IconButton onClick={fetchTeams}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading ? (
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
                  <th>Nom</th>
                  <th>Tag</th>
                  <th>Membres</th>
                  <th>Visibilite</th>
                  <th>Verifiee</th>
                  <th>Cree le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.name}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                        [{t.tag}]
                      </Typography>
                    </td>
                    <td>{t.memberCount}</td>
                    <td>
                      <Chip
                        label={t.isPublic ? "Publique" : "Privee"}
                        color={t.isPublic ? "success" : "default"}
                        size="small"
                      />
                    </td>
                    <td>
                      <Chip
                        label={t.isVerified ? "Verifiee" : "Non verifiee"}
                        color={t.isVerified ? "primary" : "default"}
                        size="small"
                        icon={t.isVerified ? <VerifiedUser /> : undefined}
                      />
                    </td>
                    <td>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {formatDateTime(t.createdAt)}
                      </Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={t.isVerified ? "Retirer la verification" : "Verifier"}>
                          <IconButton
                            size="small"
                            color={t.isVerified ? "default" : "success"}
                            onClick={() => handleToggleVerify(t.id, t.isVerified)}
                          >
                            <VerifiedUser fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer l'equipe">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(t.id, t.name)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <Alert severity="info" sx={{ m: 2 }}>
                        Aucune equipe.
                      </Alert>
                    </td>
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={pageSize}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Lignes:"
          />
        </Card>
      )}
    </Box>
  );
}
