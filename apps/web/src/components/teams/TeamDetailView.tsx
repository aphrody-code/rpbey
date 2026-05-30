"use client";

import PlaceIcon from "@mui/icons-material/Place";
import VerifiedIcon from "@mui/icons-material/Verified";
import {
  alpha,
  Avatar,
  Box,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import type { TeamDetail } from "@rpbey/api-contract";
import { TeamRosterTable } from "./TeamRosterTable";
import { TeamSocialsBar } from "./TeamSocialsBar";
import { TeamStats } from "./TeamStats";
import { formatDateFr, initials } from "./shared";

/** Vue publique complète d'une équipe (page `/equipes/[slug]`). */
export function TeamDetailView({ team }: { team: TeamDetail }) {
  const theme = useTheme();
  const accent = team.accentColor || theme.palette.primary.main;

  return (
    <Box>
      {/* Bannière */}
      <Box
        sx={{
          position: "relative",
          height: { xs: 180, md: 260 },
          background: team.bannerUrl
            ? `url(${team.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${alpha(accent, 0.9)} 0%, ${alpha(accent, 0.3)} 100%)`,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, transparent 30%, ${alpha(
              theme.palette.background.default,
              0.95,
            )} 100%)`,
          }}
        />
      </Box>

      <Container maxWidth="lg" sx={{ pb: { xs: 5, md: 8 } }}>
        {/* En-tête identité */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2.5}
          sx={{
            alignItems: { xs: "flex-start", sm: "flex-end" },
            mt: { xs: "-56px", md: "-72px" },
            position: "relative",
          }}
        >
          <Avatar
            src={team.logoUrl ?? undefined}
            sx={{
              width: { xs: 96, md: 128 },
              height: { xs: 96, md: 128 },
              border: "4px solid",
              borderColor: "background.default",
              bgcolor: alpha(accent, 0.2),
              color: accent,
              fontWeight: 900,
              fontSize: 40,
            }}
          >
            {initials(team.name)}
          </Avatar>
          <Box sx={{ flex: 1, pb: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip
                label={`[${team.tag}]`}
                sx={{
                  fontWeight: 900,
                  bgcolor: alpha(accent, 0.15),
                  color: accent,
                  borderRadius: 1.5,
                }}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
                {team.name}
              </Typography>
              {team.isVerified && (
                <VerifiedIcon sx={{ color: "primary.main" }} titleAccess="Équipe vérifiée" />
              )}
              {team.isRecruiting && (
                <Chip label="Recrute" color="success" size="small" sx={{ fontWeight: 700 }} />
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", flexWrap: "wrap", mt: 1, color: "text.secondary" }}
            >
              {team.region && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <PlaceIcon fontSize="small" />
                  <Typography variant="body2">{team.region}</Typography>
                </Stack>
              )}
              <Typography variant="body2">
                Fondée le {formatDateFr(team.foundedAt ?? team.createdAt)}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ pb: 1 }}>
            <TeamSocialsBar socials={team.socials} />
          </Box>
        </Stack>

        {team.description && (
          <Typography
            variant="body1"
            sx={{ mt: 3, color: "text.secondary", maxWidth: 820, whiteSpace: "pre-wrap" }}
          >
            {team.description}
          </Typography>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Statistiques */}
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          Statistiques
        </Typography>
        <TeamStats team={team} />

        {/* Roster */}
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 5, mb: 2 }}>
          Roster ({team.members.length})
        </Typography>
        <TeamRosterTable members={team.members} />
      </Container>
    </Box>
  );
}
