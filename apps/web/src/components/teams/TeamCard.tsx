"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import PlaceIcon from "@mui/icons-material/Place";
import VerifiedIcon from "@mui/icons-material/Verified";
import {
  alpha,
  Avatar,
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import type { TeamSummary } from "@rpbey/api-contract";
import { initials } from "./shared";

/** Carte d'équipe pour l'annuaire public et le leaderboard. */
export function TeamCard({ team, rank }: { team: TeamSummary; rank?: number }) {
  const theme = useTheme();
  const accent = team.accentColor || theme.palette.primary.main;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        overflow: "hidden",
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: alpha(accent, 0.5),
          boxShadow: `0 16px 32px ${alpha(accent, 0.18)}`,
        },
      }}
    >
      <CardActionArea component={Link} href={`/equipes/${team.slug}`} sx={{ height: "100%" }}>
        {/* Bandeau accent / bannière */}
        <Box
          sx={{
            height: 84,
            position: "relative",
            background: team.bannerUrl
              ? `url(${team.bannerUrl}) center/cover`
              : `linear-gradient(135deg, ${alpha(accent, 0.85)} 0%, ${alpha(accent, 0.35)} 100%)`,
          }}
        >
          {typeof rank === "number" && (
            <Chip
              label={`#${rank}`}
              size="small"
              sx={{
                position: "absolute",
                top: 10,
                left: 10,
                fontWeight: 900,
                bgcolor: alpha(theme.palette.common.black, 0.55),
                color: theme.palette.common.white,
                backdropFilter: "blur(6px)",
              }}
            />
          )}
          {team.isRecruiting && (
            <Chip
              label="Recrute"
              size="small"
              color="success"
              sx={{
                position: "absolute",
                top: 10,
                right: 10,
                fontWeight: 700,
                backdropFilter: "blur(6px)",
              }}
            />
          )}
        </Box>

        <Box sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Avatar
            src={team.logoUrl ?? undefined}
            sx={{
              width: 64,
              height: 64,
              mt: "-32px",
              mb: 1.5,
              border: "3px solid",
              borderColor: "background.paper",
              bgcolor: alpha(accent, 0.2),
              color: accent,
              fontWeight: 900,
            }}
          >
            {initials(team.name)}
          </Avatar>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip
              label={`[${team.tag}]`}
              size="small"
              sx={{
                fontWeight: 800,
                bgcolor: alpha(accent, 0.14),
                color: accent,
                borderRadius: 1.5,
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
              {team.name}
            </Typography>
            {team.isVerified && (
              <VerifiedIcon sx={{ fontSize: 18, color: "primary.main" }} titleAccess="Vérifiée" />
            )}
          </Stack>

          {team.region && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.75 }}>
              <PlaceIcon sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {team.region}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={2.5} sx={{ mt: 1.75 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <GroupsIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {team.memberCount}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <EmojiEventsIcon sx={{ fontSize: 17, color: accent }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {team.totalPoints.toLocaleString("fr-FR")} pts
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {team.totalWins}V · {team.totalLosses}D
            </Typography>
          </Stack>
        </Box>
      </CardActionArea>
    </Card>
  );
}
