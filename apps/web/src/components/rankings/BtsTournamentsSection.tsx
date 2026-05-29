"use client";

import {
  ExpandMore,
  GridView as PoolsIcon,
  OpenInNew,
  EmojiEvents as Trophy,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";

import { TournamentBracketDb } from "@/components/tournaments";

import { PoolsPanel } from "@/app/(marketing)/tournaments/[id]/_components/PoolsPanel";

import type { BtsSeasonTournament } from "@/server/actions/bts";

interface Props {
  tournaments: BtsSeasonTournament[];
}

interface TournamentAccordionProps {
  tournament: BtsSeasonTournament;
  defaultExpanded: boolean;
}

function TournamentAccordion({ tournament, defaultExpanded }: TournamentAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [tab, setTab] = useState(0);

  const inDb = !!tournament.dbTournamentId;
  const showPoolsTab = inDb && tournament.hasPools;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
        "&:before": { display: "none" },
        mb: 2,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{
          px: { xs: 2, md: 3 },
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            gap: 2,
            my: 1.5,
          },
        }}
      >
        <Trophy sx={{ color: "var(--rpb-primary)", fontSize: 24, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: "0.95rem", md: "1.1rem" },
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tournament.name}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
            {tournament.participantsCount > 0 && (
              <Chip
                size="small"
                label={`${tournament.participantsCount} joueurs`}
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
              />
            )}
            {tournament.state === "complete" && (
              <Chip
                size="small"
                label="Terminé"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
              />
            )}
            {showPoolsTab && (
              <Chip
                size="small"
                icon={<PoolsIcon sx={{ fontSize: "0.85rem !important" }} />}
                label="Poules"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
              />
            )}
            {!inDb && (
              <Chip
                size="small"
                label="Challonge only"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "text.disabled",
                }}
              />
            )}
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1.5, md: 3 }, pb: 3 }}>
        {!inDb ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              borderRadius: 2,
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: alpha("#000", 0.02),
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Ce tournoi n'a pas été importé en base — bracket disponible uniquement sur Challonge.
            </Typography>
            {tournament.challongeUrl && (
              <Button
                href={tournament.challongeUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<OpenInNew />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Voir sur Challonge
              </Button>
            )}
          </Box>
        ) : (
          <>
            <Tabs
              value={tab}
              onChange={(_, v: number) => setTab(v)}
              sx={{
                mb: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                "& .MuiTab-root": {
                  fontWeight: 800,
                  minHeight: 40,
                  fontSize: "0.8rem",
                },
              }}
            >
              <Tab icon={<Trophy sx={{ fontSize: 16 }} />} iconPosition="start" label="Bracket" />
              {showPoolsTab && (
                <Tab
                  icon={<PoolsIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label="Poules"
                />
              )}
            </Tabs>
            {tab === 0 && (
              <TournamentBracketDb
                tournamentId={tournament.dbTournamentId!}
                challongeUrl={tournament.challongeUrl}
                height={560}
              />
            )}
            {tab === 1 && showPoolsTab && <PoolsPanel tournamentId={tournament.dbTournamentId!} />}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export function BtsTournamentsSection({ tournaments }: Props) {
  if (tournaments.length === 0) return null;
  return (
    <Box sx={{ mt: { xs: 4, md: 6 }, mb: { xs: 3, md: 5 } }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 900,
          mb: 2,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontSize: { xs: "0.85rem", md: "1rem" },
        }}
      >
        Tournois de la saison
      </Typography>
      {tournaments.map((t, i) => (
        <TournamentAccordion key={t.slug} tournament={t} defaultExpanded={i === 0} />
      ))}
    </Box>
  );
}
