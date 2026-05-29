"use client";

import CloseIcon from "@mui/icons-material/Close";
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Modal,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { TrophyIcon } from "@/components/ui/Icons";
import { TournamentBracketDb } from "@/components/tournaments/TournamentBracketDb";
import { getStardustTournamentTop10 } from "@/server/actions/stardust";

interface Champion {
  rank: 1 | 2 | 3;
  name: string;
  tournamentSlug: string;
  tournamentLabel: string;
}

interface Props {
  champions: Champion[];
}

const ACCENT = "#60A5FA";

/**
 * Hall of Fame Stardust — calqué sur `SatrHallOfFame` :
 * grille de cartes "champion par tournoi" avec modal Top 10 + bracket DB
 * cliquable. Données pioche dans `prisma.tournamentParticipant` via
 * `getStardustTournamentTop10`.
 */
export function StardustHallOfFame({ champions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openTop10, setOpenTop10] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [top10Data, setTop10Data] = useState<Array<{ rank: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"top10" | "bracket">("top10");

  if (champions.length === 0) return null;

  const handleChampionClick = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("search", name);
    params.set("view", "career");
    params.set("page", "1");
    router.push(`/tournaments/stardust?${params.toString()}`);
  };

  const handleShowTop10 = async (id: string, label: string) => {
    setSelectedTournament({ id, label });
    setOpenTop10(true);
    setTab("top10");
    setLoading(true);
    setTop10Data([]);
    const res = await getStardustTournamentTop10(id);
    if (res.success && res.data) {
      setTop10Data(res.data);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5, px: 1 }}>
        <Box sx={{ display: "flex", color: ACCENT }}>
          <TrophyIcon size={18} />
        </Box>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 900,
            letterSpacing: 1.5,
            color: ACCENT,
            fontSize: "0.65rem",
          }}
        >
          Hall of Fame · Stardust
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          overflowX: "auto",
          pb: 2,
          px: 1,
          pt: 0.5,
          "&::-webkit-scrollbar": { height: "3px" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: alpha(ACCENT, 0.3),
            borderRadius: 0,
          },
          maskImage: "linear-gradient(to right, black 90%, transparent 100%)",
        }}
      >
        {champions.map((c, i) => (
          <Box
            key={`${c.tournamentSlug}-${i}`}
            component={motion.div}
            whileHover={{ y: -4, scale: 1.02 }}
            sx={{
              p: 1.5,
              minWidth: 160,
              borderRadius: 3,
              position: "relative",
              background: "linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)",
              border: "1px solid",
              borderColor: alpha(ACCENT, 0.25),
              boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "1px",
                background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                opacity: 0.4,
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: -10,
                right: -10,
                opacity: 0.05,
                transform: "rotate(15deg)",
                color: ACCENT,
              }}
            >
              <TrophyIcon size={60} />
            </Box>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: alpha(ACCENT, 0.7),
                fontWeight: 800,
                mb: 0.25,
                fontSize: "0.6rem",
                textTransform: "uppercase",
              }}
            >
              {c.tournamentLabel}
            </Typography>
            <Typography
              variant="body2"
              onClick={() => handleChampionClick(c.name)}
              sx={{
                fontWeight: 900,
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                cursor: "pointer",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                "&:hover": { color: ACCENT },
              }}
            >
              🏆 {c.name}
            </Typography>
            <Button
              size="small"
              fullWidth
              variant="text"
              onClick={() => handleShowTop10(c.tournamentSlug, c.tournamentLabel)}
              sx={{
                mt: 0.5,
                fontSize: "0.6rem",
                fontWeight: 900,
                color: "rgba(255,255,255,0.35)",
                minHeight: 0,
                p: 0,
                "&:hover": {
                  color: ACCENT,
                  bgcolor: "transparent",
                },
              }}
            >
              TOP 10 · BRACKET
            </Button>
          </Box>
        ))}
      </Stack>

      <Modal
        open={openTop10}
        onClose={() => setOpenTop10(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Paper
          sx={{
            p: 2.5,
            width: "100%",
            maxWidth: tab === "bracket" ? 900 : 360,
            maxHeight: "90vh",
            overflow: "auto",
            borderRadius: 4,
            bgcolor: "#0b0f1a",
            border: `1px solid ${alpha(ACCENT, 0.3)}`,
          }}
        >
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 900,
                color: ACCENT,
                fontSize: "0.9rem",
                letterSpacing: 0.5,
              }}
            >
              {selectedTournament?.label ?? "—"}
            </Typography>
            <IconButton
              onClick={() => setOpenTop10(false)}
              size="small"
              sx={{ color: "rgba(255,255,255,0.5)" }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Tabs Top 10 / Bracket */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {(["top10", "bracket"] as const).map((t) => (
              <Button
                key={t}
                size="small"
                onClick={() => setTab(t)}
                variant={tab === t ? "contained" : "text"}
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  bgcolor: tab === t ? alpha(ACCENT, 0.18) : "transparent",
                  color: tab === t ? ACCENT : "rgba(255,255,255,0.55)",
                  "&:hover": { bgcolor: alpha(ACCENT, 0.12) },
                }}
              >
                {t === "top10" ? "Top 10" : "Bracket"}
              </Button>
            ))}
          </Stack>

          {tab === "top10" && (
            <>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress size={24} sx={{ color: ACCENT }} />
                </Box>
              ) : top10Data.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    color: "text.secondary",
                    py: 2,
                    fontSize: "0.8rem",
                  }}
                >
                  Top 10 indisponible.
                </Typography>
              ) : (
                <Stack spacing={0.75}>
                  {top10Data.map((p, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        p: 0.75,
                        px: 1.5,
                        borderRadius: 1.5,
                        bgcolor: p.rank === 1 ? alpha(ACCENT, 0.12) : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: p.rank === 1 ? 900 : 500,
                          fontSize: "0.8rem",
                        }}
                      >
                        {p.rank}. {p.name}
                      </Typography>
                      {p.rank === 1 && <TrophyIcon size={14} color={ACCENT} />}
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}

          {tab === "bracket" && selectedTournament && (
            <Box sx={{ minHeight: 400 }}>
              <TournamentBracketDb tournamentId={selectedTournament.id} height={500} />
            </Box>
          )}
        </Paper>
      </Modal>
    </Box>
  );
}
