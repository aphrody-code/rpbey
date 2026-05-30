"use client";

import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import ShareIcon from "@mui/icons-material/Share";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import StarIcon from "@mui/icons-material/Star";
import SyncIcon from "@mui/icons-material/Sync";
import {
  Alert,
  alpha,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import useSWR, { mutate } from "swr";
import { SecuritySettings } from "@/components/profile";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { BannerUpload } from "@/components/profile/BannerUpload";
import { DeckBoxUpload } from "@/components/profile/DeckBoxUpload";
import {
  BEYBLADE_TYPES,
  EXPERIENCE_LEVELS,
  FAVORITE_SEASONS,
  FRENCH_REGIONS,
  PROFILE_VISIBILITIES,
  THEME_PREFERENCES,
} from "@/components/profile/profile-fields";
import { type BeybladeOption, useBeybladeOptions } from "@/components/profile/useBeybladeOptions";
import { useToast } from "@/components/ui";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAuth } from "@/hooks";

interface ProfileFormData {
  // Identité
  bladerName: string;
  displayName: string;
  pronouns: string;
  bio: string;
  image: string;
  bannerImage: string;
  deckBoxImage: string;
  // Localisation
  country: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine: string;
  showLocation: boolean;
  // Favoris
  favoriteType: string;
  favoriteSeason: string;
  experience: string;
  favoriteBeybladeId: string;
  favoriteDeckId: string;
  // Réseaux
  twitterHandle: string;
  tiktokHandle: string;
  instagramHandle: string;
  youtubeHandle: string;
  twitchHandle: string;
  discordHandle: string;
  websiteUrl: string;
  showSocials: boolean;
  // Préférences & confidentialité
  themePreference: string;
  accentColor: string;
  profileVisibility: string;
  // Challonge (existant)
  challongeUsername: string;
}

interface DeckSummary {
  id: string;
  name: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
      {icon}
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
    </Box>
  );
}

export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingDiscord, setIsSyncingDiscord] = useState(false);

  // Handle OAuth results
  useEffect(() => {
    const challonge = searchParams.get("challonge");
    if (challonge === "success") {
      showToast("Compte Challonge lié avec succès !", "success");
      mutate("/api/profile");
      router.replace("/dashboard/profile/edit");
    } else if (challonge === "error") {
      showToast("Erreur lors de la liaison Challonge.", "error");
      router.replace("/dashboard/profile/edit");
    }
  }, [searchParams, showToast, router]);

  const { data: profileData, isLoading: isProfileLoading } = useSWR("/api/profile", fetcher);
  const { data: decksData } = useSWR<{ data: DeckSummary[] }>(
    user?.id ? `/api/decks?userId=${user.id}` : null,
    fetcher,
  );
  const { options: beyblades, isLoading: beybladesLoading } = useBeybladeOptions();

  const decks = decksData?.data ?? [];

  const cardSx = useMemo(
    () => ({
      borderRadius: 5,
      mb: 4,
      border: "1px solid",
      borderColor: "divider",
      background: `linear-gradient(180deg, ${alpha(
        theme.palette.background.paper,
        0.9,
      )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
      backdropFilter: "blur(20px)",
    }),
    [theme],
  );

  const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    defaultValues: {
      bladerName: "",
      displayName: "",
      pronouns: "",
      bio: "",
      image: "",
      bannerImage: "",
      deckBoxImage: "",
      country: "France",
      region: "",
      city: "",
      postalCode: "",
      addressLine: "",
      showLocation: false,
      favoriteType: "BALANCE",
      favoriteSeason: "",
      experience: "BEGINNER",
      favoriteBeybladeId: "",
      favoriteDeckId: "",
      twitterHandle: "",
      tiktokHandle: "",
      instagramHandle: "",
      youtubeHandle: "",
      twitchHandle: "",
      discordHandle: "",
      websiteUrl: "",
      showSocials: true,
      themePreference: "system",
      accentColor: "",
      profileVisibility: "PUBLIC",
      challongeUsername: "",
    },
  });

  const watchedDeckBoxImage = useWatch({ control, name: "deckBoxImage" });
  const watchedImage = useWatch({ control, name: "image" });
  const watchedBanner = useWatch({ control, name: "bannerImage" });
  const watchedFavBeyId = useWatch({ control, name: "favoriteBeybladeId" });
  const watchedAccent = useWatch({ control, name: "accentColor" });

  const selectedBey = useMemo<BeybladeOption | null>(
    () => beyblades.find((b) => b.id === watchedFavBeyId) ?? null,
    [beyblades, watchedFavBeyId],
  );

  useEffect(() => {
    if (profileData) {
      reset({
        bladerName: profileData.bladerName ?? "",
        displayName: profileData.displayName ?? "",
        pronouns: profileData.pronouns ?? "",
        bio: profileData.bio ?? "",
        image: profileData.user?.image ?? "",
        bannerImage: profileData.bannerImage ?? "",
        deckBoxImage: profileData.deckBoxImage ?? "",
        country: profileData.country ?? "France",
        region: profileData.region ?? "",
        city: profileData.city ?? "",
        postalCode: profileData.postalCode ?? "",
        addressLine: profileData.addressLine ?? "",
        showLocation: Boolean(profileData.showLocation),
        favoriteType: profileData.favoriteType ?? "BALANCE",
        favoriteSeason: profileData.favoriteSeason ?? "",
        experience: profileData.experience ?? "BEGINNER",
        favoriteBeybladeId: profileData.favoriteBeybladeId ?? "",
        favoriteDeckId: profileData.favoriteDeckId ?? "",
        twitterHandle: profileData.twitterHandle ?? "",
        tiktokHandle: profileData.tiktokHandle ?? "",
        instagramHandle: profileData.instagramHandle ?? "",
        youtubeHandle: profileData.youtubeHandle ?? "",
        twitchHandle: profileData.twitchHandle ?? "",
        discordHandle: profileData.discordHandle ?? "",
        websiteUrl: profileData.websiteUrl ?? "",
        showSocials: profileData.showSocials ?? true,
        themePreference: profileData.themePreference ?? "system",
        accentColor: profileData.accentColor ?? "",
        profileVisibility: profileData.profileVisibility ?? "PUBLIC",
        challongeUsername: profileData.challongeUsername ?? "",
      });
    }
  }, [profileData, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      // Champs vides → null (efface la colonne) sauf booléens et le nom requis.
      const orNull = (v: string) => {
        const t = v?.trim();
        return t ? t : null;
      };

      const payload: Record<string, unknown> = {
        bladerName: data.bladerName.trim(),
        displayName: orNull(data.displayName),
        pronouns: orNull(data.pronouns),
        bio: orNull(data.bio),
        image: orNull(data.image),
        bannerImage: orNull(data.bannerImage),
        deckBoxImage: orNull(data.deckBoxImage),
        country: orNull(data.country),
        region: orNull(data.region),
        city: orNull(data.city),
        postalCode: orNull(data.postalCode),
        addressLine: orNull(data.addressLine),
        showLocation: data.showLocation,
        favoriteType: orNull(data.favoriteType),
        favoriteSeason: data.favoriteSeason ? data.favoriteSeason : null,
        experience: data.experience ? data.experience : null,
        favoriteBeybladeId: orNull(data.favoriteBeybladeId),
        favoriteDeckId: orNull(data.favoriteDeckId),
        twitterHandle: orNull(data.twitterHandle),
        tiktokHandle: orNull(data.tiktokHandle),
        instagramHandle: orNull(data.instagramHandle),
        youtubeHandle: orNull(data.youtubeHandle),
        twitchHandle: orNull(data.twitchHandle),
        discordHandle: orNull(data.discordHandle),
        websiteUrl: orNull(data.websiteUrl),
        showSocials: data.showSocials,
        themePreference: data.themePreference ? data.themePreference : null,
        accentColor: orNull(data.accentColor),
        profileVisibility: data.profileVisibility ? data.profileVisibility : null,
        challongeUsername: orNull(data.challongeUsername),
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const firstIssue = body?.issues?.[0];
        throw new Error(
          firstIssue
            ? `${firstIssue.path?.join(".")}: ${firstIssue.message}`
            : "Échec de la mise à jour",
        );
      }

      showToast("Profil mis à jour avec succès", "success");
      mutate("/api/profile");
      router.refresh();
      router.push("/dashboard/profile");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erreur lors de la mise à jour";
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isProfileLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: "900", letterSpacing: "-0.03em" }}>
          Modifier mon profil
        </Typography>
        <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: "normal" }}>
          Personnalise ton identité de Blader, tes favoris et tes préférences.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* ── Identité ─────────────────────────────────────────── */}
            <Card elevation={0} sx={cardSx}>
              <CardContent sx={{ p: 4 }}>
                <SectionHeader
                  icon={<PersonIcon color="primary" sx={{ fontSize: 28 }} />}
                  title="Identité Blader"
                />
                <Grid container spacing={3}>
                  <Grid
                    size={{ xs: 12 }}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <AvatarUpload
                      currentImage={watchedImage}
                      onUpload={(url) => setValue("image", url, { shouldDirty: true })}
                    />
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<SyncIcon fontSize="small" />}
                      disabled={isSyncingDiscord}
                      onClick={async () => {
                        setIsSyncingDiscord(true);
                        try {
                          const res = await fetch("/api/profile/sync-discord-avatar", {
                            method: "POST",
                          });
                          const body = await res.json().catch(() => null);
                          if (!res.ok) throw new Error(body?.error || "Synchronisation échouée");
                          setValue("image", body.url, { shouldDirty: true });
                          showToast(
                            "Avatar Discord synchronisé. Sauvegarde pour confirmer.",
                            "success",
                          );
                        } catch (error) {
                          showToast(
                            error instanceof Error ? error.message : "Erreur de synchronisation",
                            "error",
                          );
                        } finally {
                          setIsSyncingDiscord(false);
                        }
                      }}
                    >
                      {isSyncingDiscord ? "Synchronisation..." : "Synchroniser l'avatar Discord"}
                    </Button>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: "bold" }}>
                      Bannière du profil
                    </Typography>
                    <BannerUpload
                      currentImage={watchedBanner}
                      onUpload={(url) => setValue("bannerImage", url ?? "", { shouldDirty: true })}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Nom de Blader"
                      variant="outlined"
                      {...register("bladerName", {
                        required: "Le nom est requis",
                        minLength: { value: 3, message: "Minimum 3 caractères" },
                      })}
                      error={!!errors.bladerName}
                      helperText={errors.bladerName?.message}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Nom affiché"
                      placeholder="Affiché à la place du nom de Blader (optionnel)"
                      variant="outlined"
                      {...register("displayName")}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Pronoms"
                      placeholder="il/lui, elle/elle, iel..."
                      variant="outlined"
                      {...register("pronouns")}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: "bold" }}>
                      Ma Deck Box
                    </Typography>
                    <DeckBoxUpload
                      currentImage={watchedDeckBoxImage}
                      onUpload={(url) =>
                        setValue("deckBoxImage", url, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", mb: 1, display: "block" }}
                    >
                      Biographie
                    </Typography>
                    <Controller
                      name="bio"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Favoris ──────────────────────────────────────────── */}
            <Card elevation={0} sx={cardSx}>
              <CardContent sx={{ p: 4 }}>
                <SectionHeader
                  icon={<SportsKabaddiIcon color="primary" sx={{ fontSize: 28 }} />}
                  title="Favoris"
                />
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="favoriteType"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select fullWidth label="Type favori" sx={inputSx}>
                          {BEYBLADE_TYPES.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="favoriteSeason"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select fullWidth label="Saison préférée" sx={inputSx}>
                          <MenuItem value="">
                            <em>Aucune</em>
                          </MenuItem>
                          {FAVORITE_SEASONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="experience"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select fullWidth label="Expérience" sx={inputSx}>
                          {EXPERIENCE_LEVELS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="favoriteDeckId"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Deck favori"
                          helperText={
                            decks.length === 0
                              ? "Crée un deck pour pouvoir en choisir un."
                              : undefined
                          }
                          sx={inputSx}
                        >
                          <MenuItem value="">
                            <em>Aucun</em>
                          </MenuItem>
                          {decks.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Autocomplete
                      options={beyblades}
                      loading={beybladesLoading}
                      value={selectedBey}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      getOptionLabel={(o) => o.name}
                      onChange={(_, value) =>
                        setValue("favoriteBeybladeId", value?.id ?? "", { shouldDirty: true })
                      }
                      renderOption={(props, option) => {
                        const { key, ...rest } = props as { key: string } & Record<string, unknown>;
                        return (
                          <Box
                            component="li"
                            key={key}
                            {...rest}
                            sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
                          >
                            <Avatar
                              src={option.imageUrl ?? undefined}
                              variant="rounded"
                              sx={{ width: 32, height: 32 }}
                            >
                              <SportsKabaddiIcon fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {option.name}
                              </Typography>
                              {option.beyType && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {option.beyType}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Bey favori"
                          placeholder="Recherche dans le catalogue..."
                          sx={inputSx}
                          slotProps={{
                            ...params.slotProps,
                            input: {
                              ...params.slotProps.input,
                              startAdornment: selectedBey ? (
                                <InputAdornment position="start">
                                  <Avatar
                                    src={selectedBey.imageUrl ?? undefined}
                                    variant="rounded"
                                    sx={{ width: 24, height: 24 }}
                                  >
                                    <SportsKabaddiIcon fontSize="small" />
                                  </Avatar>
                                </InputAdornment>
                              ) : (
                                params.slotProps.input.startAdornment
                              ),
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Localisation ─────────────────────────────────────── */}
            <Card elevation={0} sx={cardSx}>
              <CardContent sx={{ p: 4 }}>
                <SectionHeader
                  icon={<PlaceIcon color="primary" sx={{ fontSize: 28 }} />}
                  title="Localisation"
                />
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Pays"
                      variant="outlined"
                      {...register("country")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="region"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select fullWidth label="Région" sx={inputSx}>
                          <MenuItem value="">
                            <em>Non précisée</em>
                          </MenuItem>
                          {FRENCH_REGIONS.map((r) => (
                            <MenuItem key={r} value={r}>
                              {r}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Ville"
                      variant="outlined"
                      {...register("city")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Code postal"
                      variant="outlined"
                      {...register("postalCode")}
                      helperText="Reste privé, jamais affiché publiquement."
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Adresse"
                      variant="outlined"
                      {...register("addressLine")}
                      helperText="Reste privée, jamais affichée publiquement."
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Controller
                      name="showLocation"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          }
                          label="Afficher ma ville, ma région et mon pays sur mon profil public"
                        />
                      )}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", display: "block", ml: 6 }}
                    >
                      Masqué par défaut. Le code postal et l'adresse restent toujours privés.
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Réseaux sociaux ──────────────────────────────────── */}
            <Card elevation={0} sx={cardSx}>
              <CardContent sx={{ p: 4 }}>
                <SectionHeader
                  icon={<ShareIcon color="primary" sx={{ fontSize: 28 }} />}
                  title="Réseaux sociaux"
                />
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="X / Twitter"
                      placeholder="pseudo"
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">@</InputAdornment>,
                        },
                      }}
                      {...register("twitterHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Instagram"
                      placeholder="pseudo"
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">@</InputAdornment>,
                        },
                      }}
                      {...register("instagramHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="TikTok"
                      placeholder="pseudo"
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">@</InputAdornment>,
                        },
                      }}
                      {...register("tiktokHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="YouTube"
                      placeholder="chaîne ou @handle"
                      {...register("youtubeHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Twitch"
                      placeholder="pseudo"
                      {...register("twitchHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Discord"
                      placeholder="pseudo#0000 ou identifiant"
                      {...register("discordHandle")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Site web"
                      placeholder="https://mon-site.fr"
                      {...register("websiteUrl")}
                      sx={inputSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Controller
                      name="showSocials"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          }
                          label="Afficher mes réseaux sociaux sur mon profil public"
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Préférences & confidentialité ────────────────────── */}
            <Card elevation={0} sx={cardSx}>
              <CardContent sx={{ p: 4 }}>
                <SectionHeader
                  icon={<PaletteIcon color="primary" sx={{ fontSize: 28 }} />}
                  title="Préférences & confidentialité"
                />
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="themePreference"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select fullWidth label="Thème" sx={inputSx}>
                          {THEME_PREFERENCES.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Couleur d'accent"
                      placeholder="#FF3366"
                      {...register("accentColor", {
                        validate: (v) =>
                          !v || HEX_RE.test(v) || "Format attendu : #RRGGBB (ex. #FF3366)",
                      })}
                      error={!!errors.accentColor}
                      helperText={
                        errors.accentColor?.message ?? "Couleur hexadécimale, ex. #FF3366"
                      }
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Box
                                component="input"
                                type="color"
                                value={HEX_RE.test(watchedAccent ?? "") ? watchedAccent : "#000000"}
                                onChange={(e) =>
                                  setValue("accentColor", e.target.value, { shouldDirty: true })
                                }
                                aria-label="Sélecteur de couleur d'accent"
                                sx={{
                                  width: 28,
                                  height: 28,
                                  p: 0,
                                  border: "none",
                                  borderRadius: 1,
                                  cursor: "pointer",
                                  background: "transparent",
                                }}
                              />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Controller
                      name="profileVisibility"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Visibilité du profil"
                          sx={inputSx}
                        >
                          {PROFILE_VISIBILITIES.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {o.label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {o.description}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                  <Button
                    variant="text"
                    onClick={() => router.back()}
                    disabled={isSaving}
                    sx={{ borderRadius: 3, px: 3 }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSaving}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      py: 1,
                      fontWeight: "bold",
                      boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                    }}
                  >
                    {isSaving ? "Enregistrement..." : "Sauvegarder les modifications"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </form>

          {/* Section Sécurité (inchangée) */}
          <SecuritySettings />
        </Grid>

        {/* Sidebar info + Challonge */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Alert
              severity="info"
              icon={<StarIcon fontSize="inherit" />}
              sx={{
                borderRadius: 4,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                border: "1px solid",
                borderColor: alpha(theme.palette.info.main, 0.2),
                "& .MuiAlert-icon": { color: "info.main" },
              }}
            >
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: "bold" }}>
                Le savais-tu ?
              </Typography>
              Ton nom de Blader est unique et sera affiché sur les classements et lors des tournois.
              Choisis-le bien !
            </Alert>

            <Box
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Box
                  component="img"
                  src="https://challonge.com/favicon.ico"
                  sx={{ width: 16, height: 16 }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  Compte Challonge
                </Typography>
              </Box>
              {profileData?.challongeUsername ? (
                <Stack spacing={1}>
                  <Typography variant="caption" sx={{ color: "success.main", fontWeight: "bold" }}>
                    Lié : {profileData.challongeUsername}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={async () => {
                      if (confirm("Voulez-vous délier votre compte Challonge ?")) {
                        setValue("challongeUsername", "");
                        await fetch("/api/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ challongeUsername: null }),
                        });
                        mutate("/api/profile");
                      }
                    }}
                  >
                    Délier
                  </Button>
                </Stack>
              ) : (
                <Link href="/api/auth/challonge" passHref style={{ textDecoration: "none" }}>
                  <Button variant="outlined" size="small" fullWidth sx={{ mt: 1, borderRadius: 2 }}>
                    Lier mon compte
                  </Button>
                </Link>
              )}
            </Box>

            <Box
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <LockIcon fontSize="small" sx={{ color: "text.secondary" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  Compte
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                Inscrit le {user ? new Date(user.createdAt).toLocaleDateString("fr-FR") : "-"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                ID : {user?.id}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
