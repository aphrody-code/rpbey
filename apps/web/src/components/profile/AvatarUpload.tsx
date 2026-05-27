'use client';

import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { Box, Button, CircularProgress, useTheme } from '@mui/material';
import { useState } from 'react';
import { useToast } from '@/components/ui';

interface AvatarUploadProps {
  currentImage?: string | null;
  onUpload: (url: string) => void;
}

export function AvatarUpload({ currentImage, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const theme = useTheme();
  const { showToast } = useToast();

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'avatar');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUpload(data.url);
      showToast('Avatar mis à jour !', 'success');
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid',
          borderColor: 'background.paper',
          boxShadow: theme.shadows[3],
          position: 'relative',
          bgcolor: 'grey.200',
        }}
      >
        {currentImage ? (
          <Box
            component="img"
            src={currentImage}
            alt="Avatar"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled',
            }}
          >
            <PhotoCamera sx={{ fontSize: 40 }} />
          </Box>
        )}

        {uploading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.5)',
            }}
          >
            <CircularProgress color="inherit" size={24} />
          </Box>
        )}
      </Box>

      <Button
        variant="outlined"
        component="label"
        size="small"
        startIcon={<PhotoCamera />}
        disabled={uploading}
        sx={{ borderRadius: 2 }}
      >
        Modifier
        <input
          hidden
          accept="image/*"
          type="file"
          onChange={handleFileChange}
        />
      </Button>
    </Box>
  );
}
