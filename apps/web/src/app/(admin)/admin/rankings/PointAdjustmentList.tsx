"use client";

import { Add, Delete, History } from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  addPointAdjustment,
  deletePointAdjustment,
  getPointAdjustments,
  searchUsers,
} from "@/server/actions/ranking";

interface User {
  id: string;
  name: string | null;
  image: string | null;
  email: string;
}

interface Adjustment {
  id: string;
  points: number;
  reason: string;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  admin: {
    name: string | null;
  } | null;
}

export default function PointAdjustmentList() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAdjustments = useCallback(async () => {
    try {
      const data = await getPointAdjustments();
      setAdjustments(data);
    } catch {
      // Ignorer l'erreur silencieusement ou ajouter un toast global si nécessaire
    }
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const handleSearchUser = async (_event: React.SyntheticEvent, value: string) => {
    if (value.length < 2) {
      setUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchUsers(value);
      setUsers(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !points || !reason) return;

    setLoading(true);
    setMessage(null);

    try {
      await addPointAdjustment(selectedUser.id, parseInt(points, 10), reason);
      setMessage({ type: "success", text: "Points ajustés avec succès." });
      setSelectedUser(null);
      setPoints("");
      setReason("");
      fetchAdjustments();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'ajustement." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Voulez-vous vraiment annuler cet ajustement ? Cela inversera l'opération sur le solde du joueur.",
      )
    )
      return;

    try {
      await deletePointAdjustment(id);
      fetchAdjustments();
      setMessage({ type: "success", text: "Ajustement annulé." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardHeader
        title="Ajustements Manuels"
        subheader="Ajouter ou retirer des points à un joueur spécifique (hors tournoi)."
      />
      <Divider />
      <CardContent>
        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid
            container
            spacing={2}
            sx={{
              alignItems: "flex-start",
            }}
          >
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={users}
                getOptionLabel={(option) => option.name || option.email}
                filterOptions={(x) => x}
                loading={searchLoading}
                onInputChange={handleSearchUser}
                onChange={(_, value) => setSelectedUser(value)}
                value={selectedUser}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Rechercher un joueur"
                    placeholder="Nom, email ou tag Discord"
                    fullWidth
                    slotProps={{
                      ...params.slotProps,

                      input: {
                        ...params.slotProps.input,
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.slotProps.input.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Avatar src={option.image || undefined} sx={{ width: 24, height: 24 }} />
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                        }}
                      >
                        ({option.email})
                      </Typography>
                    </Box>
                  </li>
                )}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label="Points"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                helperText="Ex: 10 ou -5"
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Raison"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ height: 56 }}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Add />}
                disabled={loading || !selectedUser}
              >
                Ajouter
              </Button>
            </Grid>
          </Grid>
        </form>

        <Box sx={{ mt: 4 }}>
          <Typography
            variant="subtitle2"
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
          >
            <History fontSize="small" />
            Derniers ajustements
          </Typography>
          <List dense>
            {adjustments.map((adj) => (
              <ListItem
                key={adj.id}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(adj.id)}>
                    <Delete />
                  </IconButton>
                }
                sx={{
                  bgcolor: "background.default",
                  mb: 1,
                  borderRadius: 1,
                  borderLeft: "4px solid",
                  borderColor: adj.points > 0 ? "success.main" : "error.main",
                }}
              >
                <ListItemAvatar>
                  <Avatar src={adj.user.image || undefined}>{adj.user.name?.[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{
                          fontWeight: "bold",
                        }}
                      >
                        {adj.user.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="span"
                        color={adj.points > 0 ? "success.main" : "error.main"}
                        sx={{
                          fontWeight: "bold",
                        }}
                      >
                        {adj.points > 0 ? "+" : ""}
                        {adj.points} pts
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      {adj.reason} — par {adj.admin?.name || "Système"} le{" "}
                      {new Date(adj.createdAt).toLocaleDateString()}
                    </>
                  }
                />
              </ListItem>
            ))}
            {adjustments.length === 0 && (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  py: 2,
                  textAlign: "center",
                }}
              >
                Aucun ajustement récent.
              </Typography>
            )}
          </List>
        </Box>
      </CardContent>
    </Card>
  );
}
