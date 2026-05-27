'use client';

import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import { SecuritySettings } from '@/components/profile';
import { AvatarUpload } from '@/components/profile/AvatarUpload'; // Import new component
import { DeckBoxUpload } from '@/components/profile/DeckBoxUpload';
import { useToast } from '@/components/ui';
import { RichTextEditor } from '@/components/ui/RichTextEditor'; // Import RichTextEditor
import { useAuth } from '@/hooks';

interface ProfileFormData {
  bladerName: string;
  bio: string;
  experience: string;
  favoriteType: string;
  challongeUsername?: string;
  deckBoxImage?: string;
  image?: string; // Add image field
}

const BEYBLADE_TYPES = [
  { value: 'ATTACK', label: 'Attaque' },
  { value: 'DEFENSE', label: 'Défense' },
  { value: 'STAMINA', label: 'Endurance' },
  { value: 'BALANCE', label: 'Équilibre' },
];

const EXPERIENCE_LEVELS = [
  { value: 'BEGINNER', label: 'Débutant (0-1 ans)' },
  { value: 'INTERMEDIATE', label: 'Intermédiaire (1-3 ans)' },
  { value: 'ADVANCED', label: 'Avancé (3+ ans)' },
  { value: 'COMPETITIVE', label: 'Compétiteur' },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);

  // Handle OAuth results
  useEffect(() => {
    const challonge = searchParams.get('challonge');
    if (challonge === 'success') {
      showToast('Compte Challonge lié avec succès !', 'success');
      mutate('/api/profile');
      // Clear URL params
      router.replace('/dashboard/profile/edit');
    } else if (challonge === 'error') {
      showToast('Erreur lors de la liaison Challonge.', 'error');
      router.replace('/dashboard/profile/edit');
    }
  }, [searchParams, showToast, router]);

  // Fetch current profile data
  const { data: profileData, isLoading: isProfileLoading } = useSWR(
    '/api/profile',
    fetcher,
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control, // Destructure control
    formState: { errors },
  } = useForm<ProfileFormData>();

  const watchedDeckBoxImage = watch('deckBoxImage');
  const watchedImage = watch('image');

  useEffect(() => {
    if (profileData) {
      setValue('bladerName', profileData.bladerName || '');
      setValue('bio', profileData.bio || '');
      setValue('experience', profileData.experience || 'BEGINNER');
      setValue('favoriteType', profileData.favoriteType || 'BALANCE');
      setValue('challongeUsername', profileData.challongeUsername || '');
      setValue('deckBoxImage', profileData.deckBoxImage || '');

      // Initialize avatar from User object included in Profile response
      if (profileData.user?.image) {
        setValue('image', profileData.user.image);
      }
    }
  }, [profileData, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      showToast('Profil mis à jour avec succès', 'success');
      router.refresh();
      router.push('/dashboard/profile');
    } catch (error) {
      console.error(error);
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isProfileLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box
        sx={{
          mb: 5,
        }}
      >
        <Typography
          variant="h3"
          gutterBottom
          sx={{
            fontWeight: '900',
            letterSpacing: '-0.03em',
          }}
        >
          Modifier mon profil
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: 'text.secondary',
            fontWeight: 'normal',
          }}
        >
          Personnalise ton identité de Blader et tes préférences.
        </Typography>
      </Box>
      <Grid container spacing={4}>
        {/* Main Info */}
        <Grid size={{ xs: 12, md: 8 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 5,
                mb: 4,
                border: '1px solid',
                borderColor: 'divider',
                background: `linear-gradient(180deg, ${alpha(
                  theme.palette.background.paper,
                  0.9,
                )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
                backdropFilter: 'blur(20px)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Stack spacing={4}>
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        mb: 3,
                      }}
                    >
                      <PersonIcon color="primary" sx={{ fontSize: 28 }} />
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: '800',
                        }}
                      >
                        Identité Blader
                      </Typography>
                    </Box>

                    <Grid container spacing={3}>
                      {/* Avatar Upload Section - NEW */}
                      <Grid
                        size={{ xs: 12 }}
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          mb: 2,
                        }}
                      >
                        <AvatarUpload
                          currentImage={watchedImage}
                          onUpload={(url) =>
                            setValue('image', url, { shouldDirty: true })
                          }
                        />
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Nom de Blader"
                          variant="outlined"
                          {...register('bladerName', {
                            required: 'Le nom est requis',
                            minLength: {
                              value: 3,
                              message: 'Minimum 3 caractères',
                            },
                          })}
                          error={!!errors.bladerName}
                          helperText={errors.bladerName?.message}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 3 },
                          }}
                        />
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <Typography
                          variant="subtitle2"
                          gutterBottom
                          sx={{
                            fontWeight: 'bold',
                          }}
                        >
                          Ma Deck Box
                        </Typography>
                        <DeckBoxUpload
                          currentImage={watchedDeckBoxImage}
                          onUpload={(url) =>
                            setValue('deckBoxImage', url, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Pseudo Challonge"
                          placeholder="Ton pseudo utilisé sur Challonge.com"
                          helperText="Permet de lier automatiquement tes résultats de tournoi."
                          variant="outlined"
                          {...register('challongeUsername')}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 3 },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select
                          fullWidth
                          label="Type Favori"
                          defaultValue=""
                          {...register('favoriteType')}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 3 },
                          }}
                        >
                          {BEYBLADE_TYPES.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select
                          fullWidth
                          label="Expérience"
                          defaultValue=""
                          {...register('experience')}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 3 },
                          }}
                        >
                          {EXPERIENCE_LEVELS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            mb: 1,
                            display: 'block',
                          }}
                        >
                          Biographie
                        </Typography>
                        <Controller
                          name="bio"
                          control={control}
                          render={({ field }) => (
                            <RichTextEditor
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  <Box
                    sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}
                  >
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
                        fontWeight: 'bold',
                        boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                      }}
                    >
                      {isSaving
                        ? 'Enregistrement...'
                        : 'Sauvegarder les modifications'}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </form>

          {/* Security Section */}
          <SecuritySettings />
        </Grid>

        {/* Info Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Alert
              severity="info"
              icon={<StarIcon fontSize="inherit" />}
              sx={{
                borderRadius: 4,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                border: '1px solid',
                borderColor: alpha(theme.palette.info.main, 0.2),
                '& .MuiAlert-icon': { color: 'info.main' },
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Le savais-tu ?
              </Typography>
              Ton nom de Blader est unique et sera affiché sur les classements
              et lors des tournois. Choisis-le bien !
            </Alert>

            <Box
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Box
                  component="img"
                  src="https://challonge.com/favicon.ico"
                  sx={{ width: 16, height: 16 }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Compte Challonge
                </Typography>
              </Box>
              {profileData?.challongeUsername ? (
                <Stack spacing={1}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'success.main',
                      fontWeight: 'bold',
                    }}
                  >
                    Lié : {profileData.challongeUsername}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      if (
                        confirm('Voulez-vous délier votre compte Challonge ?')
                      ) {
                        // We can just clear the field via the main form if we want,
                        // but a quick button is better.
                        setValue('challongeUsername', '');
                        onSubmit({ ...profileData, challongeUsername: '' });
                      }
                    }}
                  >
                    Délier
                  </Button>
                </Stack>
              ) : (
                <Link
                  href="/api/auth/challonge"
                  passHref
                  style={{ textDecoration: 'none' }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{ mt: 1, borderRadius: 2 }}
                  >
                    Lier mon compte
                  </Button>
                </Link>
              )}
            </Box>

            <Box
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                }}
              >
                Inscrit le{' '}
                {user ? new Date(user.createdAt).toLocaleDateString() : '-'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                }}
              >
                ID: {user?.id}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
