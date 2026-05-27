"use client";

import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { alpha, Checkbox, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { type SatrBlader, type SatrRanking } from "@/lib/types";
import { getSatrBladerByName } from "@/server/actions/satr";
import { SatrBladerDialog } from "./SatrBladerDialog";
import { SatrComparator } from "./SatrComparator";

interface SatrTableProps {
  rankings: SatrRanking[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export function SatrTable({ rankings, totalPages, currentPage }: SatrTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedBlader, setSelectedBlader] = useState<SatrBlader | null>(null);
  const [loadingBlader, setLoadingBlader] = useState(false);
  const [compareList, setCompareList] = useState<SatrRanking[]>([]);

  const isSelected = useCallback(
    (id: string) => compareList.some((r) => r.id === id),
    [compareList],
  );

  const toggleCompare = useCallback((ranking: SatrRanking, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareList((prev) => {
      if (prev.some((r) => r.id === ranking.id)) {
        return prev.filter((r) => r.id !== ranking.id);
      }
      if (prev.length >= 2) {
        return [prev[1]!, ranking];
      }
      return [...prev, ranking];
    });
  }, []);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", value.toString());
    router.push(`/tournaments/satr?${params.toString()}`);
  };

  const handleRowClick = async (name: string) => {
    setLoadingBlader(true);
    try {
      const res = await getSatrBladerByName(name);
      if (res.success && res.data) {
        setSelectedBlader(res.data as SatrBlader);
      } else {
        toast.error(`Historique introuvable pour ${name}`);
      }
    } catch {
      toast.error("Erreur lors de la récupération de l'historique");
    } finally {
      setLoadingBlader(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      const colors = {
        1: "#FFD700",
        2: "#C0C0C0",
        3: "#CD7F32",
      };
      const color = colors[rank as 1 | 2 | 3];
      return (
        <Box
          sx={{
            width: { xs: 24, md: 28 },
            height: { xs: 24, md: 28 },
            borderRadius: "50%",
            bgcolor: color,
            color: rank === 1 ? "#000" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: { xs: "0.7rem", md: "0.8rem" },
            mx: "auto",
            boxShadow: `0 0 15px ${alpha(color, 0.4)}`,
            border: "2px solid rgba(255,255,255,0.2)",
          }}
        >
          {rank}
        </Box>
      );
    }

    return (
      <Typography
        sx={{
          fontWeight: "900",
          color: "text.secondary",
          fontSize: { xs: "0.75rem", md: "0.85rem" },
          opacity: 0.6,
        }}
      >
        #{rank}
      </Typography>
    );
  };

  return (
    <Box sx={{ position: "relative" }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 4,
          overflowX: "auto",
          mb: 3,
          "&::-webkit-scrollbar": { height: "4px" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.1)",
            borderRadius: 0,
          },
        }}
      >
        <Table size="small" sx={{ minWidth: { xs: 450, md: "100%" } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "rgba(255,255,255,0.03)" }}>
              <TableCell width={40} align="center" sx={{ py: 2, px: { xs: 0.5, md: 1 } }}>
                <Tooltip title="Sélectionnez 2 bladers pour comparer">
                  <CompareArrowsIcon
                    sx={{
                      fontSize: 16,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  />
                </Tooltip>
              </TableCell>
              <TableCell
                width={60}
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Rang
              </TableCell>
              <TableCell
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Blader
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Score
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                W-L
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  display: { xs: "none", sm: "table-cell" },
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Part.
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Winrate
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  display: { xs: "none", md: "table-cell" },
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  letterSpacing: 1,
                }}
              >
                Moyenne
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rankings.length > 0 ? (
              rankings.map((row) => (
                <TableRow
                  key={row.id}
                  component={motion.tr}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  hover
                  onClick={() => handleRowClick(row.playerName)}
                  sx={{
                    "& td": {
                      py: 1,
                      borderBottom: "1px solid rgba(255,255,255,0.02)",
                    },
                    "&:hover": { bgcolor: "rgba(255,255,255,0.03) !important" },
                    cursor: loadingBlader ? "wait" : "pointer",
                  }}
                >
                  <TableCell align="center" sx={{ px: { xs: 0.5, md: 1 } }}>
                    <Checkbox
                      size="small"
                      checked={isSelected(row.id)}
                      onClick={(e) => toggleCompare(row, e)}
                      sx={{
                        p: 0.5,
                        color: "rgba(255,255,255,0.15)",
                        "&.Mui-checked": { color: "#fbbf24" },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">{getRankBadge(row.rank)}</TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontWeight: "800",
                        fontSize: { xs: "0.85rem", md: "0.95rem" },
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.playerName}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      sx={{
                        fontWeight: "900",
                        fontSize: { xs: "0.85rem", md: "1rem" },
                        color: "secondary.main",
                      }}
                    >
                      {row.score.toLocaleString("fr-FR")}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      sx={{
                        fontWeight: "700",
                        fontSize: "0.85rem",
                      }}
                    >
                      <Box component="span" sx={{ color: "success.main" }}>
                        {row.wins}
                      </Box>
                      <Box component="span" sx={{ color: "text.secondary", mx: 0.25 }}>
                        -
                      </Box>
                      <Box component="span" sx={{ color: "error.main" }}>
                        {row.losses}
                      </Box>
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    <Typography sx={{ fontSize: "0.85rem", opacity: 0.8 }}>
                      {row.participation}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box
                      sx={{
                        display: "inline-block",
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: "800",
                          fontSize: "0.8rem",
                        }}
                      >
                        {row.winRate}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {row.pointsAverage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    Aucun blader trouvé
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? "small" : "large"}
            showFirstButton
            showLastButton
            sx={{
              "& .MuiPaginationItem-root": {
                fontWeight: 900,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.1)",
                "&.Mui-selected": {
                  bgcolor: "secondary.main",
                  color: "#000",
                  "&:hover": { bgcolor: "secondary.dark" },
                },
              },
            }}
          />
        </Box>
      )}
      <SatrBladerDialog
        blader={selectedBlader}
        open={!!selectedBlader}
        onClose={() => setSelectedBlader(null)}
      />
      <SatrComparator
        selected={compareList}
        onRemove={(id) => setCompareList((prev) => prev.filter((r) => r.id !== id))}
        onClear={() => setCompareList([])}
      />
    </Box>
  );
}
