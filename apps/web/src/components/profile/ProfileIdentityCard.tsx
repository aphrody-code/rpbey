"use client";

import CategoryIcon from "@mui/icons-material/Category";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import StyleIcon from "@mui/icons-material/Style";
import {
  alpha,
  Avatar,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { type FavoriteBeyblade, type FavoriteDeck } from "@rpbey/api-contract";
import { type ReactNode } from "react";
import { favoriteTypeLabel, seasonLabel } from "./profile-fields";

interface ProfileIdentityCardProps {
  favoriteSeason?: string | null;
  favoriteType?: string | null;
  favoriteBeyblade?: FavoriteBeyblade | null;
  favoriteDeck?: FavoriteDeck | null;
  duelRating?: number | null;
  location?: { country?: string | null; region?: string | null; city?: string | null };
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
        {icon}
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.08em" }}
        >
          {label}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

/**
 * Carte "Identité Beyblade" du profil public : saison préférée, type favori,
 * bey favori (avec image), deck favori, localisation et duel rating. N'affiche
 * une ligne que si la donnée correspondante est présente. Vide → rend `null`.
 */
export function ProfileIdentityCard({
  favoriteSeason,
  favoriteType,
  favoriteBeyblade,
  favoriteDeck,
  duelRating,
  location,
}: ProfileIdentityCardProps) {
  const theme = useTheme();
  const season = seasonLabel(favoriteSeason);
  const type = favoriteTypeLabel(favoriteType);

  const locationParts = [location?.city, location?.region, location?.country].filter(
    (p): p is string => Boolean(p && p.trim()),
  );

  const hasContent =
    Boolean(season) ||
    Boolean(type) ||
    Boolean(favoriteBeyblade) ||
    Boolean(favoriteDeck) ||
    locationParts.length > 0 ||
    (duelRating != null && duelRating > 0);

  if (!hasContent) return null;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          0.9,
        )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: "blur(20px)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>
          Identité Beyblade
        </Typography>

        <Stack spacing={2.5} divider={<Divider />}>
          {favoriteBeyblade && (
            <Row icon={<SportsKabaddiIcon fontSize="small" color="primary" />} label="Bey favori">
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Avatar
                  src={favoriteBeyblade.imageUrl ?? undefined}
                  variant="rounded"
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <SportsKabaddiIcon color="primary" />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {favoriteBeyblade.name}
                  </Typography>
                  {favoriteBeyblade.beyType && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {favoriteBeyblade.beyType}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Row>
          )}

          {season && (
            <Row icon={<CategoryIcon fontSize="small" color="primary" />} label="Saison préférée">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {season}
              </Typography>
            </Row>
          )}

          {type && (
            <Row icon={<CategoryIcon fontSize="small" color="primary" />} label="Type favori">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {type}
              </Typography>
            </Row>
          )}

          {favoriteDeck && (
            <Row icon={<StyleIcon fontSize="small" color="primary" />} label="Deck favori">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {favoriteDeck.name}
              </Typography>
            </Row>
          )}

          {duelRating != null && duelRating > 0 && (
            <Row icon={<SportsKabaddiIcon fontSize="small" color="primary" />} label="Duel rating">
              <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>
                {duelRating.toLocaleString("fr-FR")}
              </Typography>
            </Row>
          )}

          {locationParts.length > 0 && (
            <Row icon={<LocationOnIcon fontSize="small" color="primary" />} label="Localisation">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {locationParts.join(", ")}
              </Typography>
            </Row>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
