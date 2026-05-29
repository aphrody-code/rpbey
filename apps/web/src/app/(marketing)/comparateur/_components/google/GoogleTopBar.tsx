"use client";

import { Box, Link as MuiLink, Stack } from "@mui/material";
import NextLink from "@/components/ui/NextLink";
import { BG_DEEP, TEXT_SECONDARY } from "./tokens";

// Liens de navigation top-droite : vraies sections de l'univers Beyblade (routes existantes).
// Style header Google (Gmail/Images) → ici les pôles réels du site. Aucun placeholder.
const NAV_LINKS: { label: string; href: string; hideOnMobile?: boolean }[] = [
  { label: "Comparateur", href: "/comparateur" },
  { label: "Tournois", href: "/tournaments" },
  { label: "Classement", href: "/rankings" },
  { label: "Méta", href: "/meta", hideOnMobile: true },
  { label: "Anime", href: "/anime", hideOnMobile: true },
];

interface GoogleTopBarProps {
  compact?: boolean; // true = fond BG_DEEP (SERP), false = transparent (Home)
  // Conservé pour compat d'appel (ancienne zone "Labs" supprimée).
  showLabs?: boolean;
}

export function GoogleTopBar({ compact = false }: GoogleTopBarProps) {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        px: { xs: 1.5, sm: 2 },
        height: 64,
        bgcolor: compact ? BG_DEEP : "transparent",
        gap: { xs: 0.5, sm: 1 },
        position: "relative",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} sx={{ alignItems: "center" }}>
        {NAV_LINKS.map((l) => (
          <MuiLink
            key={l.label}
            component={NextLink}
            href={l.href}
            sx={{
              display: l.hideOnMobile ? { xs: "none", sm: "inline" } : "inline",
              color: TEXT_SECONDARY,
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
              "&:hover": { color: "text.primary", textDecoration: "underline" },
            }}
          >
            {l.label}
          </MuiLink>
        ))}
      </Stack>
    </Box>
  );
}
