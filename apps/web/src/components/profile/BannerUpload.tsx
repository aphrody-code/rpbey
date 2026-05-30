"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import { alpha, Box, Button, CircularProgress, Stack, Typography, useTheme } from "@mui/material";
import { useState } from "react";
import { useToast } from "@/components/ui";

interface BannerUploadProps {
  currentImage?: string | null;
  onUpload: (url: string | null) => void;
}

/**
 * Upload de la bannière de profil. Calqué sur AvatarUpload : POST multipart vers
 * `/api/upload` (type `banner`), aspect 16:5 (format bannière), bouton de retrait.
 */
export function BannerUpload({ currentImage, onUpload }: BannerUploadProps) {
  const [uploading, setUploading] = useState(false);
  const theme = useTheme();
  const { showToast } = useToast();

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "banner");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      onUpload(data.url);
      showToast("Bannière mise à jour ! N'oublie pas de sauvegarder ton profil.", "success");
    } catch (error) {
      console.error("Error uploading banner:", error);
      const message = error instanceof Error ? error.message : "Erreur lors de l'upload";
      showToast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: 180,
        borderRadius: 4,
        border: "2px dashed",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.paper",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: alpha(theme.palette.primary.main, 0.05),
        },
      }}
    >
      {currentImage ? (
        <Box
          component="img"
          src={currentImage}
          alt="Bannière"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            zIndex: 0,
          }}
        />
      ) : null}

      <Box
        sx={{
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          p: 2,
          bgcolor: currentImage ? "rgba(0,0,0,0.55)" : "transparent",
          borderRadius: 2,
          width: currentImage ? "100%" : "auto",
          height: currentImage ? "100%" : "auto",
          justifyContent: "center",
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
              {currentImage ? "Changer la bannière" : "Ajouter une bannière"}
              <input
                hidden
                accept="image/*"
                type="file"
                aria-label="Ajouter ou changer la bannière du profil"
                onChange={handleFileChange}
              />
            </Button>

            {currentImage && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  onUpload(null);
                  showToast("Bannière retirée. Sauvegarde pour confirmer.", "info");
                }}
                startIcon={<DeleteIcon />}
                sx={{
                  borderRadius: 2,
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.5)",
                }}
              >
                Retirer
              </Button>
            )}
          </Stack>
        )}

        {!currentImage && !uploading && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Format paysage recommandé (par ex. 1500 x 500).
          </Typography>
        )}
      </Box>
    </Box>
  );
}
