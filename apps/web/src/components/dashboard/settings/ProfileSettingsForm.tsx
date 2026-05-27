'use client';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient, useSession } from '@/lib/auth-client';

export function ProfileSettingsForm() {
  const { data: session, isPending } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const router = useRouter();

  // Local state for form fields
  const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [imagePreview, setImagePreview] = useState(session?.user?.image || '');

  // Update local state when session loads
  if (!isPending && session && name === '' && session.user.name) {
    setName(session.user.name);
    setEmail(session.user.email);
    setImagePreview(session.user.image || '');
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setImagePreview(data.url);
      setMessage({
        type: 'success',
        text: 'Image téléchargée. Cliquez sur Enregistrer pour valider.',
      });
    } catch {
      setMessage({
        type: 'error',
        text: "Erreur lors du téléchargement de l'image.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await authClient.updateUser({
        name,
        image: imagePreview,
      });

      // If email changed, try to update it separately (Better Auth might handle it differently)
      if (email !== session?.user.email) {
        await authClient.changeEmail({
          newEmail: email,
          callbackURL: window.location.href, // Redirect back here
        });
        setMessage({
          type: 'success',
          text: 'Profil mis à jour. Un email de vérification a été envoyé pour la nouvelle adresse.',
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Profil mis à jour avec succès !',
        });
      }

      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erreur lors de la mise à jour du profil.',
      });
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isPending) return <CircularProgress />;

  return (
    <Paper sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 'bold',
        }}
      >
        Paramètres du Profil
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack spacing={4}>
          {/* Avatar Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src={imagePreview || session?.user?.image || undefined}
              sx={{ width: 100, height: 100 }}
            />
            <Box>
              <Button
                component="label"
                variant="outlined"
                startIcon={
                  isUploading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <CloudUploadIcon />
                  )
                }
                disabled={isUploading}
              >
                Changer la photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  mt: 1,
                }}
              >
                Max 5MB. Formats: JPG, PNG, GIF.
              </Typography>
            </Box>
          </Box>

          {/* Fields */}
          <TextField
            label="Nom d'affichage"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            helperText="Changer votre email nécessitera une nouvelle vérification."
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={
              isSaving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            disabled={isSaving || isUploading}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
