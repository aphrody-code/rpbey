import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Box, Container, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { type SvgIconProps } from "@mui/material/SvgIcon";
import Image from "next/image";
import { Suspense } from "react";
import RankingSearch from "@/components/rankings/RankingSearch";
import { WbBladersTable } from "@/components/rankings/WbBladersTable";
import { WbCharts } from "@/components/rankings/WbCharts";
import { WbHallOfFame } from "@/components/rankings/WbHallOfFame";
import { WbTable } from "@/components/rankings/WbTable";
import { RankingModeSwitcher } from "@/components/rankings/RankingModeSwitcher";
import { SeasonTabs } from "@/components/rankings/SeasonTabs";
import { WbTabs } from "@/components/rankings/WbTabs";
import { type WbBlader, type WbRanking } from "@/lib/types";
import { db, schema, and, asc, count, desc, eq, ilike, sum } from "@/lib/db";
import { getWbSeasonStats } from "@/server/actions/wb";

const DiscordIcon = (props: SvgIconProps) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.07 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const ChallongeIcon = (props: SvgIconProps) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...props}>
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ultim Bataille | Wild Breakers",
  description: "Le classement officiel des Ultim Batailles de Wild Breakers.",
};

interface WbPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface Champion {
  tournament: string;
  winner: string;
  date: string;
}

/**
 * Return the WB season a UB/HS tournament belongs to. UB splits on #12
 * (S1: #1→#11, S2: #12→#22). "Hors Série" events inherit the season of
 * their sibling UBs — we bucket unknown slugs ("wb_hs_*") into the
 * currently active season (S2 as of 2026-04).
 */
function wbSeasonForTournament(tournament: string): number | null {
  const m = /ub(\d+)/i.exec(tournament);
  if (m?.[1]) {
    const n = Number.parseInt(m[1], 10);
    if (!Number.isFinite(n)) return null;
    if (n <= 11) return 1;
    if (n <= 22) return 2;
    return null;
  }
  // HS events — attach them to the active season by default.
  return 2;
}

async function getChampions(season: number): Promise<Champion[]> {
  try {
    const path = join(process.cwd(), "data", "wb_champions.json");
    const content = await readFile(path, "utf-8");
    const all = JSON.parse(content) as Champion[];
    return all.filter((c) => wbSeasonForTournament(c.tournament) === season);
  } catch {
    return [];
  }
}

export default async function WbPage({ searchParams }: WbPageProps) {
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

  const [champions, rankingData, globalStats, lastUpdate, seasonStatsRes] = await Promise.all([
    getChampions(season),
    (async () => {
      try {
        if (mode === "ranking") {
          const whereCondition = and(
            eq(schema.wbRankings.season, season),
            ...(searchQuery ? [ilike(schema.wbRankings.playerName, `%${searchQuery}%`)] : []),
          );
          const [rankings, countRows] = await Promise.all([
            db.query.wbRankings.findMany({
              where: whereCondition,
              orderBy: asc(schema.wbRankings.rank),
              limit: pageSize,
              offset: (page - 1) * pageSize,
            }),
            db.select({ value: count() }).from(schema.wbRankings).where(whereCondition),
          ]);
          return { items: rankings, total: countRows[0]?.value ?? 0 };
        } else {
          const whereCondition = searchQuery
            ? ilike(schema.wbBladers.name, `%${searchQuery}%`)
            : undefined;
          const [bladers, countRows] = await Promise.all([
            db.query.wbBladers.findMany({
              where: whereCondition,
              orderBy: [desc(schema.wbBladers.tournamentWins), desc(schema.wbBladers.totalWins)],
              limit: pageSize,
              offset: (page - 1) * pageSize,
            }),
            db.select({ value: count() }).from(schema.wbBladers).where(whereCondition),
          ]);
          return { items: bladers, total: countRows[0]?.value ?? 0 };
        }
      } catch (e) {
        console.error("Data fetch error:", e);
        return { items: [], total: 0 };
      }
    })(),
    (async () => {
      try {
        const [stats] = await db
          .select({
            totalWins: sum(schema.wbBladers.totalWins),
            totalLosses: sum(schema.wbBladers.totalLosses),
            count: count(),
          })
          .from(schema.wbBladers);
        return {
          totalBladers: stats?.count ?? 0,
          totalMatches: Math.floor(
            ((Number(stats?.totalWins) || 0) + (Number(stats?.totalLosses) || 0)) / 2,
          ),
        };
      } catch {
        return { totalBladers: 0, totalMatches: 0 };
      }
    })(),
    db.query.wbRankings.findFirst({
      orderBy: desc(schema.wbRankings.updatedAt),
      columns: { updatedAt: true },
    }),
    // Stats adaptées à la saison demandée (count tournois, participants uniques…)
    getWbSeasonStats(season),
  ]);

  const totalPages = Math.ceil(rankingData.total / pageSize);
  const s1Data =
    seasonStatsRes?.success && seasonStatsRes.data
      ? seasonStatsRes.data
      : { tournamentCount: 0, uniqueParticipants: 0, metas: [] };
  const allTournamentMetas = [...s1Data.metas];

  const socials = [
    {
      name: "Challonge",
      url: "https://challonge.com/fr/users/wild_breakers/tournaments",
      icon: ChallongeIcon,
      color: "#ff7324",
    },
    {
      name: "Discord",
      url: "https://discord.gg/wildbreakers",
      icon: DiscordIcon,
      color: "#5865F2",
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0d0618 30%, #080410 60%, #050308 100%)",
        pt: { xs: 2, md: 4 },
        pb: 8,
        position: "relative",
        "&::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(120,60,200,0.015) 20px, rgba(120,60,200,0.015) 21px)",
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <RankingModeSwitcher active="wb" />
        <SeasonTabs
          active={season}
          accent="#a78bfa"
          seasons={[
            { value: 1, label: "Saison 1", sublabel: "UB 1 → UB 11" },
            { value: 2, label: "Saison 2", sublabel: "UB 12-14 + HS" },
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
                width: { xs: 60, md: 80 },
                height: { xs: 60, md: 80 },
              }}
            >
              <Image
                src="/wb-logo.webp"
                alt="Wild Breakers Logo"
                fill
                style={{ objectFit: "contain", borderRadius: "50%" }}
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

          {/* Right: Socials */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: { xs: "center", md: "flex-end" },
              width: "100%",
              order: { xs: 2, md: 3 },
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
                        boxShadow: `0 5px 15px ${s.color}33`,
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

        {/* Hall of Fame */}
        {champions.length > 0 && (
          <WbHallOfFame champions={champions} tournamentMetas={allTournamentMetas} />
        )}

        <Box sx={{ position: "relative" }}>
          <WbTabs
            mode={mode}
            totalBladers={globalStats.totalBladers}
            totalMatches={globalStats.totalMatches}
            tournamentCount={s1Data.tournamentCount}
            uniqueParticipants={s1Data.uniqueParticipants}
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
              <WbCharts
                bladers={rankingData.items as WbBlader[]}
                allTournamentMetas={allTournamentMetas}
              />
            )}

            {mode === "ranking" ? (
              <WbTable
                rankings={rankingData.items as WbRanking[]}
                totalPages={totalPages}
                currentPage={page}
                totalCount={rankingData.total}
              />
            ) : (
              <WbBladersTable
                bladers={rankingData.items as WbBlader[]}
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
          WILD BREAKERS • ULTIM BATAILLE
        </Typography>
      </Container>
    </Box>
  );
}
