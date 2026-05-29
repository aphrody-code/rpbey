"use client";

import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { TrophyIcon } from "@/components/ui/Icons";
import { type WbBlader } from "@/lib/types";
import { WbBladerDialog } from "./WbBladerDialog";

interface WbBladersTableProps {
  bladers: WbBlader[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export function WbBladersTable({ bladers, totalPages, currentPage }: WbBladersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedBlader, setSelectedBlader] = useState<WbBlader | null>(null);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", value.toString());
    router.push(`/tournaments/wb?${params.toString()}`);
  };

  return (
    <Box>
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
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "rgba(255,255,255,0.03)" }}>
              <TableCell
                width={60}
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                #
              </TableCell>
              <TableCell
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
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
                  fontSize: "0.7rem",
                }}
              >
                Titres
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Wins
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Losses
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Winrate
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Tournois
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  py: 2,
                  display: { xs: "none", md: "table-cell" },
                  fontWeight: 900,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Forme
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bladers.length > 0 ? (
              bladers.map((row, index) => {
                const totalMatches = row.totalWins + row.totalLosses;
                const winRate =
                  totalMatches > 0 ? ((row.totalWins / totalMatches) * 100).toFixed(1) : "0";
                const history = row.history as Array<{
                  tournament: string;
                  wins: number;
                  losses: number;
                  rank?: number;
                }>;
                const absoluteIndex = (currentPage - 1) * 100 + index + 1;

                const hasPodium = history.some((h) => h.rank && h.rank <= 3);
                const tournamentWins = row.tournamentWins || 0;

                return (
                  <TableRow
                    key={row.id}
                    component={motion.tr}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    hover
                    onClick={() => setSelectedBlader(row)}
                    sx={{
                      "& td": {
                        py: 1,
                        borderBottom: "1px solid rgba(255,255,255,0.02)",
                      },
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.03) !important",
                      },
                    }}
                  >
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5 }}>
                        #{absoluteIndex}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Typography
                          sx={{
                            fontWeight: "800",
                            fontSize: "0.9rem",
                            color: "#fff",
                          }}
                        >
                          {row.name}
                        </Typography>
                        {!tournamentWins && hasPodium && (
                          <Tooltip title="Podium WB">
                            <Box
                              sx={{
                                display: "flex",
                                color: "#C0C0C0",
                                opacity: 0.8,
                              }}
                            >
                              <TrophyIcon size={16} />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {tournamentWins > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 0.5,
                            color: "#FFD700",
                            filter: "drop-shadow(0 0 5px rgba(255,215,0,0.5))",
                          }}
                        >
                          <TrophyIcon size={16} />
                          {tournamentWins > 1 && (
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 900, color: "#FFD700" }}
                            >
                              x{tournamentWins}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        sx={{
                          color: "success.main",
                          fontWeight: "bold",
                          fontSize: "0.9rem",
                        }}
                      >
                        {row.totalWins}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        sx={{
                          color: "error.main",
                          fontSize: "0.9rem",
                          opacity: 0.8,
                        }}
                      >
                        {row.totalLosses}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        sx={{
                          fontWeight: "900",
                          fontSize: "0.9rem",
                        }}
                      >
                        {winRate}%
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        sx={{
                          fontWeight: "700",
                          fontSize: "0.9rem",
                          opacity: 0.9,
                        }}
                      >
                        {row.tournamentsCount}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.75,
                          justifyContent: "center",
                        }}
                      >
                        {history.slice(-5).map((h, i) => (
                          <Tooltip
                            key={i}
                            title={`${h.tournament.toUpperCase()}: Rang ${h.rank || "?"}`}
                          >
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: 0,
                                rotate: "45deg",
                                bgcolor:
                                  h.wins > h.losses
                                    ? "success.main"
                                    : h.wins < h.losses
                                      ? "error.main"
                                      : "warning.main",
                                opacity: 0.7,
                                border: "1px solid rgba(255,255,255,0.1)",
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                  <Typography
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
            size="large"
            showFirstButton
            showLastButton
            sx={{
              "& .MuiPaginationItem-root": {
                fontWeight: 900,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.1)",
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "&:hover": { bgcolor: "primary.dark" },
                },
              },
            }}
          />
        </Box>
      )}
      <WbBladerDialog
        blader={selectedBlader}
        open={!!selectedBlader}
        onClose={() => setSelectedBlader(null)}
      />
    </Box>
  );
}
