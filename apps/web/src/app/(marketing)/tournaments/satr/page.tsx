import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Box, Container, Paper, Typography } from "@mui/material";
import Image from "next/image";
import { Suspense } from "react";
import RankingSearch from "@/components/rankings/RankingSearch";
import { SatrBladersTable } from "@/components/rankings/SatrBladersTable";
import { SatrCharts } from "@/components/rankings/SatrCharts";
import { SatrHallOfFame } from "@/components/rankings/SatrHallOfFame";
import { SatrTable } from "@/components/rankings/SatrTable";
import { RankingModeSwitcher } from "@/components/rankings/RankingModeSwitcher";
import { SatrTabs } from "@/components/rankings/SatrTabs";
import { SeasonTabs } from "@/components/rankings/SeasonTabs";
import { type SatrBlader, type SatrRanking } from "@/lib/types";
import { getBladerAggregateStats, listSeasonRankingsAll } from "@/server/dal/rankings";
import { getRankings } from "@/server/services/rankings";
import { getSatrSeasonStats } from "@/server/actions/satr";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Classement SAtR | Sun After The Reign",
  description: "Le classement officiel des Beyblade Battle Tournaments de Sun After the Reign.",
};

interface SatrPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface Champion {
  tournament: string;
  winner: string;
  date: string;
}

/**
 * Return the SATR season a BBT belongs to. The SATR seasons split on
 * BBT #12 (S1: #1→#11, S2: #12→#22, …).
 */
function satrSeasonForTournament(tournament: string): number | null {
  const m = /BBT\s*#?(\d+)/i.exec(tournament);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return null;
  if (n <= 11) return 1;
  if (n <= 22) return 2;
  return null;
}

async function getChampions(season: number): Promise<Champion[]> {
  try {
    const path = join(process.cwd(), "data", "satr_champions.json");
    const content = await readFile(path, "utf-8");
    const all = JSON.parse(content) as Champion[];
    return all.filter((c) => satrSeasonForTournament(c.tournament) === season);
  } catch {
    return [];
  }
}

export default async function SatrPage({ searchParams }: SatrPageProps) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number(resolvedSearchParams.page) || 1);
  const pageSize = 100;
  const searchQuery =
    typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : "";
  const mode = (resolvedSearchParams.view === "career" ? "career" : "ranking") as
    | "ranking"
    | "career";
  const seasonParam = Number(resolvedSearchParams.season);
  const season = seasonParam === 1 ? 1 : 2; // défaut Saison 2 (courante)

  const [champions, rankingData, globalStats, seasonStatsRes, allRankingsRaw] = await Promise.all([
    getChampions(season),
    getRankings({
      kind: "satr",
      view: mode,
      season,
      search: searchQuery || undefined,
      page,
      pageSize,
    }).catch((e) => {
      console.error("Data fetch error:", e);
      return {
        items: [] as SatrRanking[],
        total: 0,
        totalPages: 0,
        lastUpdate: null,
      };
    }),
    getBladerAggregateStats("satr").catch(() => ({
      totalBladers: 0,
      totalMatches: 0,
    })),
    getSatrSeasonStats(season),
    // All rankings for analysis charts (saison courante uniquement)
    listSeasonRankingsAll("satr", season),
  ]);

  const lastUpdate = { updatedAt: rankingData.lastUpdate };
  const allRankings = allRankingsRaw as SatrRanking[];
  const totalPages = rankingData.totalPages;
  const s2Data =
    seasonStatsRes?.success && seasonStatsRes.data
      ? seasonStatsRes.data
      : { tournamentCount: 0, uniqueParticipants: 0, metas: [] };
  const allTournamentMetas = [...s2Data.metas];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% -20%, #1a0f00 0%, #050505 100%)",
        pt: { xs: 2, md: 4 },
        pb: 8,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <RankingModeSwitcher active="satr" />
        <SeasonTabs
          active={season}
          accent="var(--rpb-secondary)"
          seasons={[
            { value: 1, label: "Saison 1", sublabel: "BBT 1 → 11" },
            { value: 2, label: "Saison 2", sublabel: "BBT 12 → 22" },
          ]}
        />
        <Box
          sx={{
            mb: { xs: 4, md: 6 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: { xs: 2, md: 3 },
            px: { xs: 1, md: 0 },
          }}
        >
          {/* Left: Logo */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: { xs: "center", md: "flex-start" },
              width: "100%",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: 80, md: 100 },
                height: { xs: 40, md: 50 },
              }}
            >
              <Image
                src="/satr-logo.webp"
                alt="Sun After The Reign Logo"
                fill
                style={{ objectFit: "contain" }}
                priority
              />
            </Box>
          </Box>

          {/* Center: Search */}
          <Box
            sx={{
              flex: 2,
              width: "100%",
              maxWidth: { xs: "100%", md: 600 },
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

          {/* Right: placeholder for symmetry */}
          <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
        </Box>

        {/* Hall of Fame */}
        {champions.length > 0 && (
          <SatrHallOfFame champions={champions} tournamentMetas={allTournamentMetas} />
        )}

        <Box sx={{ position: "relative" }}>
          <SatrTabs
            mode={mode}
            totalBladers={globalStats.totalBladers}
            totalMatches={globalStats.totalMatches}
            tournamentCount={s2Data.tournamentCount}
            uniqueParticipants={s2Data.uniqueParticipants}
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
            {mode === "career" && (
              <SatrCharts
                bladers={rankingData.items as unknown as SatrBlader[]}
                allTournamentMetas={allTournamentMetas}
                rankings={allRankings}
              />
            )}

            {mode === "ranking" ? (
              <SatrTable
                rankings={rankingData.items as unknown as SatrRanking[]}
                totalPages={totalPages}
                currentPage={page}
                totalCount={rankingData.total}
              />
            ) : (
              <SatrBladersTable
                bladers={rankingData.items as unknown as SatrBlader[]}
                totalPages={totalPages}
                currentPage={page}
                totalCount={rankingData.total}
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
          SUN AFTER THE REIGN • BEYBLADE BATTLE TOURNAMENT
        </Typography>
      </Container>
    </Box>
  );
}
