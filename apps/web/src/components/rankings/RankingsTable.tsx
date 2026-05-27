"use client";

import {
  CompareArrows as CompareIcon,
  EmojiEvents as TrophyIcon,
  CheckCircle as VerifiedIcon,
} from "@mui/icons-material";
import { alpha, Checkbox, type Theme, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import Avatar from "@mui/material/Avatar";
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { type Profile, type User } from "@/lib/types";
import { authClient } from "@/lib/auth-client";
import { avatarSrc, getInitials } from "@/lib/utils";
import BladerComparator from "./BladerComparator";

export type ProfileWithUser = Profile & {
  user: User & {
    _count: {
      tournaments: number;
    };
  };
};

function BladerInfo({ profile, theme }: { profile: ProfileWithUser; theme: Theme }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.25 },
        py: { xs: 0.25, sm: 0 },
        "&:hover": {
          "& .MuiTypography-root": {
            color: "primary.main",
          },
        },
      }}
    >
      <Avatar
        src={avatarSrc(profile.user?.image)}
        alt={profile.bladerName || profile.user?.name || "Blader"}
        sx={{
          width: { xs: 24, sm: 30 },
          height: { xs: 24, sm: 30 },
          border: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        {getInitials(profile.bladerName || profile.user?.name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <Typography
            sx={{
              fontWeight: "bold",
              transition: "color 0.2s",
              fontSize: { xs: "0.725rem", sm: "0.825rem" },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {profile.bladerName ||
              profile.user?.name ||
              profile.challongeUsername ||
              profile.user?.username?.replace(/^bts[1-3]_/, "") ||
              "Anonyme"}
          </Typography>
          {profile.challongeUsername && (
            <Tooltip title={`Challonge : ${profile.challongeUsername}`}>
              <Link
                href={`https://challonge.com/fr/users/${profile.challongeUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center" }}
              >
                <VerifiedIcon
                  sx={{
                    fontSize: { xs: "0.6rem", sm: "0.75rem" },
                    color: "info.main",
                    opacity: 0.8,
                    flexShrink: 0,
                  }}
                />
              </Link>
            </Tooltip>
          )}
          {profile.tournamentWins > 0 && (
            <Tooltip title={`${profile.tournamentWins} tournoi(s) remporté(s)`}>
              <TrophyIcon
                sx={{
                  fontSize: { xs: "0.65rem", sm: "0.85rem" },
                  color: "#FFD700",
                  filter: "drop-shadow(0 0 2px rgba(255, 215, 0, 0.4))",
                  flexShrink: 0,
                }}
              />
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
}

interface RankingsTableProps {
  profiles: ProfileWithUser[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
  profileUrlPrefix?: string;
  baseUrl?: string;
}

export function RankingsTable({
  profiles,
  totalPages,
  currentPage,
  totalCount,
  profileUrlPrefix = "/profile",
  baseUrl = "/rankings",
}: RankingsTableProps) {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // Comparator state
  const [compareSelection, setCompareSelection] = useState<ProfileWithUser[]>([]);

  const handleToggleCompare = useCallback((profile: ProfileWithUser) => {
    setCompareSelection((prev) => {
      const exists = prev.find((p) => p.id === profile.id);
      if (exists) return prev.filter((p) => p.id !== profile.id);
      if (prev.length >= 2) return [prev[1]!, profile];
      return [...prev, profile];
    });
  }, []);

  const handleRemoveCompare = useCallback((id: string) => {
    setCompareSelection((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearCompare = useCallback(() => {
    setCompareSelection([]);
  }, []);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", value.toString());
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const getRankColor = (index: number) => {
    const absoluteRank = (currentPage - 1) * 100 + index + 1;
    if (absoluteRank === 1) return "#FFD700";
    if (absoluteRank === 2) return "#C0C0C0";
    if (absoluteRank === 3) return "#CD7F32";
    return theme.palette.text.primary;
  };

  const getRankBadge = (index: number) => {
    const absoluteRank = (currentPage - 1) * 100 + index + 1;

    if (absoluteRank <= 3) {
      return (
        <Box
          sx={{
            width: { xs: 24, sm: 28 },
            height: { xs: 24, sm: 28 },
            borderRadius: "50%",
            bgcolor: getRankColor(index),
            color: "rgba(0, 0, 0, 0.87)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "900",
            mx: "auto",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            textShadow: "none",
            fontSize: { xs: "0.7rem", sm: "0.875rem" },
          }}
        >
          {absoluteRank}
        </Box>
      );
    }

    return (
      <Typography
        sx={{
          fontWeight: "bold",
          color: "text.secondary",
          fontSize: { xs: "0.7rem", sm: "0.875rem" },
        }}
      >
        #{absoluteRank}
      </Typography>
    );
  };

  return (
    <Box>
      {/* Stats summary bar */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          mb: 2,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              px: { xs: 1, sm: 1.5 },
              py: 0.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.15),
            }}
          >
            <Typography
              variant="caption"
              sx={{ opacity: 0.6, fontSize: { xs: "0.6rem", sm: "0.7rem" } }}
            >
              Total
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                fontSize: { xs: "0.7rem", sm: "0.8rem" },
              }}
            >
              {totalCount} bladers
            </Typography>
          </Box>
          {profiles.length > 0 && (
            <Box
              sx={{
                px: { xs: 1, sm: 1.5 },
                py: 0.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: "1px solid",
                borderColor: alpha(theme.palette.success.main, 0.15),
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.6,
                  fontSize: { xs: "0.6rem", sm: "0.7rem" },
                }}
              >
                Moy. points
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 900,
                  color: "success.main",
                  fontSize: { xs: "0.7rem", sm: "0.8rem" },
                }}
              >
                {Math.round(profiles.reduce((s, p) => s + p.rankingPoints, 0) / profiles.length)}
              </Typography>
            </Box>
          )}
        </Box>
        {compareSelection.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              color: "primary.main",
              fontWeight: 700,
              fontSize: { xs: "0.65rem", sm: "0.75rem" },
            }}
          >
            <CompareIcon
              sx={{
                fontSize: { xs: "0.75rem", sm: "0.9rem" },
                verticalAlign: "middle",
                mr: 0.5,
              }}
            />
            {compareSelection.length}/2
          </Typography>
        )}
      </Box>
      <TableContainer
        component={Paper}
        elevation={0}
        role="region"
        aria-label="Tableau des classements"
        tabIndex={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: { xs: 1.5, sm: 2 },
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          maxHeight: { xs: "none", md: "80vh" },
          mb: { xs: 2, sm: 4 },
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: "blur(8px)",
          // Scroll indicators
          background: {
            xs: `linear-gradient(to right, ${alpha(theme.palette.background.paper, 0.6)}, ${alpha(theme.palette.background.paper, 0.6)}), linear-gradient(to right, ${alpha(theme.palette.background.paper, 0.6)}, ${alpha(theme.palette.background.paper, 0.6)}), linear-gradient(to right, rgba(0,0,0,0.15), transparent), linear-gradient(to left, rgba(0,0,0,0.15), transparent)`,
            md: "none",
          },
          backgroundPosition: {
            xs: "left center, right center, left center, right center",
            md: undefined,
          },
          backgroundRepeat: { xs: "no-repeat", md: undefined },
          backgroundSize: {
            xs: "20px 100%, 20px 100%, 10px 100%, 10px 100%",
            md: undefined,
          },
          backgroundAttachment: {
            xs: "local, local, scroll, scroll",
            md: undefined,
          },
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
          "&::-webkit-scrollbar": { height: "6px", width: "6px" },
          "&::-webkit-scrollbar-track": {
            bgcolor: alpha(theme.palette.background.default, 0.3),
            borderRadius: 0,
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: alpha(theme.palette.text.secondary, 0.3),
            borderRadius: 0,
            "&:hover": {
              bgcolor: alpha(theme.palette.text.secondary, 0.5),
            },
          },
        }}
      >
        <Table size="small" stickyHeader aria-label="Classement des bladers">
          <TableHead>
            <TableRow>
              {!isMobile && (
                <TableCell
                  scope="col"
                  align="center"
                  sx={{
                    width: 32,
                    px: 0.5,
                    bgcolor: "background.paper",
                    fontWeight: "bold",
                  }}
                >
                  <Tooltip title="Sélectionner pour comparer">
                    <CompareIcon sx={{ fontSize: "0.9rem", opacity: 0.5 }} aria-label="Comparer" />
                  </Tooltip>
                </TableCell>
              )}
              <TableCell
                scope="col"
                align="center"
                sx={{
                  width: { xs: 32, sm: 50 },
                  px: { xs: 0.5, sm: 1.5 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                }}
              >
                <abbr title="Rang">#</abbr>
              </TableCell>
              <TableCell
                scope="col"
                sx={{
                  px: { xs: 1, sm: 2 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                  fontSize: "0.825rem",
                }}
              >
                Blader
              </TableCell>
              <TableCell
                scope="col"
                align="center"
                sx={{
                  px: { xs: 0.5, sm: 1.5 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                  fontSize: "0.825rem",
                }}
              >
                <Tooltip title="Points de classement">
                  <span>Pts</span>
                </Tooltip>
              </TableCell>
              <TableCell
                scope="col"
                align="center"
                sx={{
                  px: { xs: 0.5, sm: 1.5 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                  fontSize: "0.825rem",
                  display: { xs: "none", sm: "table-cell" },
                }}
              >
                <Tooltip title="Nombre de tournois officiels disputés">
                  <abbr title="Tournois">T.</abbr>
                </Tooltip>
              </TableCell>
              <TableCell
                scope="col"
                align="center"
                sx={{
                  px: { xs: 0.5, sm: 1.5 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                  fontSize: "0.825rem",
                }}
              >
                <Tooltip title="Victoires / Défaites">
                  <abbr title="Victoires / Défaites">V/D</abbr>
                </Tooltip>
              </TableCell>
              <TableCell
                scope="col"
                align="center"
                sx={{
                  px: { xs: 0.5, sm: 1.5 },
                  bgcolor: "background.paper",
                  fontWeight: "bold",
                  fontSize: "0.825rem",
                  display: { xs: "none", md: "table-cell" },
                }}
              >
                <Tooltip title="Taux de victoire (Win Rate)">
                  <abbr title="Taux de victoire">WR</abbr>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {profiles.length > 0 ? (
              profiles.map((profile, index) => {
                const totalMatches = profile.wins + profile.losses;
                const winRate =
                  totalMatches > 0 ? ((profile.wins / totalMatches) * 100).toFixed(0) : "0";

                const isCurrentUser = session?.user?.id === profile.userId;
                const isSelected = compareSelection.some((p) => p.id === profile.id);

                return (
                  <TableRow
                    key={profile.id}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.06)
                        : isCurrentUser
                          ? alpha(theme.palette.primary.main, 0.08)
                          : index % 2 === 0
                            ? "transparent"
                            : "rgba(255, 255, 255, 0.015)",
                      transition: "background-color 0.2s",
                      borderLeft: isCurrentUser
                        ? `3px solid ${theme.palette.primary.main}`
                        : isSelected
                          ? `3px solid ${alpha(theme.palette.primary.main, 0.6)}`
                          : "3px solid transparent",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.action.hover, 0.08),
                      },
                    }}
                  >
                    {!isMobile && (
                      <TableCell
                        align="center"
                        sx={{ px: 0.5, width: 32, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCompare(profile);
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          aria-label={`Comparer ${profile.bladerName || profile.user?.name || "ce blader"}`}
                          sx={{
                            p: 0,
                            "& .MuiSvgIcon-root": { fontSize: "1rem" },
                            color: alpha(theme.palette.text.secondary, 0.3),
                            "&.Mui-checked": {
                              color: "primary.main",
                            },
                          }}
                          slotProps={{
                            input: {
                              "aria-describedby": undefined,
                            },
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell align="center" sx={{ px: { xs: 0.5, sm: 1.5 } }}>
                      {getRankBadge(index)}
                    </TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                      {profile.userId ? (
                        <Link
                          href={`${profileUrlPrefix}/${profile.userId}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                          aria-label={`Voir le profil de ${profile.bladerName || profile.user?.name || "ce blader"}`}
                        >
                          <BladerInfo profile={profile} theme={theme} />
                        </Link>
                      ) : (
                        <Box sx={{ color: "inherit" }}>
                          <BladerInfo profile={profile} theme={theme} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ px: { xs: 0.5, sm: 1.5 } }}>
                      <Typography
                        sx={{
                          fontWeight: "900",
                          color: "primary.main",
                          fontSize: { xs: "0.75rem", sm: "1rem" },
                        }}
                      >
                        {profile.rankingPoints}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        px: { xs: 0.5, sm: 1.5 },
                        display: { xs: "none", sm: "table-cell" },
                      }}
                    >
                      <Typography sx={{ fontSize: { xs: "0.7rem", sm: "0.825rem" } }}>
                        {profile.user?._count?.tournaments || 0}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ px: { xs: 0.5, sm: 1.5 } }}>
                      <Typography
                        sx={{
                          fontSize: { xs: "0.675rem", sm: "0.8rem" },
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ color: theme.palette.success.main }}>{profile.wins}</span>
                        <span style={{ opacity: 0.4, margin: "0 1px" }}>/</span>
                        <span style={{ color: theme.palette.error.main }}>{profile.losses}</span>
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        px: { xs: 0.5, sm: 1.5 },
                        display: { xs: "none", md: "table-cell" },
                      }}
                    >
                      <Typography
                        color={Number.parseFloat(winRate) >= 50 ? "success.main" : "text.secondary"}
                        sx={{
                          fontWeight: "bold",
                          fontSize: { xs: "0.7rem", sm: "0.875rem" },
                        }}
                      >
                        {winRate}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={isMobile ? 4 : 7} align="center" sx={{ py: 8 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    Aucun blader trouvé
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.disabled",
                    }}
                  >
                    Essayez de modifier votre recherche.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: { xs: 2, sm: 4 },
          }}
        >
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? "small" : "medium"}
            showFirstButton={!isMobile}
            showLastButton={!isMobile}
            shape="rounded"
            aria-label="Navigation entre les pages du classement"
            getItemAriaLabel={(type, page, selected) => {
              if (type === "page") return `${selected ? "Page actuelle, " : ""}Page ${page}`;
              if (type === "first") return "Première page";
              if (type === "last") return "Dernière page";
              if (type === "next") return "Page suivante";
              return "Page précédente";
            }}
          />
        </Box>
      )}
      {/* Blader Comparator */}
      <BladerComparator
        selectedBladers={compareSelection}
        onRemove={handleRemoveCompare}
        onClear={handleClearCompare}
        currentPage={currentPage}
        allProfiles={profiles}
      />
    </Box>
  );
}
