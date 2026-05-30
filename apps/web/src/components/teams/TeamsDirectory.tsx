"use client";

import GroupsIcon from "@mui/icons-material/Groups";
import SearchIcon from "@mui/icons-material/Search";
import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { TeamsListResponse, TeamSummary } from "@rpbey/api-contract";
import { useDebounce } from "@/hooks/use-debounce";
import { TeamCard } from "./TeamCard";
import { teamsFetcher, TEAM_REGIONS } from "./shared";

const SORTS = [
  { value: "points", label: "Points" },
  { value: "members", label: "Membres" },
  { value: "wins", label: "Victoires" },
  { value: "recent", label: "Récentes" },
] as const;

const PAGE_SIZE = 24;

export function TeamsDirectory({
  initialList,
  leaderboard,
}: {
  initialList: TeamsListResponse;
  leaderboard: TeamSummary[];
}) {
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [recruiting, setRecruiting] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("points");
  const [page, setPage] = useState(1);

  const debouncedQ = useDebounce(q, 350);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (region) params.set("region", region);
    if (recruiting) params.set("recruiting", "true");
    return params.toString();
  }, [page, sort, debouncedQ, region, recruiting]);

  const isDefaultView =
    page === 1 && sort === "points" && !debouncedQ.trim() && !region && !recruiting;

  const { data, isLoading } = useSWR<TeamsListResponse>(
    `/api/v1/teams?${queryString}`,
    teamsFetcher,
    { fallbackData: isDefaultView ? initialList : undefined, keepPreviousData: true },
  );

  const list = data ?? initialList;
  const totalPages = Math.max(1, Math.ceil(list.pagination.total / PAGE_SIZE));

  const resetPage = () => setPage(1);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {/* En-tête */}
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <GroupsIcon sx={{ fontSize: 36, color: "primary.main" }} />
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            Équipes & Clans
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 400 }}>
          Découvre les clans de la communauté Beyblade, leurs rosters et leurs performances.
        </Typography>
      </Stack>

      {/* Top équipes (leaderboard) */}
      {leaderboard.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>
            Top équipes
          </Typography>
          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            {leaderboard.slice(0, 3).map((team, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
                <TeamCard team={team} rank={i + 1} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Barre de recherche + filtres */}
      <Box
        sx={{
          p: 2.5,
          mb: 4,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: "blur(12px)",
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher une équipe…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Région"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                resetPage();
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
            >
              <MenuItem value="">Toutes</MenuItem>
              {TEAM_REGIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Trier par"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as (typeof SORTS)[number]["value"]);
                resetPage();
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
            >
              {SORTS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={recruiting}
                  onChange={(e) => {
                    setRecruiting(e.target.checked);
                    resetPage();
                  }}
                />
              }
              label="Recrute"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Résultats */}
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {list.pagination.total} équipe{list.pagination.total > 1 ? "s" : ""}
        </Typography>
        {isLoading && <CircularProgress size={18} />}
      </Stack>

      {list.items.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: "center",
            borderRadius: 4,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Aucune équipe trouvée
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Ajuste tes filtres ou crée la tienne depuis ton tableau de bord.
          </Typography>
          <Chip
            label="Réinitialiser les filtres"
            sx={{ mt: 2, cursor: "pointer" }}
            onClick={() => {
              setQ("");
              setRegion("");
              setRecruiting(false);
              setSort("points");
              resetPage();
            }}
          />
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {list.items.map((team) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
              <TeamCard team={team} />
            </Grid>
          ))}
        </Grid>
      )}

      {totalPages > 1 && (
        <Stack sx={{ alignItems: "center", mt: 5 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
            shape="rounded"
          />
        </Stack>
      )}
    </Container>
  );
}
