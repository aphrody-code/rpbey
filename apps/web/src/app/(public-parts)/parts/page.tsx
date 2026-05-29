"use client";

import {
  Add,
  ContentCopy,
  Delete,
  Download,
  Edit,
  Extension,
  FileUpload,
  HideImage,
  Inventory2,
  Search,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DataGrid, type GridColDef, type GridRowModel } from "@mui/x-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, useToast } from "@/components/ui";
import { type Beyblade, type Part, type PartType, type Product } from "@/lib/types";
import {
  bulkImportParts,
  deletePart,
  duplicatePart,
  getBeyblades,
  getParts,
  getPartsStats,
  upsertPart,
} from "./actions";
import { PartDialog } from "./PartDialog";

// ──── Types ────

interface PartStats {
  total: number;
  byType: { type: string; count: number }[];
  bySystem: { system: string; count: number }[];
  byBeyType: { beyType: string; count: number }[];
  missingImage: number;
  recentlyUpdated: number;
}

type BeybladeWithParts = Beyblade & {
  blade: Part;
  ratchet: Part;
  bit: Part;
  product: Product | null;
};

// ──── Constants ────

const TYPE_LABELS: Record<string, string> = {
  BLADE: "Blades",
  RATCHET: "Ratchets",
  BIT: "Bits",
  OVER_BLADE: "Over Blades",
  LOCK_CHIP: "Lock Chips",
  ASSIST_BLADE: "Assist Blades",
};

// Category colors - BLADE and ATTACK use theme primary via CSS variable
const TYPE_COLORS: Record<string, string> = {
  BLADE: "var(--rpb-primary)",
  RATCHET: "#f59e0b",
  BIT: "#3b82f6",
  OVER_BLADE: "#8b5cf6",
  LOCK_CHIP: "#ec4899",
  ASSIST_BLADE: "#06b6d4",
};

// Helper to get alpha-safe background color for category colors
// CSS variables can't use hex-alpha concatenation, so we use rgba() with --rgb variant
const getTypeBg = (type: string) =>
  type === "BLADE" ? "rgba(var(--rpb-primary-rgb), 0.13)" : `${TYPE_COLORS[type] || "#666"}22`;

const BEYTYPE_COLORS: Record<string, string> = {
  ATTACK: "var(--rpb-primary)",
  DEFENSE: "#3b82f6",
  STAMINA: "#22c55e",
  BALANCE: "#a855f7",
};

const getBeyTypeBg = (type: string) =>
  type === "ATTACK" ? "rgba(var(--rpb-primary-rgb), 0.13)" : `${BEYTYPE_COLORS[type] || "#666"}22`;

// ──── Main Page ────

export default function AdminPartsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<PartStats | null>(null);

  useEffect(() => {
    void getPartsStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <Box>
      <PageHeader
        title="Gestion des Pièces & Beyblades"
        description="Base de données complète du Builder Beyblade X"
      />
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2 }}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                  }}
                >
                  Total Pièces
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: "bold",
                  }}
                >
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {stats.byType.map((t) => (
            <Grid key={t.type} size={{ xs: 6, md: 2 }}>
              <Card
                variant="outlined"
                sx={{
                  borderLeft: `3px solid ${TYPE_COLORS[t.type] || "#666"}`,
                }}
              >
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    {TYPE_LABELS[t.type] || t.type}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: "bold",
                    }}
                  >
                    {t.count}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {stats.missingImage > 0 && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined" sx={{ borderLeft: "3px solid #f59e0b" }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "warning.main",
                    }}
                  >
                    Sans image
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: "bold",
                      color: "warning.main",
                    }}
                  >
                    {stats.missingImage}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<Inventory2 />} label="Pièces" iconPosition="start" />
        <Tab icon={<Extension />} label="Beyblades" iconPosition="start" />
        <Tab icon={<FileUpload />} label="Import" iconPosition="start" />
      </Tabs>
      {activeTab === 0 && <PartsTab onStatsChange={() => getPartsStats().then(setStats)} />}
      {activeTab === 1 && <BeybladesTab />}
      {activeTab === 2 && <ImportTab onStatsChange={() => getPartsStats().then(setStats)} />}
    </Box>
  );
}

// ──── Parts Tab ────

function PartsTab({ onStatsChange }: { onStatsChange: () => void }) {
  const [rows, setRows] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterSystem, setFilterSystem] = useState<string>("");
  const [filterBeyType, setFilterBeyType] = useState<string>("");
  const [filterMissingImage, setFilterMissingImage] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { parts, total: t } = await getParts(search, page, {
      type: filterType as PartType | undefined,
      system: filterSystem || undefined,
      beyType: filterBeyType || undefined,
      missingImage: filterMissingImage || undefined,
    });
    setRows(parts);
    setTotal(t);
    setLoading(false);
  }, [search, page, filterType, filterSystem, filterBeyType, filterMissingImage]);

  useEffect(() => {
    const timer = setTimeout(loadData, 400);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleSubmit = async (data: Partial<Part>) => {
    try {
      await upsertPart(data);
      showToast("Pièce sauvegardée", "success");
      loadData();
      onStatsChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      showToast(msg, "error");
    }
  };

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm("Supprimer cette pièce ?")) {
        try {
          await deletePart(id);
          showToast("Pièce supprimée", "success");
          loadData();
          onStatsChange();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erreur lors de la suppression";
          showToast(msg, "error");
        }
      }
    },
    [loadData, onStatsChange, showToast],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await duplicatePart(id);
        showToast("Pièce dupliquée", "success");
        loadData();
        onStatsChange();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur lors de la duplication";
        showToast(msg, "error");
      }
    },
    [loadData, onStatsChange, showToast],
  );

  const processRowUpdate = async (newRow: GridRowModel) => {
    const updatedPart = newRow as Part;
    try {
      await upsertPart(updatedPart);
      showToast("Modification enregistrée", "success");
      onStatsChange();
      return updatedPart;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      showToast(msg, "error");
      throw err;
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parts-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "imageUrl",
        headerName: "",
        width: 56,
        renderCell: (params) => (
          <Avatar
            src={params.value}
            variant="rounded"
            sx={{
              width: 36,
              height: 36,
              bgcolor: "transparent",
              border: "1px solid",
              borderColor: "divider",
              fontSize: 14,
            }}
          >
            {params.value ? undefined : <HideImage sx={{ fontSize: 16, opacity: 0.3 }} />}
          </Avatar>
        ),
      },
      {
        field: "name",
        headerName: "Nom",
        flex: 1,
        minWidth: 140,
        editable: true,
      },
      {
        field: "type",
        headerName: "Type",
        width: 130,
        type: "singleSelect",
        valueOptions: Object.keys(TYPE_LABELS),
        editable: true,
        renderCell: (params) => (
          <Chip
            label={TYPE_LABELS[params.value] || params.value}
            size="small"
            sx={{
              bgcolor: getTypeBg(params.value),
              color: TYPE_COLORS[params.value] || "#666",
              fontWeight: 600,
              fontSize: "0.7rem",
            }}
          />
        ),
      },
      { field: "system", headerName: "Sys.", width: 65, editable: true },
      {
        field: "beyType",
        headerName: "Bey",
        width: 90,
        type: "singleSelect",
        valueOptions: ["ATTACK", "DEFENSE", "STAMINA", "BALANCE"],
        editable: true,
        renderCell: (params) =>
          params.value ? (
            <Chip
              label={params.value.slice(0, 3)}
              size="small"
              sx={{
                bgcolor: getBeyTypeBg(params.value),
                color: BEYTYPE_COLORS[params.value],
                fontWeight: 700,
                fontSize: "0.7rem",
              }}
            />
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
              }}
            >
              —
            </Typography>
          ),
      },
      {
        field: "weight",
        headerName: "Poids",
        width: 70,
        type: "number",
        editable: true,
        valueFormatter: (v: number | null) => (v ? `${v}g` : "—"),
      },
      { field: "spinDirection", headerName: "Rot.", width: 60, editable: true },
      { field: "attack", headerName: "Atk", width: 50, editable: true },
      { field: "defense", headerName: "Def", width: 50, editable: true },
      { field: "stamina", headerName: "Sta", width: 50, editable: true },
      { field: "dash", headerName: "Dsh", width: 50, editable: true },
      { field: "burst", headerName: "Bst", width: 50, editable: true },
      { field: "rarity", headerName: "Rar.", width: 70, editable: true },
      {
        field: "updatedAt",
        headerName: "MAJ",
        width: 90,
        valueFormatter: (v: string) => new Date(v).toLocaleDateString("fr-FR"),
      },
      {
        field: "actions",
        headerName: "",
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={0}>
            <IconButton
              size="small"
              onClick={() => {
                setSelectedPart(params.row);
                setDialogOpen(true);
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDuplicate(params.row.id)}>
              <ContentCopy fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [handleDelete, handleDuplicate],
  );

  return (
    <>
      {/* Toolbar */}
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {/* Search - full width on mobile */}
        <TextField
          placeholder="Rechercher (nom, ID, JP)..."
          size="small"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          fullWidth
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

        {/* Filters row - wraps on mobile */}
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TextField
            select
            size="small"
            label="Type"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "calc(50% - 4px)", sm: 130 } }}
          >
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Système"
            value={filterSystem}
            onChange={(e) => {
              setFilterSystem(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "calc(50% - 4px)", sm: 100 } }}
          >
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="BX">BX</MenuItem>
            <MenuItem value="UX">UX</MenuItem>
            <MenuItem value="CX">CX</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Bey Type"
            value={filterBeyType}
            onChange={(e) => {
              setFilterBeyType(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "calc(50% - 4px)", sm: 120 } }}
          >
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="ATTACK">Attack</MenuItem>
            <MenuItem value="DEFENSE">Defense</MenuItem>
            <MenuItem value="STAMINA">Stamina</MenuItem>
            <MenuItem value="BALANCE">Balance</MenuItem>
          </TextField>
          <Button
            size="small"
            variant={filterMissingImage ? "contained" : "outlined"}
            color="warning"
            onClick={() => {
              setFilterMissingImage(!filterMissingImage);
              setPage(1);
            }}
            sx={{ minHeight: 40 }}
          >
            <HideImage sx={{ fontSize: 18 }} />
          </Button>
        </Stack>

        {/* Action buttons */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "flex-end",
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportJSON}
          >
            Export
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedPart(null);
              setDialogOpen(true);
            }}
          >
            Ajouter
          </Button>
        </Stack>
      </Stack>
      {/* Pagination info */}
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          mb: 1,
          display: "block",
        }}
      >
        {total} résultat{total !== 1 ? "s" : ""}
        {page > 1 && ` — Page ${page}`}
      </Typography>
      {/* DataGrid */}
      <Card sx={{ height: { xs: "60vh", md: "68vh" }, overflow: "auto" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={(error) => console.error(error)}
          paginationMode="server"
          rowCount={total}
          paginationModel={{ page: page - 1, pageSize: 100 }}
          onPaginationModelChange={(m) => setPage(m.page + 1)}
          pageSizeOptions={[100]}
          density="compact"
          sx={{
            minWidth: 600,
            "& .MuiDataGrid-cell--editable": { bgcolor: "action.hover" },
            "& .MuiDataGrid-row:hover": { bgcolor: "action.selected" },
          }}
        />
      </Card>
      <PartDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedPart}
      />
    </>
  );
}

// ──── Beyblades Tab ────

function BeybladesTab() {
  const [beyblades, setBeyblades] = useState<BeybladeWithParts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getBeyblades(search || undefined);
    setBeyblades(data as BeybladeWithParts[]);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadData, 400);
    return () => clearTimeout(timer);
  }, [loadData]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "imageUrl",
        headerName: "",
        width: 56,
        renderCell: (params) => (
          <Avatar
            src={params.value}
            variant="rounded"
            sx={{ width: 36, height: 36, bgcolor: "transparent" }}
          >
            <Extension />
          </Avatar>
        ),
      },
      { field: "code", headerName: "Code", width: 120 },
      { field: "name", headerName: "Nom", flex: 1, minWidth: 160 },
      {
        field: "blade",
        headerName: "Blade",
        width: 130,
        valueGetter: (_v: unknown, row: BeybladeWithParts) => row.blade?.name,
      },
      {
        field: "ratchet",
        headerName: "Ratchet",
        width: 100,
        valueGetter: (_v: unknown, row: BeybladeWithParts) => row.ratchet?.name,
      },
      {
        field: "bit",
        headerName: "Bit",
        width: 100,
        valueGetter: (_v: unknown, row: BeybladeWithParts) => row.bit?.name,
      },
      {
        field: "beyType",
        headerName: "Type",
        width: 90,
        renderCell: (params) =>
          params.value ? (
            <Chip
              label={params.value.slice(0, 3)}
              size="small"
              sx={{
                bgcolor: getBeyTypeBg(params.value),
                color: BEYTYPE_COLORS[params.value],
                fontWeight: 700,
              }}
            />
          ) : null,
      },
      {
        field: "totalWeight",
        headerName: "Poids",
        width: 70,
        valueFormatter: (v: number | null) => (v ? `${v.toFixed(1)}g` : "—"),
      },
      {
        field: "totalAttack",
        headerName: "Atk",
        width: 50,
      },
      { field: "totalDefense", headerName: "Def", width: 50 },
      { field: "totalStamina", headerName: "Sta", width: 50 },
      { field: "totalDash", headerName: "Dsh", width: 50 },
      { field: "totalBurst", headerName: "Bst", width: 50 },
      {
        field: "product",
        headerName: "Produit",
        width: 130,
        valueGetter: (_v: unknown, row: BeybladeWithParts) => row.product?.name ?? "—",
      },
    ],
    [],
  );

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { sm: "center" },
          mb: 2,
        }}
      >
        <TextField
          placeholder="Rechercher un Beyblade..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ maxWidth: { sm: 350 } }}
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
        <Badge badgeContent={beyblades.length} color="primary">
          <Chip label="Beyblades enregistrés" />
        </Badge>
      </Stack>
      <Card sx={{ height: { xs: "60vh", md: "68vh" }, overflow: "auto" }}>
        <DataGrid
          rows={beyblades}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
          }}
          pageSizeOptions={[50, 100]}
          sx={{ minWidth: 600 }}
        />
      </Card>
    </>
  );
}

// ──── Import Tab ────

function ImportTab({ onStatsChange }: { onStatsChange: () => void }) {
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const { showToast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const partsArray = Array.isArray(parsed) ? parsed : [parsed];
      const res = await bulkImportParts(partsArray);
      setResult(res);
      showToast(
        `Import terminé : ${res.created} créées, ${res.updated} mises à jour`,
        res.errors.length > 0 ? "warning" : "success",
      );
      onStatsChange();
    } catch (err) {
      showToast(`Erreur JSON : ${String(err)}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const exampleJson = JSON.stringify(
    [
      {
        name: "Dran Sword",
        type: "BLADE",
        system: "BX",
        beyType: "ATTACK",
        weight: 28.5,
        spinDirection: "Right",
        attack: "7",
        defense: "3",
        stamina: "1",
        dash: "5",
        burst: "4",
        imageUrl: "https://...",
      },
    ],
    null,
    2,
  );

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: "bold",
              }}
            >
              Import en masse (JSON)
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 2,
              }}
            >
              Importez un tableau JSON de pièces. Les pièces existantes (par externalId) seront
              mises à jour, les nouvelles seront créées.
            </Typography>

            <Button component="label" variant="outlined" startIcon={<FileUpload />} sx={{ mb: 2 }}>
              Charger un fichier JSON
              <input
                type="file"
                accept=".json"
                hidden
                aria-label="Charger un fichier JSON de pièces"
                onChange={handleFileUpload}
              />
            </Button>

            <TextField
              fullWidth
              multiline
              rows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Collez votre JSON ici ou chargez un fichier..."
              sx={{
                mb: 2,
                "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" },
              }}
            />

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={handleImport}
                disabled={importing || !jsonInput.trim()}
                startIcon={importing ? <CircularProgress size={20} /> : <FileUpload />}
              >
                {importing ? "Import en cours..." : "Importer"}
              </Button>
              <Button variant="outlined" onClick={() => setJsonInput(exampleJson)}>
                Voir exemple
              </Button>
            </Stack>

            {result && (
              <Box sx={{ mt: 3 }}>
                <Alert severity={result.errors.length > 0 ? "warning" : "success"}>
                  <strong>
                    {result.created} créée{result.created !== 1 ? "s" : ""}, {result.updated} mise
                    {result.updated !== 1 ? "s" : ""} à jour
                  </strong>
                  {result.errors.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {result.errors.map((e, i) => (
                        <Typography
                          key={i}
                          variant="caption"
                          sx={{
                            display: "block",
                          }}
                        >
                          {e}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Alert>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{
                  fontWeight: "bold",
                }}
              >
                Format attendu
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                Tableau JSON avec les champs suivants :
              </Typography>
              <Box
                component="pre"
                sx={{
                  mt: 1,
                  p: 1.5,
                  bgcolor: "#0d1117",
                  color: "#c9d1d9",
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  overflow: "auto",
                  maxHeight: 300,
                }}
              >
                {`{
  "name": "string (requis)",
  "type": "BLADE | RATCHET | BIT | ...",
  "externalId": "string (auto si absent)",
  "system": "BX | UX | CX",
  "beyType": "ATTACK | DEFENSE | ...",
  "weight": 28.5,
  "spinDirection": "Right | Left",
  "attack": "7",
  "defense": "3",
  "stamina": "1",
  "dash": "5",
  "burst": "4",
  "height": 12,
  "protrusions": 3,
  "gearRatio": "string",
  "shaftWidth": "string",
  "tipType": "string",
  "rarity": "Common | Rare | ...",
  "imageUrl": "https://...",
  "nameJp": "ドランソード"
}`}
              </Box>
            </CardContent>
          </Card>

          <Alert severity="info">
            Les champs <strong>name</strong> et <strong>type</strong> sont obligatoires. Tous les
            autres sont optionnels. L'
            <strong>externalId</strong> est généré automatiquement si absent (format: type-nom).
          </Alert>
        </Stack>
      </Grid>
    </Grid>
  );
}
