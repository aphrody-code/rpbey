"use client";

import { alpha, Box, Button, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { DownloadBracketButton } from "@/components/tournaments/DownloadBracketButton";
import { useSession } from "@/lib/auth-client";
import type { TournamentData } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TournamentMap = dynamic<{
  position: [number, number];
  popupText: string;
  height?: string | number;
}>(() => import("@/components/ui/Map"), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height="100%" />,
});

interface Props {
  tournament: TournamentData;
  formattedDate: string;
  isBTS: boolean;
  posterUrl: string;
  unoptimizedPoster: boolean;
}

const PARIS_DBAFM: [number, number] = [48.85785, 2.34623];

export function TournamentSidebar({
  tournament,
  formattedDate,
  isBTS,
  posterUrl,
  unoptimizedPoster,
}: Props) {
  const { data: session } = useSession();
  const { data: profileData } = useSWR<{ challongeUsername?: string }>(
    session ? "/api/profile" : null,
    fetcher,
  );

  return (
    <Stack spacing={3} sx={{ position: { lg: "sticky" }, top: { lg: 100 } }}>
      <Box
        sx={{
          width: "100%",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid",
          borderColor: isBTS ? "rgba(255,255,255,0.1)" : "divider",
          aspectRatio: "1040/1467",
          bgcolor: "#000",
          position: "relative",
          boxShadow: isBTS ? "0 25px 50px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <Image
          src={posterUrl}
          alt={tournament.name}
          fill
          style={{ objectFit: "cover" }}
          unoptimized={unoptimizedPoster}
          priority
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 6,
          border: "1px solid",
          borderColor: isBTS ? (t) => alpha(t.palette.primary.main, 0.4) : "divider",
          background: isBTS
            ? "linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)"
            : "background.paper",
        }}
      >
        <Stack spacing={3}>
          <InfoBlock label="DATE & HEURE">
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              {formattedDate}
            </Typography>
            <Typography variant="caption" sx={{ color: "error.main", fontWeight: 900 }}>
              Check-in :{" "}
              {new Date(tournament.date).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Paris",
              })}
            </Typography>
          </InfoBlock>

          <InfoBlock label="LIEU">
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {tournament.location}
            </Typography>
          </InfoBlock>

          <InfoBlock label="FORMAT">
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {tournament.format}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.disabled", fontWeight: 700, fontSize: "0.65rem" }}
            >
              Capacité:{" "}
              {tournament.maxPlayers > 0 ? `${tournament.maxPlayers} joueurs` : "Illimitée"}
            </Typography>
          </InfoBlock>

          <Divider sx={{ borderStyle: "dashed" }} />

          <Stack spacing={2}>
            {session && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {profileData?.challongeUsername ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Box
                      component="img"
                      src="https://challonge.com/favicon.ico"
                      alt=""
                      sx={{ width: 16, height: 16 }}
                    />
                    <Typography variant="caption" sx={{ color: "success.main", fontWeight: 900 }}>
                      LIÉ : {profileData.challongeUsername}
                    </Typography>
                  </Stack>
                ) : (
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={`/api/auth/challonge?returnTo=/tournaments/${tournament.id}`}
                    sx={{
                      color: "secondary.main",
                      borderColor: "secondary.main",
                      fontWeight: 900,
                      fontSize: "0.7rem",
                    }}
                  >
                    LIER MON COMPTE CHALLONGE
                  </Button>
                )}
              </Box>
            )}
            {tournament.challongeUrl && (
              <Button
                variant="contained"
                fullWidth
                href={tournament.challongeUrl}
                target="_blank"
                sx={{
                  py: 1.5,
                  fontWeight: 900,
                  bgcolor: "primary.main",
                  fontSize: "0.95rem",
                }}
              >
                S&apos;INSCRIRE MAINTENANT
              </Button>
            )}
            <Button
              variant="outlined"
              fullWidth
              href="https://discord.gg/rpb"
              target="_blank"
              sx={{
                color: isBTS ? "white" : "text.primary",
                borderColor: isBTS ? "rgba(255,255,255,0.2)" : "divider",
              }}
            >
              REJOINDRE LE DISCORD
            </Button>
            <DownloadBracketButton targetId="tournament-view" fileName={tournament.id} />
          </Stack>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          height: 250,
          borderRadius: 6,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <TournamentMap position={PARIS_DBAFM} popupText={tournament.location || "Lieu"} />
      </Paper>
    </Stack>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontWeight: 900,
          display: "block",
          mb: 0.5,
          letterSpacing: 1,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}
