"use client";

import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import PersonIcon from "@mui/icons-material/Person";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
import {
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Slide,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type TransitionProps } from "@mui/material/transitions";
import { AnimatePresence, motion } from "framer-motion";
import React, { forwardRef } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { type SatrRanking } from "@/lib/types";

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface SatrComparatorProps {
  selected: SatrRanking[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const COLOR_A = "#fbbf24";
const COLOR_B = "#3b82f6";

function parseNum(val: string) {
  return parseFloat(val.replace(",", ".").replace("%", "")) || 0;
}

function CompareRadar({ a, b }: { a: SatrRanking; b: SatrRanking }) {
  const wrA = parseNum(a.winRate);
  const wrB = parseNum(b.winRate);
  const avgA = parseNum(a.pointsAverage);
  const avgB = parseNum(b.pointsAverage);
  const maxScore = Math.max(a.score, b.score, 1);
  const maxWins = Math.max(a.wins, b.wins, 1);
  const maxPart = Math.max(a.participation, b.participation, 1);
  const maxAvg = Math.max(avgA, avgB, 1);

  const data = [
    {
      stat: "Score",
      A: (a.score / maxScore) * 100,
      B: (b.score / maxScore) * 100,
    },
    {
      stat: "Victoires",
      A: (a.wins / maxWins) * 100,
      B: (b.wins / maxWins) * 100,
    },
    { stat: "Winrate", A: wrA, B: wrB },
    {
      stat: "Tournois",
      A: (a.participation / maxPart) * 100,
      B: (b.participation / maxPart) * 100,
    },
    {
      stat: "Moyenne",
      A: (avgA / maxAvg) * 100,
      B: (avgB / maxAvg) * 100,
    },
  ];

  return (
    <Box sx={{ width: "100%", height: { xs: 240, sm: 300 }, mx: "auto" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{
              fill: "rgba(255,255,255,0.6)",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <Radar
            name={a.playerName}
            dataKey="A"
            stroke={COLOR_A}
            fill={COLOR_A}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name={b.playerName}
            dataKey="B"
            stroke={COLOR_B}
            fill={COLOR_B}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} iconType="circle" iconSize={8} />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
}

function CompareTable({ a, b }: { a: SatrRanking; b: SatrRanking }) {
  const wrA = parseNum(a.winRate);
  const wrB = parseNum(b.winRate);
  const avgA = parseNum(a.pointsAverage);
  const avgB = parseNum(b.pointsAverage);

  const rows = [
    { label: "Rang", valA: a.rank, valB: b.rank, lower: true },
    { label: "Score", valA: a.score, valB: b.score },
    { label: "Victoires", valA: a.wins, valB: b.wins },
    { label: "Défaites", valA: a.losses, valB: b.losses, lower: true },
    { label: "Winrate", valA: wrA, valB: wrB, suffix: "%", decimals: 1 },
    { label: "Tournois", valA: a.participation, valB: b.participation },
    { label: "Moyenne", valA: avgA, valB: avgB, decimals: 2 },
  ];

  return (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      {rows.map((row) => {
        // For "lower is better" stats (rank, losses), invert the comparison
        const aWins = row.lower ? row.valA < row.valB : row.valA > row.valB;
        const bWins = row.lower ? row.valB < row.valA : row.valB > row.valA;
        const fmt = (v: number) =>
          row.decimals
            ? `${v.toFixed(row.decimals)}${row.suffix || ""}`
            : `${v.toLocaleString("fr-FR")}${row.suffix || ""}`;
        const diff = row.valA - row.valB;
        const diffStr =
          diff === 0
            ? "="
            : `${diff > 0 ? "+" : ""}${row.decimals ? diff.toFixed(row.decimals) : diff}${row.suffix || ""}`;

        return (
          <Box
            key={row.label}
            sx={{
              display: "flex",
              alignItems: "center",
              py: { xs: 0.6, sm: 0.8 },
              px: { xs: 1, sm: 1.5 },
              borderRadius: 1.5,
              "&:nth-of-type(odd)": { bgcolor: "rgba(255,255,255,0.02)" },
            }}
          >
            <Typography
              sx={{
                flex: 1,
                textAlign: "right",
                fontWeight: aWins ? 800 : 500,
                color: aWins ? COLOR_A : "text.secondary",
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(row.valA)}
            </Typography>
            <Box
              sx={{
                width: { xs: 90, sm: 120 },
                textAlign: "center",
                flexShrink: 0,
                px: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.secondary",
                  fontSize: { xs: "0.65rem", sm: "0.75rem" },
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {row.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "0.6rem", sm: "0.65rem" },
                  fontWeight: 600,
                  color:
                    diff === 0
                      ? "text.disabled"
                      : aWins
                        ? alpha(COLOR_A, 0.7)
                        : alpha(COLOR_B, 0.7),
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {diffStr}
              </Typography>
            </Box>
            <Typography
              sx={{
                flex: 1,
                textAlign: "left",
                fontWeight: bWins ? 800 : 500,
                color: bWins ? COLOR_B : "text.secondary",
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(row.valB)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function SatrComparator({ selected, onRemove, onClear }: SatrComparatorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const canCompare = selected.length === 2;

  if (selected.length === 0) return null;

  return (
    <>
      {/* Floating bar */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            position: "fixed",
            bottom: isMobile ? 90 : 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1300,
            width: isMobile ? "calc(100% - 24px)" : "auto",
            maxWidth: 520,
          }}
        >
          <Box
            sx={{
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: "blur(20px)",
              border: "1px solid",
              borderColor: alpha(COLOR_A, 0.3),
              borderRadius: { xs: 2.5, sm: 3 },
              px: { xs: 1.5, sm: 2 },
              py: { xs: 1, sm: 1.5 },
              boxShadow: `0 8px 32px ${alpha("#000", 0.5)}`,
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, sm: 1.5 },
            }}
          >
            <CompareArrowsIcon
              sx={{
                color: COLOR_A,
                fontSize: { xs: "1.1rem", sm: "1.3rem" },
                flexShrink: 0,
              }}
            />

            <Stack direction="row" spacing={0.5} sx={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
              {selected.map((r, idx) => (
                <Chip
                  key={r.id}
                  label={r.playerName}
                  onDelete={() => onRemove(r.id)}
                  deleteIcon={<RemoveCircleOutlineIcon sx={{ fontSize: "0.9rem !important" }} />}
                  size="small"
                  sx={{
                    bgcolor: alpha(idx === 0 ? COLOR_A : COLOR_B, 0.12),
                    border: "1px solid",
                    borderColor: alpha(idx === 0 ? COLOR_A : COLOR_B, 0.25),
                    color: idx === 0 ? COLOR_A : COLOR_B,
                    maxWidth: { xs: 130, sm: 170 },
                    height: { xs: 28, sm: 32 },
                    fontWeight: 800,
                    "& .MuiChip-label": {
                      fontSize: { xs: "0.7rem", sm: "0.8rem" },
                      px: { xs: 0.5, sm: 1 },
                    },
                  }}
                />
              ))}
              {selected.length === 1 && !isMobile && (
                <Chip
                  icon={<PersonIcon />}
                  label="2e blader..."
                  size="small"
                  variant="outlined"
                  sx={{
                    opacity: 0.4,
                    borderStyle: "dashed",
                    height: 32,
                    "& .MuiChip-label": { fontSize: "0.8rem" },
                  }}
                />
              )}
            </Stack>

            <Button
              variant="contained"
              size="small"
              disabled={!canCompare}
              onClick={() => setDialogOpen(true)}
              startIcon={!isMobile ? <CompareArrowsIcon /> : undefined}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.5, sm: 0.75 },
                minWidth: { xs: "auto", sm: 120 },
                fontSize: { xs: "0.75rem", sm: "0.8rem" },
                bgcolor: COLOR_A,
                color: "#000",
                "&:hover": { bgcolor: alpha(COLOR_A, 0.85) },
                "&.Mui-disabled": {
                  bgcolor: alpha(COLOR_A, 0.2),
                  color: alpha("#fff", 0.3),
                },
              }}
            >
              {isMobile ? "VS" : "Comparer"}
            </Button>

            <IconButton size="small" onClick={onClear} sx={{ opacity: 0.5, p: { xs: 0.5, sm: 1 } }}>
              <CloseIcon sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }} />
            </IconButton>
          </Box>
        </motion.div>
      </AnimatePresence>
      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slots={{
          transition: Transition,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "background.default",
              backgroundImage: "none",
              borderRadius: isMobile ? 0 : 3,
              overflow: "hidden",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CompareArrowsIcon sx={{ color: COLOR_A, fontSize: "1.3rem" }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,
                fontSize: { xs: "1rem", sm: "1.25rem" },
              }}
            >
              Comparaison
            </Typography>
          </Box>
          <IconButton onClick={() => setDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          {canCompare && (
            <Box>
              {/* Names header */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-around",
                  mb: 2,
                }}
              >
                {selected.map((r, idx) => {
                  const c = idx === 0 ? COLOR_A : COLOR_B;
                  return (
                    <Box key={r.id} sx={{ textAlign: "center" }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 900,
                          color: c,
                          fontSize: { xs: "1rem", sm: "1.2rem" },
                        }}
                      >
                        {r.playerName}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 700,
                          fontSize: "0.7rem",
                        }}
                      >
                        #{r.rank} · {r.score.toLocaleString("fr-FR")} pts
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ mb: 2 }} />

              <CompareRadar a={selected[0]!} b={selected[1]!} />
              <CompareTable a={selected[0]!} b={selected[1]!} />

              {/* Verdict */}
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(COLOR_A, 0.05),
                  border: `1px solid ${alpha(COLOR_A, 0.1)}`,
                  textAlign: "center",
                }}
              >
                {(() => {
                  const a = selected[0]!;
                  const b = selected[1]!;
                  let sA = 0;
                  let sB = 0;
                  if (a.score > b.score) sA++;
                  else if (b.score > a.score) sB++;
                  if (a.wins > b.wins) sA++;
                  else if (b.wins > a.wins) sB++;
                  const wrA = parseNum(a.winRate);
                  const wrB = parseNum(b.winRate);
                  if (wrA > wrB) sA++;
                  else if (wrB > wrA) sB++;
                  if (a.participation > b.participation) sA++;
                  else if (b.participation > a.participation) sB++;
                  const avgA = parseNum(a.pointsAverage);
                  const avgB = parseNum(b.pointsAverage);
                  if (avgA > avgB) sA++;
                  else if (avgB > avgA) sB++;

                  const winner = sA > sB ? a : sB > sA ? b : null;
                  const winCount = Math.max(sA, sB);
                  const color = sA > sB ? COLOR_A : COLOR_B;

                  if (!winner) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Égalité parfaite !
                      </Typography>
                    );
                  }
                  return (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: "0.8rem", sm: "0.875rem" },
                      }}
                    >
                      <span style={{ color }}>{winner.playerName}</span>domine dans {winCount}
                      catégorie{winCount > 1 ? "s" : ""}sur 5
                    </Typography>
                  );
                })()}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
