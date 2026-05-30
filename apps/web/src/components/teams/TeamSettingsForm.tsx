"use client";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LogoutIcon from "@mui/icons-material/Logout";
import SaveIcon from "@mui/icons-material/Save";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { TeamDetail, TeamRole, TeamUpdateInput } from "@rpbey/api-contract";
import { useConfirmDialog, useToast } from "@/components/ui";
import { canManage, teamsMutate, TEAM_REGIONS } from "./shared";

interface FormValues {
  name: string;
  description: string;
  region: string;
  accentColor: string;
  logoUrl: string;
  bannerUrl: string;
  isRecruiting: string;
  twitterHandle: string;
  instagramHandle: string;
  youtubeHandle: string;
  twitchHandle: string;
  discordInvite: string;
  websiteUrl: string;
}

function clean(value: string): string | undefined {
  const v = value.trim();
  return v === "" ? undefined : v;
}

export function TeamSettingsForm({
  team,
  role,
  onUpdated,
  onLeftOrDissolved,
}: {
  team: TeamDetail;
  role: TeamRole;
  onUpdated: () => void;
  onLeftOrDissolved: () => void;
}) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [saving, setSaving] = useState(false);
  const manage = canManage(role);
  const isCaptain = role === "CAPTAIN";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: team.name,
      description: team.description ?? "",
      region: team.region ?? "",
      accentColor: team.accentColor ?? "#7c3aed",
      logoUrl: team.logoUrl ?? "",
      bannerUrl: team.bannerUrl ?? "",
      isRecruiting: team.isRecruiting ? "true" : "false",
      twitterHandle: team.socials.twitterHandle ?? "",
      instagramHandle: team.socials.instagramHandle ?? "",
      youtubeHandle: team.socials.youtubeHandle ?? "",
      twitchHandle: team.socials.twitchHandle ?? "",
      discordInvite: team.socials.discordInvite ?? "",
      websiteUrl: team.socials.websiteUrl ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: TeamUpdateInput = {
        name: values.name.trim(),
        description: clean(values.description),
        region: clean(values.region),
        accentColor: clean(values.accentColor),
        logoUrl: clean(values.logoUrl),
        bannerUrl: clean(values.bannerUrl),
        isRecruiting: values.isRecruiting === "true",
        twitterHandle: clean(values.twitterHandle),
        instagramHandle: clean(values.instagramHandle),
        youtubeHandle: clean(values.youtubeHandle),
        twitchHandle: clean(values.twitchHandle),
        discordInvite: clean(values.discordInvite),
        websiteUrl: clean(values.websiteUrl),
      };
      await teamsMutate(`/api/teams/${team.id}`, "PATCH", payload);
      showSuccess("Équipe mise à jour.");
      onUpdated();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    const ok = await confirm({
      title: "Quitter l'équipe",
      message: isCaptain
        ? "En tant que capitaine, quitter transférera le capitanat au membre le plus ancien (ou dissoudra l'équipe si tu es seul). Continuer ?"
        : "Veux-tu vraiment quitter cette équipe ?",
      confirmText: "Quitter",
      confirmColor: "warning",
    });
    if (!ok) return;
    try {
      await teamsMutate("/api/teams/leave", "POST");
      showSuccess("Tu as quitté l'équipe.");
      onLeftOrDissolved();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Action impossible.");
    }
  };

  const dissolve = async () => {
    const ok = await confirm({
      title: "Dissoudre l'équipe",
      message: `Cette action est définitive : l'équipe [${team.tag}] ${team.name} et tout son historique seront supprimés. Confirmer ?`,
      confirmText: "Dissoudre",
      confirmColor: "error",
    });
    if (!ok) return;
    try {
      await teamsMutate(`/api/teams/${team.id}`, "DELETE");
      showSuccess("Équipe dissoute.");
      onLeftOrDissolved();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Dissolution impossible.");
    }
  };

  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

  return (
    <Stack spacing={3}>
      {manage && (
        <Card
          elevation={0}
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ borderRadius: 5, border: "1px solid", borderColor: "divider" }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
              Paramètres de l'équipe
            </Typography>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField
                  fullWidth
                  label="Nom"
                  {...register("name", {
                    required: "Le nom est requis.",
                    minLength: { value: 2, message: "Minimum 2 caractères." },
                  })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Tag" value={`[${team.tag}]`} disabled sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Description"
                  {...register("description")}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Région"
                  defaultValue={team.region ?? ""}
                  {...register("region")}
                  sx={fieldSx}
                >
                  <MenuItem value="">Non précisée</MenuItem>
                  {TEAM_REGIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  fullWidth
                  type="color"
                  label="Couleur"
                  {...register("accentColor", {
                    pattern: { value: /^#[0-9a-fA-F]{6}$/, message: "Hex." },
                  })}
                  error={!!errors.accentColor}
                  helperText={errors.accentColor?.message}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Recrutement"
                  defaultValue={team.isRecruiting ? "true" : "false"}
                  {...register("isRecruiting")}
                  sx={fieldSx}
                >
                  <MenuItem value="true">Ouvert</MenuItem>
                  <MenuItem value="false">Fermé</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Logo (URL)" {...register("logoUrl")} sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Bannière (URL)"
                  {...register("bannerUrl")}
                  sx={fieldSx}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Réseaux sociaux
            </Typography>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Twitter / X"
                  {...register("twitterHandle")}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Instagram"
                  {...register("instagramHandle")}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="YouTube" {...register("youtubeHandle")} sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Twitch" {...register("twitchHandle")} sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Invitation Discord"
                  {...register("discordInvite")}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Site web (URL)"
                  {...register("websiteUrl")}
                  sx={fieldSx}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={<SaveIcon />}
                sx={{ borderRadius: 3, px: 4, fontWeight: "bold" }}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Zone de danger */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 5,
          border: "1px solid",
          borderColor: alpha(theme.palette.error.main, 0.4),
          bgcolor: alpha(theme.palette.error.main, 0.04),
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "error.main", mb: 0.5 }}>
            Zone de danger
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Quitter l'équipe ou la dissoudre définitivement.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<LogoutIcon />}
              onClick={leave}
              sx={{ borderRadius: 3 }}
            >
              Quitter l'équipe
            </Button>
            {isCaptain && (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteForeverIcon />}
                onClick={dissolve}
                sx={{ borderRadius: 3, fontWeight: "bold" }}
              >
                Dissoudre l'équipe
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {ConfirmDialogComponent}
    </Stack>
  );
}
