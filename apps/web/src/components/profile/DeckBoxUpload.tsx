import EditIcon from '@mui/icons-material/Edit';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useToast } from '@/components/ui';
import { DeckBoxEditor } from './DeckBoxEditor';

interface DeckBoxUploadProps {
  currentImage?: string | null;
  onUpload: (url: string) => void;
}

export function DeckBoxUpload({ currentImage, onUpload }: DeckBoxUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const theme = useTheme();
  const { showToast } = useToast();

  const uploadFile = async (file: File | Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUpload(data.url);
      showToast(
        "Photo mise à jour ! N'oublie pas de sauvegarder ton profil.",
        'success',
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      const message =
        error instanceof Error ? error.message : "Erreur lors de l'upload";
      showToast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleEditorSave = async (blob: Blob) => {
    setEditorOpen(false);
    await uploadFile(blob);
  };

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: 200,
          borderRadius: 4,
          border: '2px dashed',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.05),
          },
        }}
      >
        {currentImage ? (
          <Box
            component="img"
            src={currentImage}
            alt="Deck Box"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              zIndex: 0,
            }}
          />
        ) : null}

        <Box
          sx={{
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            p: 2,
            bgcolor: currentImage ? 'rgba(0,0,0,0.6)' : 'transparent',
            borderRadius: 2,
            width: currentImage ? '100%' : 'auto',
            height: currentImage ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {uploading ? (
            <CircularProgress />
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                component="label"
                startIcon={<PhotoCamera />}
                sx={{ borderRadius: 2 }}
              >
                {currentImage ? 'Changer' : 'Ajouter une photo'}
                <input
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={handleFileChange}
                />
              </Button>

              {currentImage && (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setEditorOpen(true)}
                  startIcon={<EditIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  Décorer
                </Button>
              )}
            </Stack>
          )}

          {!currentImage && !uploading && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Montre-nous ta Deck Box ou ta mallette !
            </Typography>
          )}
        </Box>
      </Box>
      {currentImage && (
        <DeckBoxEditor
          open={editorOpen}
          imageUrl={currentImage}
          onClose={() => setEditorOpen(false)}
          onSave={handleEditorSave}
        />
      )}
    </>
  );
}
