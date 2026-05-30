"use client";

import GroupsIcon from "@mui/icons-material/Groups";
import { alpha, Avatar, Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import Link from "next/link";
import { type ProfileTeam } from "@rpbey/api-contract";

interface ProfileTeamBadgeProps {
  team: ProfileTeam;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Fondateur",
  CAPTAIN: "Capitaine",
  LEADER: "Chef",
  MEMBER: "Membre",
  COACH: "Coach",
  SUBSTITUTE: "Remplaçant",
};

/** Carte mini de l'équipe d'un joueur, cliquable vers `/equipes/[slug]`. */
export function ProfileTeamBadge({ team }: ProfileTeamBadgeProps) {
  const theme = useTheme();
  const roleLabel = ROLE_LABELS[team.role?.toUpperCase() ?? ""] ?? team.role;

  return (
    <Box
      component={Link}
      href={`/equipes/${team.slug}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 4,
        textDecoration: "none",
        color: "inherit",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "all 0.2s",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: alpha(theme.palette.primary.main, 0.05),
        },
      }}
    >
      <Avatar
        src={team.logoUrl ?? undefined}
        variant="rounded"
        sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.12) }}
      >
        <GroupsIcon color="primary" />
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
            {team.name}
          </Typography>
          <Chip
            label={team.tag}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, height: 20 }}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {roleLabel}
        </Typography>
      </Box>
    </Box>
  );
}
