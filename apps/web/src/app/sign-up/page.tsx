"use client";

import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useThemeMode } from "@/components/theme/ThemeRegistry";
import { DiscordIcon } from "@/components/ui/Icons";
import { signIn, signUp } from "@/lib/auth-client";

/** Page d'inscription dédiée. Après création, redirige vers l'onboarding. */
export default function SignUpPage() {
  const router = useRouter();
  const { backgroundImage } = useThemeMode();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const onboardingURL = "/onboarding";

  const handleDiscord = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      await signIn.social({ provider: "discord", callbackURL: onboardingURL });
    } catch (err) {
      console.error("Discord sign-up failed", err);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setAuthError(null);

    if (password.length < 8) {
      setAuthError("Le mot de passe doit faire au moins 8 caractères.");
      setIsLoading(false);
      return;
    }

    try {
      await signUp.email(
        { email, password, name, callbackURL: onboardingURL },
        {
          onSuccess: () => router.push(onboardingURL),
          onError: (ctx) => {
            setAuthError(ctx.error.message);
            setIsLoading(false);
          },
        },
      );
    } catch (err) {
      console.error("Sign-up failed", err);
      setAuthError("Une erreur inattendue est survenue.");
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ width: "100%", maxWidth: 420, mx: "auto", borderRadius: 4, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
                Rejoins la communauté
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Crée ton compte de Blader à la République Populaire du Beyblade.
              </Typography>
            </Box>

            {authError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {authError}
              </Alert>
            )}

            <Stack spacing={2} sx={{ mb: 3 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleDiscord}
                disabled={isLoading}
                startIcon={<DiscordIcon size={24} />}
                sx={{
                  bgcolor: "#5865F2",
                  "&:hover": { bgcolor: "#4752C4" },
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                }}
              >
                {isLoading ? "Chargement..." : "S'inscrire avec Discord"}
              </Button>
            </Stack>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                ou avec email
              </Typography>
            </Divider>

            <form onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Nom d'affichage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <TextField
                  fullWidth
                  label="Mot de passe"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  helperText="8 caractères minimum."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: "none",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                  }}
                >
                  {isLoading ? "Création..." : "Créer mon compte"}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Déjà un compte ?{" "}
                <MuiLink component={Link} href="/sign-in" sx={{ fontWeight: "bold" }}>
                  Se connecter
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
