"use client";

import {
  alpha,
  Avatar,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import type { TeamMember } from "@rpbey/api-contract";
import { initials, ROLE_COLORS, ROLE_LABELS } from "./shared";

/** Ordre d'affichage : capitaine d'abord, puis co-capitaines, puis membres. */
const ROLE_ORDER = { CAPTAIN: 0, CO_CAPTAIN: 1, MEMBER: 2 } as const;

/**
 * Roster d'équipe en lecture seule (page publique + onglet membres).
 * Chaque ligne lie vers le profil public du joueur. Une colonne d'actions
 * optionnelle est rendue via `renderActions` (réservée au capitaine).
 */
export function TeamRosterTable({
  members,
  renderActions,
}: {
  members: TeamMember[];
  renderActions?: (member: TeamMember) => React.ReactNode;
}) {
  const theme = useTheme();
  const sorted = [...members].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      b.rankingPoints - a.rankingPoints ||
      (a.bladerName ?? a.name ?? "").localeCompare(b.bladerName ?? b.name ?? ""),
  );

  return (
    <TableContainer
      sx={{
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow sx={{ "& th": { fontWeight: 800, color: "text.secondary" } }}>
            <TableCell>Joueur</TableCell>
            <TableCell>Rôle</TableCell>
            <TableCell align="right">Points</TableCell>
            <TableCell align="right">Bilan</TableCell>
            <TableCell align="right">Tournois</TableCell>
            {renderActions && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((m) => (
            <TableRow key={m.userId} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
              <TableCell>
                <Stack
                  direction="row"
                  spacing={1.5}
                  component={Link}
                  href={`/profile/${m.userId}`}
                  sx={{ alignItems: "center", textDecoration: "none", color: "inherit" }}
                >
                  <Avatar
                    src={m.image ?? undefined}
                    sx={{
                      width: 38,
                      height: 38,
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      color: "primary.main",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {initials(m.bladerName ?? m.name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {m.bladerName || m.name || "Blader inconnu"}
                      {typeof m.jerseyNumber === "number" && (
                        <Box component="span" sx={{ color: "text.secondary", ml: 0.5 }}>
                          #{m.jerseyNumber}
                        </Box>
                      )}
                    </Typography>
                    {m.position && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {m.position}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>
                <Chip
                  label={ROLE_LABELS[m.role]}
                  size="small"
                  color={ROLE_COLORS[m.role]}
                  variant={m.role === "MEMBER" ? "outlined" : "filled"}
                  sx={{ fontWeight: 700 }}
                />
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {m.rankingPoints.toLocaleString("fr-FR")}
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="text.secondary">
                  {m.wins}V · {m.losses}D
                </Typography>
              </TableCell>
              <TableCell align="right">{m.tournamentWins}</TableCell>
              {renderActions && <TableCell align="right">{renderActions(m)}</TableCell>}
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={renderActions ? 6 : 5} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">Aucun membre pour le moment.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
