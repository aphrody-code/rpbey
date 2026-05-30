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
import { POLL_KINDS, type PollKind } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { AWARDS_CATEGORY, POLL_KIND_LABELS, pollsMutate } from "./shared";

interface OptionDraft {
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

/** Formulaire de création d'un sondage (options dynamiques add/remove). */
export function AdminPollForm({ onCreated }: { onCreated: () => void }) {
  const theme = useTheme();
  const { showToast } = useToast();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<PollKind>("SINGLE");
  const [category, setCategory] = useState("");
  const [season, setSeason] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const addOption = () => setOptions((p) => [...p, { label: "", imageUrl: "" }]);
  const removeOption = (i: number) =>
    setOptions((p) => (p.length > 2 ? p.filter((_, idx) => idx !== i) : p));
  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    setOptions((p) => p.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const reset = () => {
    setQuestion("");
    setDescription("");
    setKind("SINGLE");
    setCategory("");
    setSeason("");
    setIsFeatured(false);
    setOptions([
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
    ]);
  };

  const submit = async () => {
    const cleanOptions = options
      .map((o) => ({ label: o.label.trim(), imageUrl: o.imageUrl.trim() || undefined }))
      .filter((o) => o.label.length > 0);
    if (question.trim().length < 3) {
      showToast("La question doit faire au moins 3 caractères.", "warning");
      return;
    }
    if (cleanOptions.length < 2) {
      showToast("Renseigne au moins 2 options.", "warning");
      return;
    }
    setSaving(true);
    try {
      await pollsMutate<{ slug: string }>("/api/admin/polls", "POST", {
        question: question.trim(),
        description: description.trim() || undefined,
        kind,
        category: category.trim() || undefined,
        season: season || undefined,
        isFeatured,
        options: cleanOptions,
      });
      showToast("Sondage créé !", "success");
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
          Créer un sondage
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
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
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Type"
              value={kind}
              onChange={(e) => setKind(e.target.value as PollKind)}
              sx={inputSx}
            >
              {POLL_KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {POLL_KIND_LABELS[k]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              fullWidth
              label="Catégorie (optionnelle)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              helperText="Ex. regroupement de sondages liés."
              sx={inputSx}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
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
          <Grid size={{ xs: 12 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setCategory(AWARDS_CATEGORY)}
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              Pré-remplir : « {AWARDS_CATEGORY} »
            </Button>
            <Button
              size="small"
              variant={isFeatured ? "contained" : "outlined"}
              onClick={() => setIsFeatured((v) => !v)}
              sx={{ ml: 1, textTransform: "none", borderRadius: 2 }}
            >
              {isFeatured ? "Mis en avant" : "Mettre en avant"}
            </Button>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 0.5 }} />
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Options ({options.length})
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addOption}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Ajouter
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {options.map((o, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Option ${i + 1}`}
                    value={o.label}
                    onChange={(e) => setOption(i, { label: e.target.value })}
                    sx={inputSx}
                  />
                  <TextField
                    size="small"
                    label="Image (URL)"
                    value={o.imageUrl}
                    onChange={(e) => setOption(i, { imageUrl: e.target.value })}
                    sx={{ ...inputSx, width: { xs: 120, sm: 220 } }}
                  />
                  <IconButton
                    aria-label="Supprimer l'option"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
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
                onClick={submit}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={{ borderRadius: 3, px: 3, fontWeight: 800, textTransform: "none" }}
              >
                Créer le sondage
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
