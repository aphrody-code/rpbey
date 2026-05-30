"use client";

import GroupsIcon from "@mui/icons-material/Groups";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { DiscordMember, MemberDirectoryResponse, XMember } from "@rpbey/api-contract";
import { MuiXIcon } from "@/components/ui";
import { DiscordIcon } from "@/components/ui/Icons";
import { pollsFetcher } from "@/components/polls/shared";

const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 3 } };

/** Avatar X construit côté UI via unavatar.io (cf. consigne contrat). */
function xAvatarUrl(username: string): string {
  return `https://unavatar.io/x/${username}`;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}

/** Carte d'un membre Discord : avatar + noms + tag + rôles. */
function DiscordRow({ member }: { member: DiscordMember }) {
  const theme = useTheme();
  const primaryName =
    member.nickname || member.globalName || member.name || member.username || member.id;
  const roles = member.roles ?? [];

  return (
    <Box
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", mb: roles.length ? 1.5 : 0 }}
      >
        <Avatar
          alt={primaryName}
          src={member.image || undefined}
          sx={{ width: 48, height: 48, borderRadius: 2.5 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {primaryName}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {member.discordTag || member.username || member.id}
          </Typography>
        </Box>
      </Stack>
      {roles.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {roles.map((role) => (
            <Chip key={role} size="small" label={role} variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** Carte d'un membre de la communauté X : avatar unavatar + @username + followers. */
function XRow({ member }: { member: XMember }) {
  const theme = useTheme();

  return (
    <Box
      component="a"
      href={`https://x.com/${member.username}`}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "block",
        p: 2,
        height: "100%",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        textDecoration: "none",
        color: "inherit",
        transition: "border-color .2s, transform .2s",
        "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Avatar
          alt={member.username}
          src={xAvatarUrl(member.username)}
          sx={{ width: 48, height: 48, borderRadius: 2.5 }}
        />
        <Box sx={{ minWidth: 0 }}>
          {member.name && (
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {member.name}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            @{member.username}
          </Typography>
          {typeof member.followers === "number" && (
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
              {formatFollowers(member.followers)} abonné{member.followers > 1 ? "s" : ""}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Annuaire admin des membres : deux onglets « Discord » et « Communauté X »,
 * alimentés par `GET /api/admin/members?q=` (recherche debouncée). Avatar Discord
 * = `member.image` ; avatar X = `https://unavatar.io/x/<username>` (construit ici).
 * Un lien vers la communauté X (`xCommunityUrl`) est exposé en tête de l'onglet X.
 */
export function MemberDirectory() {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce de la saisie (300 ms) avant de relancer la requête.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const key = `/api/admin/members${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`;
  const { data, isLoading } = useSWR<MemberDirectoryResponse>(key, pollsFetcher, {
    keepPreviousData: true,
  });

  const discord = data?.discord ?? [];
  const x = data?.x ?? [];
  const xCommunityUrl = data?.xCommunityUrl ?? "";

  return (
    <Box>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <GroupsIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
            Annuaire des membres
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Recherche un membre du serveur Discord ou de la communauté X de la RPBey.
        </Typography>
      </Stack>

      <TextField
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par nom, pseudo, tag…"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: isLoading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            ) : undefined,
          },
        }}
        sx={{ ...inputSx, mb: 3, maxWidth: 540 }}
      />

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 3, "& .MuiTab-root": { fontWeight: 700, textTransform: "none" } }}
      >
        <Tab
          icon={<DiscordIcon size={18} />}
          iconPosition="start"
          label={`Discord (${discord.length})`}
        />
        <Tab
          icon={<MuiXIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={`Communauté X (${x.length})`}
        />
      </Tabs>

      {tab === 0 && (
        <>
          {!isLoading && discord.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Aucun membre Discord trouvé.
            </Typography>
          )}
          <Grid container spacing={2}>
            {discord.map((member) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={member.id}>
                <DiscordRow member={member} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {tab === 1 && (
        <>
          {xCommunityUrl && (
            <Box sx={{ mb: 2.5 }}>
              <Button
                component="a"
                href={xCommunityUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<MuiXIcon sx={{ fontSize: 16 }} />}
                endIcon={<OpenInNewIcon />}
                sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
              >
                Ouvrir la communauté X
              </Button>
            </Box>
          )}
          {!isLoading && x.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Aucun membre de la communauté X trouvé.
            </Typography>
          )}
          <Grid container spacing={2}>
            {x.map((member) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={member.id}>
                <XRow member={member} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
