"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PollIcon from "@mui/icons-material/Poll";
import {
  alpha,
  Box,
  Chip,
  Container,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import type { PollSummary, TierListSummary } from "@rpbey/api-contract";
import { AwardCard } from "./AwardCard";
import { AwardsEditionBanner } from "./AwardsEditionBanner";
import { PollCard } from "./PollCard";
import { TierListCard } from "./TierListCard";

interface Props {
  awards: PollSummary[];
  polls: PollSummary[];
  tierLists: TierListSummary[];
}

function EmptyState({ message }: { message: string }) {
  return (
    <Box
      sx={{
        py: 6,
        textAlign: "center",
        borderRadius: 4,
        border: "1px dashed",
        borderColor: "divider",
      }}
    >
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Stack spacing={0.5} sx={{ mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        {icon}
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
          {title}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {subtitle}
        </Typography>
      )}
    </Stack>
  );
}

export function SondagesHub({ awards, polls, tierLists }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const gold = "#ffca28";

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {/* En-tête */}
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <PollIcon sx={{ fontSize: 36, color: "primary.main" }} />
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            Sondages & Tier Lists
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 400 }}>
          Donne ton avis à la communauté Beyblade : vote, note, classe tes toupies favorites.
        </Typography>
      </Stack>

      {/* Bandeau vidéo de l'édition Awards publiée la plus récente */}
      <AwardsEditionBanner />

      {/* Bandeau Beyblade Awards France 2025 */}
      {awards.length > 0 && (
        <Box
          sx={{
            mb: 5,
            p: { xs: 2.5, md: 4 },
            borderRadius: 5,
            border: "1px solid",
            borderColor: alpha(gold, 0.35),
            background: `radial-gradient(1200px 320px at 0% 0%, ${alpha(gold, 0.16)} 0%, transparent 60%), linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.92)} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
            backdropFilter: "blur(16px)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "flex-start", sm: "center" },
              mb: 2.5,
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <EmojiEventsIcon sx={{ fontSize: 40, color: gold }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                  Beyblade Awards France 2025
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Élis les meilleurs de l'année dans chaque catégorie. Un clic, un vote.
                </Typography>
              </Box>
            </Stack>
            <Chip
              label={`${awards.length} catégorie${awards.length > 1 ? "s" : ""}`}
              sx={{ fontWeight: 800, bgcolor: alpha(gold, 0.2) }}
            />
          </Stack>

          <Grid container spacing={2}>
            {awards.map((poll) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={poll.id}>
                <AwardCard poll={poll} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Onglets Sondages / Tier Lists */}
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none", fontSize: "1rem" },
        }}
      >
        <Tab icon={<HowToVoteIcon />} iconPosition="start" label={`Sondages (${polls.length})`} />
        <Tab
          icon={<LeaderboardIcon />}
          iconPosition="start"
          label={`Tier Lists (${tierLists.length})`}
        />
      </Tabs>

      {tab === 0 && (
        <Box>
          <SectionTitle
            icon={<HowToVoteIcon sx={{ color: "primary.main" }} />}
            title="Sondages de la communauté"
            subtitle="Choix unique, choix multiple ou notation — ton vote est modifiable à tout moment."
          />
          {polls.length === 0 ? (
            <EmptyState message="Aucun sondage pour le moment. Reviens bientôt !" />
          ) : (
            <Grid container spacing={2.5}>
              {polls.map((poll) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={poll.id}>
                  <PollCard poll={poll} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <SectionTitle
            icon={<LeaderboardIcon sx={{ color: "secondary.main" }} />}
            title="Tier Lists communautaires"
            subtitle="Compose ton classement S → F et compare-le à celui de toute la communauté."
          />
          {tierLists.length === 0 ? (
            <EmptyState message="Aucune tier list pour le moment. Reviens bientôt !" />
          ) : (
            <Grid container spacing={2.5}>
              {tierLists.map((tierList) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tierList.id}>
                  <TierListCard tierList={tierList} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Container>
  );
}
