"use client";

import { alpha, Box, useTheme } from "@mui/material";

interface ProfileBannerProps {
  imageUrl?: string | null;
  accentColor?: string | null;
  height?: number | { xs: number; md: number };
}

/**
 * Bannière en tête de profil public. Affiche l'image si présente, sinon un dégradé
 * basé sur la couleur d'accent du joueur (fallback palette primaire). Un voile dégradé
 * en bas assure la lisibilité du contenu superposé.
 */
export function ProfileBanner({
  imageUrl,
  accentColor,
  height = { xs: 140, md: 220 },
}: ProfileBannerProps) {
  const theme = useTheme();
  const accent = accentColor ?? theme.palette.primary.main;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 5,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        background: imageUrl
          ? undefined
          : `linear-gradient(135deg, ${alpha(accent, 0.85)} 0%, ${alpha(
              theme.palette.secondary.main,
              0.7,
            )} 100%)`,
      }}
    >
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt="Bannière du profil"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 40%, ${alpha(
            theme.palette.background.default,
            0.65,
          )} 100%)`,
          pointerEvents: "none",
        }}
      />
    </Box>
  );
}
