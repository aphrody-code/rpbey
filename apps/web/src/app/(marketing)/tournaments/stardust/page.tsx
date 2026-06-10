import { Box, Container, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import Image from "next/image";
import { Suspense } from "react";
import RankingSearch from "@/components/rankings/RankingSearch";
import { StardustBladersTable } from "@/components/rankings/StardustBladersTable";
import { StardustHallOfFame } from "@/components/rankings/StardustHallOfFame";
import { StardustTable } from "@/components/rankings/StardustTable";
import { RankingModeSwitcher } from "@/components/rankings/RankingModeSwitcher";
import { StardustTabs } from "@/components/rankings/StardustTabs";
import { StardustThemeSync } from "@/components/theme/StardustThemeSync";
import { type StardustBlader, type StardustRanking } from "@/lib/types";
import { MuiDiscordIcon as DiscordIcon } from "@/components/ui/MuiIcons";
import { getBladerAggregateStats, listStardustChampions } from "@/server/dal/rankings";
import { getRankings } from "@/server/services/rankings";
import { createPageMetadata } from "@/lib/seo-utils";
import { getStardustSeasonStats } from "@/server/actions/stardust";

const ACCENT = "#60A5FA";

export const metadata = createPageMetadata({
  title: "Stardust Séries | Classement RPB Nord",
  description: "Classement officiel des Stardust Séries — la compétition régionale RPB Nord.",
  path: "/tournaments/stardust",
  image: "/api/og/stardust",
});

interface PageProps {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

export default async function StardustPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 100;
  const searchQuery = typeof sp.search === "string" ? sp.search : "";
  const mode = (sp.view === "career" ? "career" : "ranking") as "ranking" | "career";

  const [rankingsData, bladerStats, seasonStatsRes, championsRaw] = await Promise.all([
    getRankings({
      kind: "stardust",
      view: mode,
      season: undefined,
      search: searchQuery || undefined,
      page,
      pageSize,
    }),
    getBladerAggregateStats("stardust"),
    getStardustSeasonStats(),
    listStardustChampions(),
  ]);

  const rankings = mode === "ranking" ? (rankingsData.items as unknown as StardustRanking[]) : [];
  const bladers = mode === "career" ? (rankingsData.items as unknown as StardustBlader[]) : [];
  const lastUpdate = { updatedAt: rankingsData.lastUpdate };
  const totalCount = rankingsData.total;
  const totalPages = rankingsData.totalPages;
  const totalBladers = bladerStats.totalBladers;
  const totalMatches = bladerStats.totalMatches;
  const seasonData = seasonStatsRes.success
    ? seasonStatsRes.data
    : { tournamentCount: 0, uniqueParticipants: 0, metas: [] };

  const champions = championsRaw
    .map((t) => ({
      rank: 1 as const,
      name: t.tournamentParticipants[0]?.playerName ?? "Inconnu",
      tournamentSlug: t.id,
      tournamentLabel: t.name,
    }))
    .filter((c) => c.name !== "Inconnu");

  const socials = [
    {
      name: "Discord RPB",
      url: "https://discord.gg/rpb",
      icon: DiscordIcon,
      color: "#5865F2",
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 50% 0%, #0a1a2e 0%, #06101c 30%, #040810 60%, #020408 100%)",
        pt: { xs: 2, md: 4 },
        pb: 8,
        position: "relative",
        "&::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(96,165,250,0.015) 20px, rgba(96,165,250,0.015) 21px)",
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <StardustThemeSync />
        <RankingModeSwitcher active="stardust" />
        <Box
          sx={{
            mb: { xs: 3, md: 6 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: { xs: 2, md: 3 },
          }}
        >
          {/* Bloc logo + titre — toujours visible (avec titre sur mobile aussi) */}
          <Box
            sx={{
              flex: { md: 1 },
              display: "flex",
              justifyContent: { xs: "center", md: "flex-start" },
              alignItems: "center",
              gap: { xs: 1.5, md: 2 },
              width: "100%",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: 52, md: 80 },
                height: { xs: 52, md: 80 },
                flexShrink: 0,
              }}
            >
              <Image
                src="/stardust-logo.webp"
                alt="Stardust Séries"
                fill
                style={{ objectFit: "contain" }}
                priority
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "0.6rem", md: "0.7rem" },
                  letterSpacing: 2,
                  color: ACCENT,
                  lineHeight: 1,
                }}
              >
                RPB NORD
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "1.1rem", md: "1.4rem" },
                  color: "#fff",
                  lineHeight: 1.1,
                  mt: 0.25,
                }}
              >
                Stardust Séries
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              flex: { md: 2 },
              width: "100%",
              maxWidth: { xs: "100%", md: 500 },
              order: { xs: 3, md: 2 },
            }}
          >
            <Suspense
              fallback={
                <Paper
                  sx={{
                    height: 44,
                    width: "100%",
                    bgcolor: "rgba(255,255,255,0.05)",
                    borderRadius: 3,
                  }}
                />
              }
            >
              <RankingSearch defaultValue={searchQuery} />
            </Suspense>
          </Box>

          <Box
            sx={{
              flex: { md: 1 },
              display: "flex",
              justifyContent: { xs: "center", md: "flex-end" },
              order: { xs: 2, md: 3 },
              width: "100%",
            }}
          >
            <Stack direction="row" spacing={1}>
              {socials.map((s) => (
                <Tooltip key={s.name} title={s.name}>
                  <IconButton
                    component="a"
                    href={s.url}
                    target="_blank"
                    size="small"
                    sx={{
                      color: "rgba(255,255,255,0.4)",
                      bgcolor: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      "&:hover": {
                        color: s.color,
                        bgcolor: "rgba(255,255,255,0.08)",
                        transform: "translateY(-3px)",
                        boxShadow: `0 5px 15px ${alpha(s.color, 0.3)}`,
                      },
                      transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    <s.icon sx={{ fontSize: { xs: 18, md: 20 } }} />
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          </Box>
        </Box>

        <StardustHallOfFame champions={champions} />

        <Box sx={{ position: "relative" }}>
          <StardustTabs
            mode={mode}
            totalBladers={totalBladers}
            totalMatches={totalMatches}
            tournamentCount={seasonData.tournamentCount}
            uniqueParticipants={seasonData.uniqueParticipants}
          />

          {lastUpdate?.updatedAt && (
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: { xs: -15, md: -20 },
                right: 8,
                color: "rgba(255,255,255,0.3)",
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: { xs: "0.55rem", md: "0.65rem" },
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Sync:{" "}
              {new Date(lastUpdate.updatedAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
          )}

          <Box sx={{ mt: { xs: 1, md: 2 } }}>
            {mode === "ranking" ? (
              <StardustTable
                rankings={rankings as StardustRanking[]}
                totalPages={totalPages}
                currentPage={page}
                totalCount={totalCount}
              />
            ) : (
              <StardustBladersTable
                bladers={bladers as StardustBlader[]}
                totalPages={totalPages}
                currentPage={page}
                totalCount={totalCount}
              />
            )}
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
            textAlign: "center",
            mt: 6,
            opacity: 0.2,
            letterSpacing: 2,
            fontWeight: 900,
            fontSize: { xs: "0.6rem", md: "0.75rem" },
          }}
        >
          STARDUST SÉRIES • RPB NORD
        </Typography>
      </Container>
    </Box>
  );
}
