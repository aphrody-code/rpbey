"use client";

import { Alert, alpha, Box, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

interface PoolParticipant {
  rank: number;
  displayName: string;
  challongeUsername?: string;
  advanced: boolean;
  wins: number;
  losses: number;
  pts: number;
}

interface PoolGroup {
  name: string;
  participants: PoolParticipant[];
}

interface PoolMatch {
  matchId: string;
  groupName: string;
  winner: string;
  loser: string;
  score: string | null;
  state: string;
}

interface PoolsResponse {
  groups: PoolGroup[];
  groupsCount: number;
  matches: PoolMatch[];
  matchesCount: number;
  participantsCount: number;
  tournamentName: string;
}

const ADVANCE_COLOR = "#22c55e";
const ELIMINATED_COLOR = "#94a3b8";

export function PoolsPanel({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<PoolsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/pools`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 404) {
          setError("none");
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PoolsResponse;
      })
      .then((d) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [tournamentId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error === "none") {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Ce tournoi n'a pas de phase de poules.
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        Impossible de charger les poules : {error}
      </Alert>
    );
  }

  if (!data) return null;

  const matchesByGroup = new Map<string, PoolMatch[]>();
  for (const m of data.matches) {
    const arr = matchesByGroup.get(m.groupName) ?? [];
    arr.push(m);
    matchesByGroup.set(m.groupName, arr);
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Phase de poules
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`${data.groupsCount} groupes`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`${data.matchesCount} matches`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`${data.participantsCount} joueurs`} sx={{ fontWeight: 700 }} />
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {data.groups.map((g) => (
          <Grid key={g.name} size={{ xs: 12, md: 6, lg: 4 }}>
            <Box
              sx={{
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                height: "100%",
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.25,
                  bgcolor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {g.name}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  {(matchesByGroup.get(g.name) ?? []).length} matches
                </Typography>
              </Box>

              <Box sx={{ p: 1.5 }}>
                <Stack spacing={0.75}>
                  {g.participants.map((p) => {
                    const color = p.advanced ? ADVANCE_COLOR : ELIMINATED_COLOR;
                    return (
                      <Box
                        key={`${g.name}-${p.rank}-${p.displayName}`}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: p.advanced ? alpha(ADVANCE_COLOR, 0.3) : "divider",
                          bgcolor: p.advanced ? alpha(ADVANCE_COLOR, 0.04) : "transparent",
                        }}
                      >
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 1.25,
                            bgcolor: color,
                            color: p.advanced ? "black" : "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            fontSize: "0.8rem",
                            flexShrink: 0,
                          }}
                        >
                          {p.rank}
                        </Box>
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            lineHeight: 1.1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 800,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.displayName}
                          </Typography>
                          {p.challongeUsername && p.challongeUsername !== p.displayName && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.65rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                opacity: 0.7,
                              }}
                            >
                              @{p.challongeUsername}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: "success.main",
                            minWidth: 24,
                            textAlign: "right",
                          }}
                        >
                          {p.wins}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                          -
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: "error.main",
                            minWidth: 18,
                            textAlign: "left",
                          }}
                        >
                          {p.losses}
                        </Typography>
                        <Box
                          sx={{
                            minWidth: 36,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: "action.selected",
                            fontWeight: 900,
                            fontSize: "0.75rem",
                            textAlign: "center",
                          }}
                        >
                          {p.pts} pts
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
