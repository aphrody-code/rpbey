"use client";

import ChatIcon from "@mui/icons-material/Chat";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupsIcon from "@mui/icons-material/Groups";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { TeamDetail, TeamInvite, TeamRole } from "@rpbey/api-contract";
import { CreateTeamForm } from "@/components/teams/CreateTeamForm";
import { MyInvitesPanel } from "@/components/teams/MyInvitesPanel";
import { TeamChat } from "@/components/teams/TeamChat";
import { TeamMembersTab } from "@/components/teams/TeamMembersTab";
import { TeamRecruitPanel } from "@/components/teams/TeamRecruitPanel";
import { TeamSettingsForm } from "@/components/teams/TeamSettingsForm";
import { TeamSocialsBar } from "@/components/teams/TeamSocialsBar";
import { TeamStats } from "@/components/teams/TeamStats";
import { canManage, formatDateFr, initials, teamsFetcher } from "@/components/teams/shared";
import { useAuth } from "@/hooks";

interface MyTeamData {
  team: TeamDetail | null;
  role: TeamRole | null;
  invites: TeamInvite[];
}

export default function TeamDashboardPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  const { data, isLoading, mutate } = useSWR<MyTeamData>("/api/teams", teamsFetcher);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const team = data?.team ?? null;
  const role = data?.role ?? null;
  const invites = data?.invites ?? [];
  const currentUserId = user?.id ?? "";

  // --- Sans équipe : création + invitations ---------------------------------
  if (!team || !role) {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            Mon équipe
          </Typography>
          <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 400 }}>
            Tu n'as pas encore d'équipe. Crée ton clan ou accepte une invitation.
          </Typography>
        </Box>

        <Stack spacing={4}>
          <MyInvitesPanel
            invites={invites}
            onResponded={() => {
              void mutate();
            }}
          />
          <CreateTeamForm
            onCreated={() => {
              setTab(0);
              void mutate();
            }}
          />
        </Stack>
      </Box>
    );
  }

  // --- Avec équipe : tableau de bord à onglets ------------------------------
  const accent = team.accentColor || theme.palette.primary.main;
  const manage = canManage(role);
  const refresh = () => {
    void mutate();
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* Bandeau identité */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 5,
          overflow: "hidden",
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            height: 96,
            background: team.bannerUrl
              ? `url(${team.bannerUrl}) center/cover`
              : `linear-gradient(135deg, ${alpha(accent, 0.85)} 0%, ${alpha(accent, 0.3)} 100%)`,
          }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { xs: "flex-start", sm: "flex-end" }, mt: "-40px" }}
          >
            <Avatar
              src={team.logoUrl ?? undefined}
              sx={{
                width: 80,
                height: 80,
                border: "3px solid",
                borderColor: "background.paper",
                bgcolor: alpha(accent, 0.2),
                color: accent,
                fontWeight: 900,
              }}
            >
              {initials(team.name)}
            </Avatar>
            <Box sx={{ flex: 1, pb: 0.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Chip
                  label={`[${team.tag}]`}
                  size="small"
                  sx={{ fontWeight: 800, bgcolor: alpha(accent, 0.15), color: accent }}
                />
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {team.name}
                </Typography>
                <Chip
                  label={
                    role === "CAPTAIN"
                      ? "Capitaine"
                      : role === "CO_CAPTAIN"
                        ? "Co-capitaine"
                        : "Membre"
                  }
                  size="small"
                  color={role === "MEMBER" ? "default" : "primary"}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {team.memberCount} membre{team.memberCount > 1 ? "s" : ""} · Fondée le{" "}
                {formatDateFr(team.foundedAt ?? team.createdAt)}
                {!team.isPublic && " · Non publique (< 3 membres)"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", pb: 0.5 }}>
              <TeamSocialsBar socials={team.socials} />
              {team.isPublic && (
                <Button
                  component={Link}
                  href={`/equipes/${team.slug}`}
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon />}
                  sx={{ borderRadius: 2.5 }}
                >
                  Page publique
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Onglets */}
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab icon={<DashboardIcon />} iconPosition="start" label="Vue d'ensemble" />
        <Tab icon={<GroupsIcon />} iconPosition="start" label="Membres" />
        {manage && <Tab icon={<PersonAddIcon />} iconPosition="start" label="Recruter" />}
        <Tab icon={<ChatIcon />} iconPosition="start" label="Chat" />
        <Tab icon={<SettingsIcon />} iconPosition="start" label="Paramètres" />
      </Tabs>

      {/* Contenu — les indices d'onglet s'ajustent selon la présence de "Recruter". */}
      <TabContent index={0} value={tab}>
        <Stack spacing={3}>
          <TeamStats team={team} />
          {team.description && (
            <Card
              elevation={0}
              sx={{ borderRadius: 4, border: "1px solid", borderColor: "divider" }}
            >
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  À propos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                  {team.description}
                </Typography>
              </CardContent>
            </Card>
          )}
          <Divider />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Roster
          </Typography>
          <TeamMembersTab
            team={team}
            role={role}
            currentUserId={currentUserId}
            onChanged={refresh}
          />
        </Stack>
      </TabContent>

      <TabContent index={1} value={tab}>
        <TeamMembersTab team={team} role={role} currentUserId={currentUserId} onChanged={refresh} />
      </TabContent>

      {manage && (
        <TabContent index={2} value={tab}>
          <TeamRecruitPanel teamId={team.id} />
        </TabContent>
      )}

      <TabContent index={manage ? 3 : 2} value={tab}>
        <TeamChat teamId={team.id} currentUserId={currentUserId} />
      </TabContent>

      <TabContent index={manage ? 4 : 3} value={tab}>
        <TeamSettingsForm team={team} role={role} onUpdated={refresh} onLeftOrDissolved={refresh} />
      </TabContent>
    </Box>
  );
}

/** Conteneur d'onglet : ne rend l'enfant que lorsque l'onglet est actif. */
function TabContent({
  index,
  value,
  children,
}: {
  index: number;
  value: number;
  children: React.ReactNode;
}) {
  if (value !== index) return null;
  return <Box role="tabpanel">{children}</Box>;
}
