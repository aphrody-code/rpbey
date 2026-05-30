"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { useToast } from "@/components/ui";

const STEPS = ["Identité", "Profil de jeu", "Localisation"];

const BEYBLADE_TYPES = [
  { value: "ATTACK", label: "Attaque" },
  { value: "DEFENSE", label: "Défense" },
  { value: "STAMINA", label: "Endurance" },
  { value: "BALANCE", label: "Équilibre" },
];

const SEASONS = [
  { value: "ORIGINAL", label: "Bakuten (saga originale)" },
  { value: "METAL", label: "Metal Fight / Metal Saga" },
  { value: "BURST", label: "Burst" },
  { value: "X", label: "Beyblade X" },
];

const EXPERIENCE = [
  { value: "BEGINNER", label: "Débutant (0-1 an)" },
  { value: "INTERMEDIATE", label: "Intermédiaire (1-3 ans)" },
  { value: "ADVANCED", label: "Avancé (3+ ans)" },
  { value: "EXPERT", label: "Expert" },
  { value: "LEGEND", label: "Légende" },
];

const FRENCH_REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
  "Outre-mer",
];

interface OnboardingState {
  bladerName: string;
  username: string;
  image: string;
  favoriteType: string;
  favoriteSeason: string;
  experience: string;
  country: string;
  region: string;
  city: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OnboardingState>({
    bladerName: "",
    username: "",
    image: "",
    favoriteType: "BALANCE",
    favoriteSeason: "X",
    experience: "BEGINNER",
    country: "France",
    region: "",
    city: "",
  });

  // Si déjà onboardé, aller au dashboard ; si non connecté, vers la connexion.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (res.status === 401) {
          router.replace("/sign-in?callbackUrl=/onboarding");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          if (data?.onboarded) {
            router.replace("/dashboard");
            return;
          }
          if (data?.bladerName) {
            setForm((f) => ({ ...f, bladerName: data.bladerName }));
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const set = <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext = activeStep !== 0 || form.bladerName.trim().length >= 2;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        bladerName: form.bladerName.trim(),
        username: form.username.trim() || undefined,
        image: form.image || undefined,
        favoriteType: form.favoriteType || undefined,
        favoriteSeason: form.favoriteSeason || undefined,
        experience: form.experience || undefined,
        country: form.country.trim() || undefined,
        region: form.region || undefined,
        city: form.city.trim() || undefined,
      };
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        showToast("Ce nom d'utilisateur est déjà pris.", "error");
        setActiveStep(0);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error("onboarding failed");
      showToast("Bienvenue dans la communauté !", "success");
      router.replace("/dashboard");
    } catch (e) {
      console.error(e);
      showToast("Une erreur est survenue. Réessaie.", "error");
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
          Configure ton profil de Blader
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mt: 1 }}>
          Quelques infos pour personnaliser ton expérience. Tu pourras tout modifier plus tard.
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card elevation={0} sx={{ borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <AvatarUpload currentImage={form.image} onUpload={(url) => set("image", url)} />
              </Box>
              <TextField
                fullWidth
                required
                label="Nom de Blader"
                value={form.bladerName}
                onChange={(e) => set("bladerName", e.target.value)}
                helperText="Affiché sur les classements et tournois (2 caractères min.)."
              />
              <TextField
                fullWidth
                label="Nom d'utilisateur (optionnel)"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                helperText="Lettres, chiffres et _ — sert d'identifiant de connexion."
              />
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack spacing={3}>
              <TextField
                select
                fullWidth
                label="Type favori"
                value={form.favoriteType}
                onChange={(e) => set("favoriteType", e.target.value)}
              >
                {BEYBLADE_TYPES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Saison préférée"
                value={form.favoriteSeason}
                onChange={(e) => set("favoriteSeason", e.target.value)}
              >
                {SEASONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Niveau d'expérience"
                value={form.experience}
                onChange={(e) => set("experience", e.target.value)}
              >
                {EXPERIENCE.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack spacing={3}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Optionnel — ta localisation reste masquée par défaut et ne sera affichée que si tu
                l'autorises dans tes paramètres.
              </Typography>
              <TextField
                fullWidth
                label="Pays"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
              <TextField
                select
                fullWidth
                label="Région"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
              >
                <MenuItem value="">Préfère ne pas préciser</MenuItem>
                {FRENCH_REGIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Ville"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Stack>
          )}

          <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: "space-between" }}>
            <Button
              variant="text"
              disabled={activeStep === 0 || submitting}
              onClick={() => setActiveStep((s) => s - 1)}
            >
              Retour
            </Button>
            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                disabled={!canNext}
                onClick={() => setActiveStep((s) => s + 1)}
                sx={{ borderRadius: 3, px: 4 }}
              >
                Continuer
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={submitting || form.bladerName.trim().length < 2}
                onClick={handleSubmit}
                sx={{ borderRadius: 3, px: 4 }}
              >
                {submitting ? "Finalisation..." : "Terminer"}
              </Button>
            )}
          </Stack>

          {activeStep < STEPS.length - 1 && (
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Button
                size="small"
                variant="text"
                color="inherit"
                disabled={form.bladerName.trim().length < 2 || submitting}
                onClick={handleSubmit}
                sx={{ color: "text.secondary" }}
              >
                Passer et terminer
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
