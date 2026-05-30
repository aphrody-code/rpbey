"use client";

import { Add, Delete, Edit, MonetizationOn, Search, StyleRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui";

type CardRarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";

interface GachaCard {
  id: string;
  slug: string;
  name: string;
  series: string;
  rarity: CardRarity;
  imageUrl: string | null;
  isActive: boolean;
  dropRate: number;
  createdAt: string;
}

interface GachaDrop {
  id: string;
  slug: string;
  name: string;
  theme: string;
  season: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  cardCount: number;
}

const RARITIES: CardRarity[] = ["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"];

const RARITY_COLORS: Record<CardRarity, "default" | "primary" | "secondary" | "warning" | "error"> =
  {
    COMMON: "default",
    RARE: "primary",
    SUPER_RARE: "secondary",
    LEGENDARY: "warning",
    SECRET: "error",
  };

const EMPTY_CARD = {
  slug: "",
  name: "",
  series: "X",
  rarity: "COMMON" as CardRarity,
  imageUrl: "",
  isActive: true,
  dropRate: 0,
  att: 0,
  def: 0,
  end: 0,
  element: "NEUTRAL",
};

const EMPTY_DROP = {
  slug: "",
  name: "",
  theme: "",
  season: 1,
  maxCards: 32,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  isActive: false,
  imageUrl: "",
};

export default function AdminGachaPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);

  // Cards state
  const [cards, setCards] = useState<GachaCard[]>([]);
  const [cardsTotal, setCardsTotal] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardSearch, setCardSearch] = useState("");
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState(EMPTY_CARD);

  // Drops state
  const [drops, setDrops] = useState<GachaDrop[]>([]);
  const [dropsLoading, setDropsLoading] = useState(true);
  const [dropDialogOpen, setDropDialogOpen] = useState(false);
  const [editDropId, setEditDropId] = useState<string | null>(null);
  const [dropForm, setDropForm] = useState(EMPTY_DROP);

  // Economy state
  const [ecoUserId, setEcoUserId] = useState("");
  const [ecoAmount, setEcoAmount] = useState("");
  const [ecoNote, setEcoNote] = useState("");
  const [ecoLoading, setEcoLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/gacha/cards?search=${encodeURIComponent(cardSearch)}&limit=100`,
      );
      const data = await res.json();
      setCards(data.cards ?? []);
      setCardsTotal(data.total ?? 0);
    } catch {
      showToast("Erreur chargement cartes", "error");
    } finally {
      setCardsLoading(false);
    }
  }, [cardSearch, showToast]);

  const fetchDrops = useCallback(async () => {
    setDropsLoading(true);
    try {
      const res = await fetch("/api/admin/gacha/drops");
      const data = await res.json();
      setDrops(Array.isArray(data) ? data : []);
    } catch {
      showToast("Erreur chargement drops", "error");
    } finally {
      setDropsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  // Card CRUD
  const openNewCard = () => {
    setEditCardId(null);
    setCardForm(EMPTY_CARD);
    setCardDialogOpen(true);
  };

  const openEditCard = (c: GachaCard) => {
    setEditCardId(c.id);
    setCardForm({
      slug: c.slug,
      name: c.name,
      series: c.series,
      rarity: c.rarity,
      imageUrl: c.imageUrl ?? "",
      isActive: c.isActive,
      dropRate: c.dropRate,
      att: 0,
      def: 0,
      end: 0,
      element: "NEUTRAL",
    });
    setCardDialogOpen(true);
  };

  const handleSaveCard = async () => {
    const url = editCardId ? `/api/admin/gacha/cards/${editCardId}` : "/api/admin/gacha/cards";
    const method = editCardId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cardForm, dropRate: Number(cardForm.dropRate) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error ?? "Erreur", "error");
      return;
    }
    showToast(editCardId ? "Carte mise a jour" : "Carte creee", "success");
    setCardDialogOpen(false);
    fetchCards();
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm("Supprimer cette carte ?")) return;
    const res = await fetch(`/api/admin/gacha/cards/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur suppression", "error");
      return;
    }
    showToast("Carte supprimee", "success");
    fetchCards();
  };

  // Drop CRUD
  const openNewDrop = () => {
    setEditDropId(null);
    setDropForm(EMPTY_DROP);
    setDropDialogOpen(true);
  };

  const openEditDrop = (d: GachaDrop) => {
    setEditDropId(d.id);
    setDropForm({
      slug: d.slug,
      name: d.name,
      theme: d.theme,
      season: d.season,
      maxCards: 32,
      startDate: d.startDate.slice(0, 10),
      endDate: d.endDate.slice(0, 10),
      isActive: d.isActive,
      imageUrl: "",
    });
    setDropDialogOpen(true);
  };

  const handleSaveDrop = async () => {
    const url = editDropId ? `/api/admin/gacha/drops/${editDropId}` : "/api/admin/gacha/drops";
    const method = editDropId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dropForm),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error ?? "Erreur", "error");
      return;
    }
    showToast(editDropId ? "Drop mis a jour" : "Drop cree", "success");
    setDropDialogOpen(false);
    fetchDrops();
  };

  const handleDeleteDrop = async (id: string) => {
    if (!confirm("Supprimer ce drop (et dissocier les cartes) ?")) return;
    const res = await fetch(`/api/admin/gacha/drops/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Erreur suppression", "error");
      return;
    }
    showToast("Drop supprime", "success");
    fetchDrops();
  };

  // Economy
  const handleAdjustCurrency = async () => {
    if (!ecoUserId || !ecoAmount) return;
    setEcoLoading(true);
    try {
      const res = await fetch("/api/admin/gacha/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ecoUserId, amount: Number(ecoAmount), note: ecoNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur", "error");
        return;
      }
      showToast(`BeyCoins ajustes. Nouveau solde : ${data.newBalance}`, "success");
      setEcoUserId("");
      setEcoAmount("");
      setEcoNote("");
    } catch {
      showToast("Erreur", "error");
    } finally {
      setEcoLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Gestion Gacha"
        description={`${cardsTotal} cartes · ${drops.length} drops`}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Cartes" icon={<StyleRounded />} iconPosition="start" />
        <Tab label="Drops" icon={<Add />} iconPosition="start" />
        <Tab label="Economie" icon={<MonetizationOn />} iconPosition="start" />
      </Tabs>

      {/* ── CARTES ── */}
      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Rechercher une carte..."
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
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
            <Button variant="contained" startIcon={<Add />} onClick={openNewCard}>
              Nouvelle carte
            </Button>
          </Stack>
          {cardsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
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
                    <th>Slug</th>
                    <th>Serie</th>
                    <th>Rarete</th>
                    <th>Taux</th>
                    <th>Actif</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {c.name}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {c.slug}
                        </Typography>
                      </td>
                      <td>{c.series}</td>
                      <td>
                        <Chip
                          label={c.rarity}
                          color={RARITY_COLORS[c.rarity]}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: "0.7rem" }}
                        />
                      </td>
                      <td>{c.dropRate}%</td>
                      <td>
                        <Chip
                          label={c.isActive ? "Oui" : "Non"}
                          color={c.isActive ? "success" : "default"}
                          size="small"
                        />
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={() => openEditCard(c)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteCard(c.id)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                  {cards.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", textAlign: "center", py: 4 }}
                        >
                          Aucune carte
                        </Typography>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── DROPS ── */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={openNewDrop}>
              Nouveau drop
            </Button>
          </Box>
          {dropsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {drops.map((d) => (
                <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {d.name}
                        </Typography>
                        <Chip
                          label={d.isActive ? "Actif" : "Inactif"}
                          color={d.isActive ? "success" : "default"}
                          size="small"
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        Saison {d.season} · {d.theme}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        {d.cardCount} cartes · {d.startDate.slice(0, 10)} → {d.endDate.slice(0, 10)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button size="small" startIcon={<Edit />} onClick={() => openEditDrop(d)}>
                          Modifier
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Delete />}
                          onClick={() => handleDeleteDrop(d.id)}
                        >
                          Supprimer
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {drops.length === 0 && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info">Aucun drop configure.</Alert>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}

      {/* ── ECONOMIE ── */}
      {tab === 2 && (
        <Box sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            Ajustement de BeyCoins
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Crediter ou debiter un joueur (montant positif = credit, negatif = debit).
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="User ID"
              value={ecoUserId}
              onChange={(e) => setEcoUserId(e.target.value)}
              size="small"
              placeholder="cuid du compte utilisateur..."
            />
            <TextField
              fullWidth
              label="Montant (+ credit, - debit)"
              type="number"
              value={ecoAmount}
              onChange={(e) => setEcoAmount(e.target.value)}
              size="small"
            />
            <TextField
              fullWidth
              label="Note (optionnel)"
              value={ecoNote}
              onChange={(e) => setEcoNote(e.target.value)}
              size="small"
              placeholder="Raison du don/retrait..."
            />
            <Button
              variant="contained"
              startIcon={
                ecoLoading ? <CircularProgress size={18} color="inherit" /> : <MonetizationOn />
              }
              onClick={handleAdjustCurrency}
              disabled={!ecoUserId || !ecoAmount || ecoLoading}
            >
              Appliquer
            </Button>
          </Stack>
        </Box>
      )}

      {/* ── Dialog Carte ── */}
      <Dialog
        open={cardDialogOpen}
        onClose={() => setCardDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editCardId ? "Modifier la carte" : "Nouvelle carte"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Slug"
              value={cardForm.slug}
              onChange={(e) => setCardForm({ ...cardForm, slug: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Nom"
              value={cardForm.name}
              onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Serie"
              value={cardForm.series}
              onChange={(e) => setCardForm({ ...cardForm, series: e.target.value })}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Rarete</InputLabel>
              <Select
                value={cardForm.rarity}
                label="Rarete"
                onChange={(e) => setCardForm({ ...cardForm, rarity: e.target.value as CardRarity })}
              >
                {RARITIES.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="URL Image"
              value={cardForm.imageUrl}
              onChange={(e) => setCardForm({ ...cardForm, imageUrl: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Taux de drop (%)"
              type="number"
              value={cardForm.dropRate}
              onChange={(e) => setCardForm({ ...cardForm, dropRate: Number(e.target.value) })}
              fullWidth
              size="small"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={cardForm.isActive}
                  onChange={(e) => setCardForm({ ...cardForm, isActive: e.target.checked })}
                />
              }
              label="Carte active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCardDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveCard}>
            {editCardId ? "Enregistrer" : "Creer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Drop ── */}
      <Dialog
        open={dropDialogOpen}
        onClose={() => setDropDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editDropId ? "Modifier le drop" : "Nouveau drop"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Slug"
              value={dropForm.slug}
              onChange={(e) => setDropForm({ ...dropForm, slug: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Nom"
              value={dropForm.name}
              onChange={(e) => setDropForm({ ...dropForm, name: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Theme"
              value={dropForm.theme}
              onChange={(e) => setDropForm({ ...dropForm, theme: e.target.value })}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Saison"
                type="number"
                value={dropForm.season}
                onChange={(e) => setDropForm({ ...dropForm, season: Number(e.target.value) })}
                size="small"
              />
              <TextField
                label="Max cartes"
                type="number"
                value={dropForm.maxCards}
                onChange={(e) => setDropForm({ ...dropForm, maxCards: Number(e.target.value) })}
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Debut"
                type="date"
                value={dropForm.startDate}
                onChange={(e) => setDropForm({ ...dropForm, startDate: e.target.value })}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Fin"
                type="date"
                value={dropForm.endDate}
                onChange={(e) => setDropForm({ ...dropForm, endDate: e.target.value })}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={dropForm.isActive}
                  onChange={(e) => setDropForm({ ...dropForm, isActive: e.target.checked })}
                />
              }
              label="Drop actif"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDropDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveDrop}>
            {editDropId ? "Enregistrer" : "Creer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
