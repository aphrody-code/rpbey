"use client";

import { Block, Delete, Edit, Search, Send as SendIcon, Visibility } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";
import { frFR } from "@mui/x-data-grid/locales";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type User } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateShort } from "@/lib/utils";
import { deleteUser, getUsers, updateUser } from "./actions";

const roleColors: Record<string, "error" | "warning" | "info" | "default"> = {
  admin: "error",
  moderator: "warning",
  staff: "info",
  user: "default",
};

type UserRow = User & { _count: { tournaments: number } };

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [total, setTotal] = useState(0);

  // Edit dialog state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editBanned, setEditBanned] = useState(false);
  const [editBanReason, setEditBanReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounce(search, 500);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users: data, total: totalCount } = await getUsers(
        paginationModel.page + 1,
        paginationModel.pageSize,
        debouncedSearch,
      );
      setUsers(data);
      setTotal(totalCount);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEditDialog = (user: UserRow) => {
    setEditUser(user);
    setEditName(user.name || "");
    setEditRole(user.role || "user");
    setEditBanned(user.banned || false);
    setEditBanReason(user.banReason || "");
    setError("");
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    setError("");
    try {
      await updateUser(editUser.id, {
        name: editName,
        role: editRole,
        banned: editBanned,
        banReason: editBanned ? editBanReason : undefined,
      });
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert("Impossible de supprimer cet utilisateur.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Utilisateur",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar
            src={params.row.image || undefined}
            alt={params.row.name || ""}
            sx={{ width: 32, height: 32 }}
          >
            {params.row.name?.charAt(0)}
          </Avatar>
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: "bold",
              }}
            >
              {params.row.name || "Anonyme"}
            </Typography>
            {params.row.banned && (
              <Chip
                label="Banni"
                color="error"
                size="small"
                sx={{ height: 18, fontSize: "0.65rem" }}
              />
            )}
          </Box>
        </Box>
      ),
    },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    {
      field: "role",
      headerName: "Rôle",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value || "user"}
          color={roleColors[params.value as string] || "default"}
          size="small"
        />
      ),
    },
    {
      field: "createdAt",
      headerName: "Inscrit le",
      width: 150,
      valueFormatter: (params) => formatDateShort(new Date(params as unknown as string)),
    },
    {
      field: "tournaments",
      headerName: "Tournois",
      width: 100,
      valueGetter: (_value, row) => row._count.tournaments,
    },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          key="view"
          icon={<Visibility />}
          label="Voir le profil"
          onClick={() => router.push(`/profile/${params.id}`)}
        />,
        <GridActionsCellItem
          key="edit"
          icon={<Edit />}
          label="Éditer"
          onClick={() => openEditDialog(params.row as UserRow)}
        />,
        <GridActionsCellItem
          key="dm"
          icon={<SendIcon />}
          label="Envoyer un DM"
          showInMenu
          onClick={() => {
            const discordId = (params.row as User).discordId;
            if (discordId) {
              router.push(`/admin/bot?userId=${discordId}&mode=dm`);
            } else {
              alert("Cet utilisateur n'a pas de compte Discord lié.");
            }
          }}
        />,
        <GridActionsCellItem
          key="ban"
          icon={<Block />}
          label={(params.row as UserRow).banned ? "Débannir" : "Bannir"}
          showInMenu
          onClick={() => {
            const user = params.row as UserRow;
            openEditDialog(user);
            // Pre-toggle ban state
            setEditBanned(!user.banned);
          }}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<Delete />}
          label="Supprimer"
          showInMenu
          onClick={() => setDeleteTarget(params.row as UserRow)}
        />,
      ],
    },
  ];

  return (
    <Box sx={{ py: 4 }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: "bold",
        }}
      >
        Utilisateurs
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          mb: 4,
        }}
      >
        Gérez les utilisateurs de la plateforme ({total} au total)
      </Typography>
      {/* Search */}
      <TextField
        fullWidth
        placeholder="Rechercher un utilisateur (nom ou email)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
        }}
      />
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          height: 600,
          width: "100%",
        }}
      >
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
          density="comfortable"
          sx={{
            border: "none",
            "& .MuiDataGrid-cell": {
              borderColor: "divider",
            },
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "action.hover",
              fontWeight: "bold",
            },
          }}
        />
      </Card>
      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>Éditer l&apos;utilisateur</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, mt: 1 }}>
            <Avatar src={editUser?.image || undefined} sx={{ width: 48, height: 48 }}>
              {editUser?.name?.charAt(0)}
            </Avatar>
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                {editUser?.email}
              </Typography>
              {editUser?.discordTag && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.disabled",
                  }}
                >
                  Discord : {editUser.discordTag}
                </Typography>
              )}
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Nom"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rôle</InputLabel>
            <Select value={editRole} label="Rôle" onChange={(e) => setEditRole(e.target.value)}>
              <MenuItem value="user">Utilisateur</MenuItem>
              <MenuItem value="moderator">Modérateur</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="admin">Administrateur</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={editBanned}
                onChange={(e) => setEditBanned(e.target.checked)}
                color="error"
              />
            }
            label="Banni"
            sx={{ mb: 1 }}
          />

          {editBanned && (
            <TextField
              fullWidth
              label="Raison du ban"
              value={editBanReason}
              onChange={(e) => setEditBanReason(e.target.value)}
              multiline
              rows={2}
              placeholder="Raison du bannissement..."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditUser(null)} disabled={saving}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold", color: "error.main" }}>
          Supprimer l&apos;utilisateur
        </DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer{" "}
            <strong>{deleteTarget?.name || deleteTarget?.email}</strong> ? Cette action est
            irréversible et supprimera toutes les données associées (profil, decks, participations
            aux tournois).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
