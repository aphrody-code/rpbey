"use client";

import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Grid as MuiGrid,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type BeyType, type Part, type PartType } from "@/lib/types";

interface PartDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Part>) => Promise<void>;
  initialData?: Part | null;
}

const STAT_FIELDS = ["attack", "defense", "stamina", "dash", "burst"] as const;

const STAT_COLORS: Record<string, string> = {
  attack: "var(--rpb-primary)",
  defense: "#3b82f6",
  stamina: "#22c55e",
  dash: "#f59e0b",
  burst: "#a855f7",
};

export function PartDialog({ open, onClose, onSubmit, initialData }: PartDialogProps) {
  const [form, setForm] = useState<Partial<Part>>({});
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ type: "BLADE", system: "BX" });
    }
  }, [initialData]);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
    onClose();
  };

  const update = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
          }}
        >
          {/* Preview */}
          <Avatar
            src={form.imageUrl || undefined}
            variant="rounded"
            sx={{
              width: 56,
              height: 56,
              bgcolor: "#1a1a2e",
              border: "2px solid",
              borderColor: "divider",
            }}
          >
            {form.name?.charAt(0) || "?"}
          </Avatar>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: "bold",
              }}
            >
              {initialData ? "Modifier la pièce" : "Nouvelle pièce"}
            </Typography>
            {form.name && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                }}
              >
                {form.name}
                {form.system && (
                  <Chip
                    label={form.system}
                    size="small"
                    sx={{ ml: 1, height: 18, fontSize: "0.65rem" }}
                  />
                )}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Identity */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              Identité
            </Typography>
            <MuiGrid container spacing={2} sx={{ mt: 0.5 }}>
              <MuiGrid size={{ xs: 12, sm: 8 }}>
                <TextField
                  label="Nom *"
                  fullWidth
                  size="small"
                  value={form.name || ""}
                  onChange={(e) => update("name", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Nom Japonais"
                  fullWidth
                  size="small"
                  value={form.nameJp || ""}
                  onChange={(e) => update("nameJp", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 4 }}>
                <TextField
                  select
                  label="Type *"
                  fullWidth
                  size="small"
                  value={form.type || "BLADE"}
                  onChange={(e) => update("type", e.target.value as PartType)}
                >
                  <MenuItem value="BLADE">Blade</MenuItem>
                  <MenuItem value="OVER_BLADE">Over Blade</MenuItem>
                  <MenuItem value="RATCHET">Ratchet</MenuItem>
                  <MenuItem value="BIT">Bit</MenuItem>
                  <MenuItem value="LOCK_CHIP">Lock Chip</MenuItem>
                  <MenuItem value="ASSIST_BLADE">Assist Blade</MenuItem>
                </TextField>
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 4 }}>
                <TextField
                  select
                  label="Système"
                  fullWidth
                  size="small"
                  value={form.system || "BX"}
                  onChange={(e) => update("system", e.target.value)}
                >
                  <MenuItem value="BX">BX</MenuItem>
                  <MenuItem value="UX">UX</MenuItem>
                  <MenuItem value="CX">CX</MenuItem>
                </TextField>
              </MuiGrid>
              <MuiGrid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="ID Externe"
                  fullWidth
                  size="small"
                  value={form.externalId || ""}
                  onChange={(e) => update("externalId", e.target.value)}
                  placeholder="Auto-généré si vide"
                />
              </MuiGrid>
            </MuiGrid>
          </Box>

          <Divider />

          {/* Classification */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              Classification
            </Typography>
            <MuiGrid container spacing={2} sx={{ mt: 0.5 }}>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  select
                  label="Type Bey"
                  fullWidth
                  size="small"
                  value={form.beyType || ""}
                  onChange={(e) => update("beyType", e.target.value as BeyType)}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="ATTACK">Attack</MenuItem>
                  <MenuItem value="DEFENSE">Defense</MenuItem>
                  <MenuItem value="STAMINA">Stamina</MenuItem>
                  <MenuItem value="BALANCE">Balance</MenuItem>
                </TextField>
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  select
                  label="Rotation"
                  fullWidth
                  size="small"
                  value={form.spinDirection || ""}
                  onChange={(e) => update("spinDirection", e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="Right">Right</MenuItem>
                  <MenuItem value="Left">Left</MenuItem>
                  <MenuItem value="Dual">Dual</MenuItem>
                </TextField>
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Rareté"
                  fullWidth
                  size="small"
                  value={form.rarity || ""}
                  onChange={(e) => update("rarity", e.target.value)}
                  placeholder="Common, Rare..."
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Date de sortie"
                  type="date"
                  fullWidth
                  size="small"
                  value={
                    form.releaseDate ? new Date(form.releaseDate).toISOString().split("T")[0] : ""
                  }
                  onChange={(e) =>
                    update("releaseDate", e.target.value ? new Date(e.target.value) : null)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </MuiGrid>
            </MuiGrid>
          </Box>

          <Divider />

          {/* Physical Specs */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              Spécifications physiques
            </Typography>
            <MuiGrid container spacing={2} sx={{ mt: 0.5 }}>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Poids (g)"
                  type="number"
                  fullWidth
                  size="small"
                  value={form.weight ?? ""}
                  onChange={(e) =>
                    update("weight", e.target.value ? parseFloat(e.target.value) : null)
                  }
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Hauteur (mm)"
                  type="number"
                  fullWidth
                  size="small"
                  value={form.height ?? ""}
                  onChange={(e) =>
                    update("height", e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Protrusions"
                  type="number"
                  fullWidth
                  size="small"
                  value={form.protrusions ?? ""}
                  onChange={(e) =>
                    update("protrusions", e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Gear Ratio"
                  fullWidth
                  size="small"
                  value={form.gearRatio || ""}
                  onChange={(e) => update("gearRatio", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 4 }}>
                <TextField
                  label="Shaft Width"
                  fullWidth
                  size="small"
                  value={form.shaftWidth || ""}
                  onChange={(e) => update("shaftWidth", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6, sm: 4 }}>
                <TextField
                  label="Tip Type"
                  fullWidth
                  size="small"
                  value={form.tipType || ""}
                  onChange={(e) => update("tipType", e.target.value)}
                />
              </MuiGrid>
            </MuiGrid>
          </Box>

          <Divider />

          {/* Stats */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              Stats
            </Typography>
            <MuiGrid container spacing={2} sx={{ mt: 0.5 }}>
              {STAT_FIELDS.map((stat) => (
                <MuiGrid key={stat} size={{ xs: 4, sm: 2.4 }}>
                  <TextField
                    label={stat.charAt(0).toUpperCase() + stat.slice(1)}
                    fullWidth
                    size="small"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value={(form as any)[stat] || ""}
                    onChange={(e) => update(stat, e.target.value)}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderColor: STAT_COLORS[stat],
                      },
                      "& label": { color: STAT_COLORS[stat] },
                    }}
                  />
                </MuiGrid>
              ))}
            </MuiGrid>
            {/* Visual stat bar */}
            <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
              {STAT_FIELDS.map((stat) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const val = parseInt((form as any)[stat] || "0", 10);
                return (
                  <Box key={stat} sx={{ flex: 1, textAlign: "center" }}>
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "#222",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          height: "100%",
                          width: `${Math.min(val * 10, 100)}%`,
                          bgcolor: STAT_COLORS[stat],
                          borderRadius: 3,
                          transition: "width 0.3s",
                        }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.65rem",
                      }}
                    >
                      {stat.slice(0, 3).toUpperCase()} {val || "—"}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Divider />

          {/* Media */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              Médias
            </Typography>
            <MuiGrid container spacing={2} sx={{ mt: 0.5 }}>
              <MuiGrid size={{ xs: 12 }}>
                <TextField
                  label="URL Image"
                  fullWidth
                  size="small"
                  value={form.imageUrl || ""}
                  onChange={(e) => update("imageUrl", e.target.value)}
                />
              </MuiGrid>
              {form.imageUrl && (
                <MuiGrid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "#0d1117",
                      borderRadius: 2,
                      textAlign: "center",
                    }}
                  >
                    <Box
                      component="img"
                      src={form.imageUrl}
                      alt="Preview"
                      sx={{
                        maxHeight: 120,
                        maxWidth: "100%",
                        objectFit: "contain",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </Box>
                </MuiGrid>
              )}
              <MuiGrid size={{ xs: 6 }}>
                <TextField
                  label="URL Modèle 3D (OBJ)"
                  fullWidth
                  size="small"
                  value={form.modelUrl || ""}
                  onChange={(e) => update("modelUrl", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6 }}>
                <TextField
                  label="URL Texture"
                  fullWidth
                  size="small"
                  value={form.textureUrl || ""}
                  onChange={(e) => update("textureUrl", e.target.value)}
                />
              </MuiGrid>
            </MuiGrid>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !form.name || !form.type}
        >
          {loading ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
