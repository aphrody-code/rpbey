"use client";

import Inventory2Icon from "@mui/icons-material/Inventory2";
import { Box, Card, CardContent, Typography } from "@mui/material";

/**
 * Photo de la Deck Box physique du joueur (`profiles.deckBoxImage`), affichée sur
 * son profil public. Masquée si le profil est privé (filtré côté DAL). Édition via
 * `/dashboard/profile/edit` (DeckBoxUpload).
 */
export function DeckBoxPhotoCard({ imageUrl }: { imageUrl: string }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 4 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Inventory2Icon fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Ma Deck Box
          </Typography>
        </Box>
        <Box
          component="img"
          src={imageUrl}
          alt="Deck Box du joueur"
          loading="lazy"
          sx={{
            display: "block",
            width: "100%",
            maxHeight: 360,
            objectFit: "cover",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      </CardContent>
    </Card>
  );
}
