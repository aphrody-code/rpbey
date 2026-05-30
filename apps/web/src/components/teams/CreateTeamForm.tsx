"use client";

import AddIcon from "@mui/icons-material/Add";
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { TeamCreateInput, TeamDetail } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { teamsMutate, TEAM_REGIONS } from "./shared";

interface FormValues {
  name: string;
  tag: string;
  description: string;
  region: string;
  accentColor: string;
  logoUrl: string;
  bannerUrl: string;
  isRecruiting: boolean;
  twitterHandle: string;
  instagramHandle: string;
  youtubeHandle: string;
  twitchHandle: string;
  discordInvite: string;
  websiteUrl: string;
}

/** Convertit "" → undefined pour les champs optionnels (le contrat attend nullish). */
function clean(value: string): string | undefined {
  const v = value.trim();
  return v === "" ? undefined : v;
}

export function CreateTeamForm({ onCreated }: { onCreated: (team: TeamDetail) => void }) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      tag: "",
      description: "",
      region: "",
      accentColor: "",
      logoUrl: "",
      bannerUrl: "",
      isRecruiting: true,
      twitterHandle: "",
      instagramHandle: "",
      youtubeHandle: "",
      twitchHandle: "",
      discordInvite: "",
      websiteUrl: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload: TeamCreateInput = {
        name: values.name.trim(),
        tag: values.tag.trim(),
        description: clean(values.description),
        region: clean(values.region),
        accentColor: clean(values.accentColor),
        logoUrl: clean(values.logoUrl),
        bannerUrl: clean(values.bannerUrl),
        isRecruiting: values.isRecruiting,
        twitterHandle: clean(values.twitterHandle),
        instagramHandle: clean(values.instagramHandle),
        youtubeHandle: clean(values.youtubeHandle),
        twitchHandle: clean(values.twitchHandle),
        discordInvite: clean(values.discordInvite),
        websiteUrl: clean(values.websiteUrl),
      };
      const { team } = await teamsMutate<{ team: TeamDetail }>("/api/teams", "POST", payload);
      showSuccess("Équipe créée ! Tu en es le capitaine.");
      onCreated(team);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

  return (
    <Card
      elevation={0}
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(
          theme.palette.background.default,
          0.5,
        )} 100%)`,
        backdropFilter: "blur(20px)",
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
          Créer une équipe
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Fonde ton clan. Il deviendra public dès qu'il atteindra 3 membres.
        </Typography>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              fullWidth
              label="Nom de l'équipe"
              {...register("name", {
                required: "Le nom est requis.",
                minLength: { value: 2, message: "Minimum 2 caractères." },
                maxLength: { value: 60, message: "Maximum 60 caractères." },
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={fieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="Tag"
              placeholder="RPB"
              {...register("tag", {
                required: "Le tag est requis.",
                pattern: {
                  value: /^[A-Za-z0-9]{2,6}$/,
                  message: "2 à 6 caractères alphanumériques.",
                },
              })}
              error={!!errors.tag}
              helperText={errors.tag?.message ?? "2-6 lettres/chiffres"}
              sx={fieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Description"
              {...register("description", {
                maxLength: { value: 2000, message: "Maximum 2000 caractères." },
              })}
              error={!!errors.description}
              helperText={errors.description?.message}
              sx={fieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              fullWidth
              label="Région"
              defaultValue=""
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
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              type="color"
              label="Couleur"
              defaultValue="#7c3aed"
              {...register("accentColor", {
                pattern: { value: /^#[0-9a-fA-F]{6}$/, message: "Hex (#rrggbb)." },
              })}
              error={!!errors.accentColor}
              helperText={errors.accentColor?.message}
              sx={fieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select
              fullWidth
              label="Recrutement"
              defaultValue="true"
              {...register("isRecruiting", { setValueAs: (v) => v === "true" || v === true })}
              sx={fieldSx}
            >
              <MenuItem value="true">Ouvert</MenuItem>
              <MenuItem value="false">Fermé</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Logo (URL)"
              placeholder="https://…"
              {...register("logoUrl")}
              sx={fieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Bannière (URL)"
              placeholder="https://…"
              {...register("bannerUrl")}
              sx={fieldSx}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          Réseaux sociaux (facultatif)
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Twitter / X" {...register("twitterHandle")} sx={fieldSx} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Instagram" {...register("instagramHandle")} sx={fieldSx} />
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
              placeholder="https://…"
              {...register("websiteUrl")}
              sx={fieldSx}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            startIcon={<AddIcon />}
            sx={{ borderRadius: 3, px: 4, fontWeight: "bold" }}
          >
            {submitting ? "Création…" : "Créer l'équipe"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
