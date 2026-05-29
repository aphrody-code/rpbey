"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { EmojiEvents, Toll, TrendingUp, Style } from "@mui/icons-material";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  image: string | null;
  currency: number;
  duelWins: number;
  duelRating: number;
  cardCount: number;
  isCurrentUser: boolean;
}

interface LeaderboardClientProps {
  entries: LeaderboardEntry[];
}

type TabKey = "currency" | "wins" | "mmr" | "collection";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "currency", label: "Pièces", icon: <Toll fontSize="small" /> },
  { key: "wins", label: "Victoires", icon: <EmojiEvents fontSize="small" /> },
  { key: "mmr", label: "MMR", icon: <TrendingUp fontSize="small" /> },
  { key: "collection", label: "Collection", icon: <Style fontSize="small" /> },
];

function medalColor(rank: number): string {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#94a3b8";
  if (rank === 3) return "#cd7f32";
  return "text.secondary";
}

export function LeaderboardClient({ entries }: LeaderboardClientProps) {
  const [tab, setTab] = useState<TabKey>("currency");

  function getValue(entry: LeaderboardEntry): number {
    switch (tab) {
      case "currency":
        return entry.currency;
      case "wins":
        return entry.duelWins;
      case "mmr":
        return entry.duelRating;
      case "collection":
        return entry.cardCount;
    }
  }

  function formatValue(entry: LeaderboardEntry): string {
    const v = getValue(entry);
    switch (tab) {
      case "currency":
        return v.toLocaleString("fr-FR");
      case "mmr":
        return `${v} MMR`;
      default:
        return String(v);
    }
  }

  function columnLabel(): string {
    switch (tab) {
      case "currency":
        return "Pièces";
      case "wins":
        return "Victoires";
      case "mmr":
        return "MMR";
      case "collection":
        return "Cartes";
    }
  }

  const sorted = [...entries].sort((a, b) => getValue(b) - getValue(a));

  return (
    <>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          mb: 3,
          bgcolor: "background.paper",
          borderRadius: "8px 8px 0 0",
          px: 1,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { fontWeight: 600, minHeight: 48, gap: 0.5 },
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={t.label}
              icon={t.icon as any}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      <TableContainer
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 56 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Joueur</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {columnLabel()}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((entry, idx) => {
              const rank = idx + 1;
              return (
                <TableRow
                  key={entry.userId}
                  sx={{
                    bgcolor: entry.isCurrentUser ? "primary.main" : "transparent",
                    "& td": {
                      color: entry.isCurrentUser ? "primary.contrastText" : "text.primary",
                    },
                    "&:last-child td": { border: 0 },
                  }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: entry.isCurrentUser ? "primary.contrastText" : medalColor(rank),
                      }}
                    >
                      {rank <= 3 ? ["1er", "2e", "3e"][rank - 1] : `${rank}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        src={entry.image ?? undefined}
                        alt={entry.name ?? "Blader"}
                        sx={{ width: 28, height: 28, borderRadius: 1 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.name ?? "Blader anonyme"}
                      </Typography>
                      {entry.isCurrentUser && (
                        <Chip
                          label="Vous"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            bgcolor: "rgba(255,255,255,0.25)",
                            color: "primary.contrastText",
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatValue(entry)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Aucun classement disponible pour le moment.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
