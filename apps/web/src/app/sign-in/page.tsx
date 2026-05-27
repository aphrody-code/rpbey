'use client';

import { Visibility, VisibilityOff } from '@mui/icons-material';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { TwitchButton } from '@/components/auth';
import { useThemeMode } from '@/components/theme/ThemeRegistry';
import { DiscordIcon } from '@/components/ui/Icons';
import { signIn, signUp } from '@/lib/auth-client';

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const callbackURL = searchParams.get('callbackUrl') || '/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // For sign up
  const [authError, setAuthError] = useState<string | null>(null);

  const { backgroundImage } = useThemeMode();

  const handleDiscordSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setAuthError(null);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    try {
      await signIn.social({
        provider: 'discord',
        callbackURL,
      });
    } catch (err) {
      console.error('Login failed', err);
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        // Registration
        await signUp.email(
          {
            email: emailOrUsername,
            password,
            name,
            callbackURL,
          },
          {
            onRequest: () => {
              // Optional: Loading state handled globally
            },
            onSuccess: () => {
              router.push(callbackURL);
            },
            onError: (ctx) => {
              setAuthError(ctx.error.message);
              setIsLoading(false);
            },
          },
        );
      } else {
        // Login
        const isEmail = emailOrUsername.includes('@');
        if (isEmail) {
          await signIn.email(
            {
              email: emailOrUsername,
              password,
              callbackURL,
            },
            {
              onSuccess: () => {
                router.push(callbackURL);
              },
              onError: (ctx) => {
                setAuthError(ctx.error.message);
                setIsLoading(false);
              },
            },
          );
        } else {
          // Username login
          await signIn.username(
            {
              username: emailOrUsername,
              password,
              callbackURL,
            },
            {
              onSuccess: () => {
                router.push(callbackURL);
              },
              onError: (ctx) => {
                setAuthError(ctx.error.message);
                setIsLoading(false);
              },
            },
          );
        }
      }
    } catch (err) {
      console.error('Credentials auth failed', err);
      setAuthError('Une erreur inattendue est survenue.');
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{ width: '100%', maxWidth: 400, borderRadius: 4, boxShadow: 3 }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                }}
              >
                {isSignUp ? 'Inscription' : 'Connexion'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {isSignUp
                  ? 'Crée ton compte RPB'
                  : 'Connecte-toi à la République Populaire du Beyblade'}
              </Typography>
            </Box>

            {(error || authError) && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {authError || 'Une erreur est survenue lors de la connexion.'}
              </Alert>
            )}

            {/* Social Logins */}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleDiscordSignIn}
                disabled={isLoading}
                sx={{
                  bgcolor: '#5865F2',
                  '&:hover': { bgcolor: '#4752C4' },
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                }}
                startIcon={<DiscordIcon size={24} />}
              >
                {isLoading ? 'Chargement...' : 'Continuer avec Discord'}
              </Button>

              <TwitchButton callbackURL={callbackURL} />
            </Stack>

            <Divider sx={{ my: 3 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                ou avec email
              </Typography>
            </Divider>

            {/* Credentials Form */}
            <form onSubmit={handleCredentials}>
              <Stack spacing={2.5}>
                {isSignUp && (
                  <TextField
                    fullWidth
                    label="Nom d'affichage"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignUp}
                    disabled={isLoading}
                  />
                )}

                <TextField
                  fullWidth
                  label={isSignUp ? 'Email' : "Email ou Nom d'utilisateur"}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  type={isSignUp ? 'email' : 'text'}
                />

                <TextField
                  fullWidth
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
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
                    bgcolor: 'primary.main',
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                  }}
                >
                  {isLoading
                    ? 'Chargement...'
                    : isSignUp
                      ? "S'inscrire"
                      : 'Se connecter'}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <Box
                  component="span"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  sx={{
                    color: 'primary.main',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {isSignUp ? 'Se connecter' : "S'inscrire"}
                </Box>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SignInContent />
    </Suspense>
  );
}
