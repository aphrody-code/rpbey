"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SaveIcon from "@mui/icons-material/Save";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { TIER_LIST_KINDS, type TierListKind } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { pollsMutate, TIER_LIST_KIND_LABELS } from "./shared";

interface SubjectDraft {
  label: string;
  imageUrl: string;
}

const SEASONS = ["", "ORIGINAL", "METAL", "BURST", "X"] as const;
const SEASON_LABELS: Record<string, string> = {
  "": "Aucune",
  ORIGINAL: "Original",
  METAL: "Metal Saga",
  BURST: "Burst",
  X: "Beyblade X",
};

const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

/** Formulaire de création d'une tier list (sujets dynamiques add/remove, min 3). */
export function AdminTierListForm({ onCreated }: { onCreated: () => void }) {
  const theme = useTheme();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<TierListKind>("BEY");
  const [season, setSeason] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [subjects, setSubjects] = useState<SubjectDraft[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const addSubject = () => setSubjects((p) => [...p, { label: "", imageUrl: "" }]);
  const removeSubject = (i: number) =>
    setSubjects((p) => (p.length > 3 ? p.filter((_, idx) => idx !== i) : p));
  const setSubject = (i: number, patch: Partial<SubjectDraft>) =>
    setSubjects((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const reset = () => {
    setTitle("");
    setDescription("");
    setKind("BEY");
    setSeason("");
    setIsFeatured(false);
    setSubjects([
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
    ]);
  };

  const submit = async () => {
    const cleanSubjects = subjects
      .map((s) => ({ label: s.label.trim(), imageUrl: s.imageUrl.trim() || undefined }))
      .filter((s) => s.label.length > 0);
    if (title.trim().length < 3) {
      showToast("Le titre doit faire au moins 3 caractères.", "warning");
      return;
    }
    if (cleanSubjects.length < 3) {
      showToast("Renseigne au moins 3 sujets.", "warning");
      return;
    }
    setSaving(true);
    try {
      await pollsMutate<{ slug: string }>("/api/admin/tier-lists", "POST", {
        title: title.trim(),
        description: description.trim() || undefined,
        kind,
        season: season || undefined,
        isFeatured,
        subjects: cleanSubjects,
      });
      showToast("Tier list créée !", "success");
      reset();
      onCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur lors de la création.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.7),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>
          Créer une tier list
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={inputSx}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Description (optionnelle)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={inputSx}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              select
              fullWidth
              label="Type"
              value={kind}
              onChange={(e) => setKind(e.target.value as TierListKind)}
              sx={inputSx}
            >
              {TIER_LIST_KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {TIER_LIST_KIND_LABELS[k]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Saison"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              sx={inputSx}
            >
              {SEASONS.map((s) => (
                <MenuItem key={s || "none"} value={s}>
                  {SEASON_LABELS[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              fullWidth
              variant={isFeatured ? "contained" : "outlined"}
              onClick={() => setIsFeatured((v) => !v)}
              sx={{ height: "100%", textTransform: "none", borderRadius: 3 }}
            >
              {isFeatured ? "Mise en avant" : "Mettre en avant"}
            </Button>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 0.5 }} />
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Sujets ({subjects.length})
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addSubject}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Ajouter
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {subjects.map((s, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Sujet ${i + 1}`}
                    value={s.label}
                    onChange={(e) => setSubject(i, { label: e.target.value })}
                    sx={inputSx}
                  />
                  <TextField
                    size="small"
                    label="Image (URL)"
                    value={s.imageUrl}
                    onChange={(e) => setSubject(i, { imageUrl: e.target.value })}
                    sx={{ ...inputSx, width: { xs: 120, sm: 220 } }}
                  />
                  <IconButton
                    aria-label="Supprimer le sujet"
                    onClick={() => removeSubject(i)}
                    disabled={subjects.length <= 3}
                    color="error"
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={submit}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={{ borderRadius: 3, px: 3, fontWeight: 800, textTransform: "none" }}
              >
                Créer la tier list
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
