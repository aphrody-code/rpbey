"use client";

import { Apps, ScienceOutlined } from "@mui/icons-material";
import { Avatar, Box, IconButton, Link as MuiLink, Stack, Tooltip } from "@mui/material";
import NextLink from "@/components/ui/NextLink";
import { AVATAR_HOVER_BORDER, BG_DEEP, ICON_HOVER_BG, TEXT_SECONDARY } from "./tokens";

// Liens navigation top-droite (style Google header : Gmail / Images -> Boutiques / Tournois)
const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Boutiques", href: "/comparateur" },
  { label: "Tournois", href: "/tournois" },
];

interface GoogleTopBarProps {
  compact?: boolean; // true = fond BG_DEEP (SERP), false = transparent (Home)
  showLabs?: boolean;
}

export function GoogleTopBar({ compact = false, showLabs = true }: GoogleTopBarProps) {
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
      {/* Liens texte navigation */}
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} sx={{ alignItems: "center" }}>
        {NAV_LINKS.map((l) => (
          <MuiLink
            key={l.label}
            component={NextLink}
            href={l.href}
            sx={{
              color: TEXT_SECONDARY,
              fontSize: "0.875rem",
              fontWeight: 400,
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {l.label}
          </MuiLink>
        ))}
      </Stack>

      {/* Icone Labs (fiole) — optionnelle */}
      {showLabs && (
        <Tooltip title="Labs RPB (beta)">
          <IconButton
            size="small"
            aria-label="Labs RPB"
            sx={{
              color: TEXT_SECONDARY,
              "&:hover": { bgcolor: ICON_HOVER_BG },
            }}
          >
            <ScienceOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* App-grid 9 points */}
      <Tooltip title="Applications RPB">
        <IconButton
          size="small"
          aria-label="Applications RPB"
          sx={{
            color: TEXT_SECONDARY,
            "&:hover": { bgcolor: ICON_HOVER_BG },
          }}
        >
          <Apps fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Avatar placeholder */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          fontSize: "0.875rem",
          fontWeight: 700,
          background: "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))",
          cursor: "pointer",
          border: "2px solid transparent",
          "&:hover": { borderColor: AVATAR_HOVER_BORDER },
        }}
        aria-label="Compte utilisateur"
      >
        B
      </Avatar>
    </Box>
  );
}
