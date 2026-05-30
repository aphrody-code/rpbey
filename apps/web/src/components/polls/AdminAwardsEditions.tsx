"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SaveIcon from "@mui/icons-material/Save";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { AwardsEdition, AwardsEditionsResponse } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { pollsFetcher, pollsMutate } from "./shared";

const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

interface EditionDraft {
  title: string;
  description: string;
  videoUrl: string;
  isPublished: boolean;
  isVotingOpen: boolean;
}

function toDraft(e: AwardsEdition): EditionDraft {
  return {
    title: e.title,
    description: e.description ?? "",
    videoUrl: e.videoUrl ?? "",
    isPublished: e.isPublished,
    isVotingOpen: e.isVotingOpen,
  };
}

/** Carte d'édition d'une édition Beyblade Awards (méta + vidéo + visibilité). */
function EditionCard({ edition, onSaved }: { edition: AwardsEdition; onSaved: () => void }) {
  const theme = useTheme();
  const { showToast } = useToast();
  const gold = "#ffca28";

  const [draft, setDraft] = useState<EditionDraft>(() => toDraft(edition));
  const [saving, setSaving] = useState(false);

  // Resynchronise le brouillon si l'édition est rechargée (mutate global).
  useEffect(() => {
    setDraft(toDraft(edition));
  }, [edition]);

  const dirty =
    draft.title !== edition.title ||
    draft.description !== (edition.description ?? "") ||
    draft.videoUrl !== (edition.videoUrl ?? "") ||
    draft.isPublished !== edition.isPublished ||
    draft.isVotingOpen !== edition.isVotingOpen;

  const set = (patch: Partial<EditionDraft>) => setDraft((p) => ({ ...p, ...patch }));

  const save = async () => {
    if (draft.title.trim().length < 2) {
      showToast("Le titre doit faire au moins 2 caractères.", "warning");
      return;
    }
    setSaving(true);
    try {
      await pollsMutate(`/api/admin/awards/${edition.year}`, "PATCH", {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        videoUrl: draft.videoUrl.trim() || null,
        isPublished: draft.isPublished,
        isVotingOpen: draft.isVotingOpen,
      });
      showToast(`Édition ${edition.year} enregistrée.`, "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.", "error");
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
        borderColor: edition.isPublished ? alpha(gold, 0.4) : "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.7),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <EmojiEventsIcon sx={{ color: gold, fontSize: 30 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Édition {edition.year}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {edition.categoryCount} catégorie{edition.categoryCount > 1 ? "s" : ""} ·{" "}
                {edition.pollCategory}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.5 }}>
            <Chip
              size="small"
              label={edition.isPublished ? "Publiée" : "Cachée"}
              color={edition.isPublished ? "success" : "default"}
              variant={edition.isPublished ? "filled" : "outlined"}
            />
            <Chip
              size="small"
              label={edition.isVotingOpen ? "Votes ouverts" : "Votes fermés"}
              color={edition.isVotingOpen ? "primary" : "default"}
              variant="outlined"
            />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Titre"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            sx={inputSx}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Description"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            sx={inputSx}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { sm: "center" } }}
          >
            <TextField
              fullWidth
              label="URL de la vidéo YouTube"
              placeholder="https://www.youtube.com/watch?v=..."
              value={draft.videoUrl}
              onChange={(e) => set({ videoUrl: e.target.value })}
              helperText="La vidéo de résultats affichée sur le hub des sondages."
              sx={inputSx}
            />
            {edition.videoId && (
              <Button
                component="a"
                href={`https://www.youtube.com/watch?v=${edition.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                variant="outlined"
                endIcon={<OpenInNewIcon />}
                sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
              >
                Voir
              </Button>
            )}
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.isPublished}
                    onChange={(e) => set({ isPublished: e.target.checked })}
                  />
                }
                label="Publiée"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.isVotingOpen}
                    onChange={(e) => set({ isVotingOpen: e.target.checked })}
                  />
                }
                label="Votes ouverts"
              />
            </Stack>
            <Button
              variant="contained"
              onClick={save}
              disabled={saving || !dirty}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              sx={{ borderRadius: 3, px: 3, fontWeight: 800, textTransform: "none" }}
            >
              Enregistrer
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Section admin de gestion des éditions Beyblade Awards : liste toutes les éditions
 * (`GET /api/admin/awards`, dont les éditions cachées) avec, pour chacune, un
 * mini-formulaire titre / description / vidéo / publication / votes
 * (`PATCH /api/admin/awards/{year}`). Permet notamment de publier l'édition 2026.
 */
export function AdminAwardsEditions() {
  const { data, isLoading, mutate } = useSWR<AwardsEditionsResponse>(
    "/api/admin/awards",
    pollsFetcher,
  );
  const reload = () => mutate();

  const editions = [...(data?.editions ?? [])].sort((a, b) => b.year - a.year);

  return (
    <Box sx={{ mt: 5 }}>
      <Stack spacing={0.5} sx={{ mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <EmojiEventsIcon sx={{ fontSize: 28, color: "#ffca28" }} />
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
            Éditions Beyblade Awards
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Définis la vidéo de résultats, publie une édition (ex. 2026) et ouvre ou ferme les votes.
        </Typography>
      </Stack>

      {isLoading && <CircularProgress size={22} />}
      {!isLoading && editions.length === 0 && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Aucune édition d'awards configurée.
        </Typography>
      )}

      <Stack spacing={2}>
        {editions.map((edition) => (
          <EditionCard key={edition.year} edition={edition} onSaved={reload} />
        ))}
      </Stack>
    </Box>
  );
}
