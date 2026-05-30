import { Download } from "@mui/icons-material";
import InstagramIcon from "@mui/icons-material/Instagram";
import YouTubeIcon from "@mui/icons-material/YouTube";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Suspense } from "react";

import { BtsHallOfFame } from "@/components/rankings/BtsHallOfFame";
import { BtsTournamentsSection } from "@/components/rankings/BtsTournamentsSection";
import { RankingModeSwitcher } from "@/components/rankings/RankingModeSwitcher";
import RankingSearch from "@/components/rankings/RankingSearch";
import { type ProfileWithUser, RankingsTable } from "@/components/rankings/RankingsTable";
import { SeasonTabs } from "@/components/rankings/SeasonTabs";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  MuiDiscordIcon as DiscordIcon,
  MuiTikTokIcon as TikTokIcon,
  MuiTwitchIcon as TwitchIcon,
  MuiXIcon as XIcon,
} from "@/components/ui/MuiIcons";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import {
  createPageMetadata,
  generateBreadcrumbJsonLd,
  generateItemListJsonLd,
} from "@/lib/seo-utils";
import {
  type BtsSeason,
  getBtsRanking,
  getBtsSeasonMeta,
  getBtsSeasonTournaments,
} from "@/server/actions/bts";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Classements BTS | RPB",
  description:
    "Classement officiel des BTS (Beyblade Tournament Series). Saison 1 (BTS 1) et Saison 2 (BTS 2 à 5).",
  path: "/rankings",
  image: `/banner.webp?v=${Date.now()}`,
});

interface RankingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number(resolvedSearchParams.page) || 1);
  const pageSize = 100;
  const searchQuery =
    typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : "";
  const seasonParam = Number(resolvedSearchParams.season);
  const season: BtsSeason = seasonParam === 1 ? 1 : 2;

  let btsData: Awaited<ReturnType<typeof getBtsRanking>> | null = null;
  try {
    btsData = await getBtsRanking(season, {
      search: searchQuery,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("RankingsPage Error:", error);
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error">
          Une erreur est survenue lors du chargement des classements. Veuillez réessayer plus tard.
        </Alert>
      </Container>
    );
  }

  const profiles: ProfileWithUser[] = btsData.entries.map((e) => ({
    id: `bts-${e.rank}-${e.playerName}`,
    userId: null,
    rankingPoints: e.points,
    wins: e.wins,
    losses: e.losses,
    tournamentWins: e.tournamentWins,
    bladerName: e.playerName,
    challongeUsername: null,
    favoriteType: null,
    user: {
      name: e.playerName,
      image: e.avatarUrl,
      _count: { tournaments: e.participations },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    experience: "BEGINNER",
  })) as unknown as ProfileWithUser[];

  const totalPages = Math.ceil(btsData.total / pageSize);

  const [s1Meta, s2Meta, seasonTournaments] = await Promise.all([
    getBtsSeasonMeta(1),
    getBtsSeasonMeta(2),
    getBtsSeasonTournaments(season),
  ]);

  const socials = [
    {
      name: "TikTok",
      url: "https://www.tiktok.com/@rpb_bey",
      icon: TikTokIcon,
      color: "#ff0050",
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/rpb_bey",
      icon: InstagramIcon,
      color: "#E1306C",
    },
    {
      name: "X / Twitter",
      url: "https://twitter.com/RPBey_fr",
      icon: XIcon,
      color: "#fff",
    },
    {
      name: "Twitch",
      url: "https://www.twitch.tv/tv_rpb",
      icon: TwitchIcon,
      color: "#9146FF",
    },
    {
      name: "Discord",
      url: "https://discord.gg/rpb",
      icon: DiscordIcon,
      color: "#5865F2",
    },
    {
      name: "YouTube",
      url: "https://www.youtube.com/@RPB-Beyblade",
      icon: YouTubeIcon,
      color: "#FF0000",
    },
  ];

  return (
    <Box
      className="bbx-scanlines"
      sx={{
        minHeight: "100vh",
        position: "relative",
        bgcolor: "background.default",
        pt: { xs: 1, sm: 2, md: 4 },
        pb: { xs: 12, sm: 8 },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: { xs: "40vh", md: "50vh" },
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--rpb-primary-rgb), 0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: "relative", px: { xs: 1.5, sm: 2, md: 3 } }}>
        <JsonLd
          data={generateBreadcrumbJsonLd([
            { name: "Accueil", item: "/" },
            { name: "Classements", item: "/rankings" },
          ])}
        />
        {profiles.length >= 3 && (
          <JsonLd
            data={generateItemListJsonLd(
              profiles.slice(0, 10).map((p, i) => ({
                name: p.bladerName || "Anonyme",
                url: p.userId ? `/profile/${p.userId}` : "/rankings",
                position: i + 1,
                image: p.user?.image ?? undefined,
              })),
            )}
          />
        )}
        {/* Visually hidden heading for screen readers */}
        <Typography
          component="h1"
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            borderWidth: 0,
          }}
        >
          Classement officiel BTS · RPB
        </Typography>

        {/* Mode switcher (Global / WB / SATR / Stardust) */}
        <RankingModeSwitcher active="global" />

        {/* Season tabs — matches SATR/WB pattern */}
        <SeasonTabs
          active={season}
          accent="var(--rpb-primary)"
          seasons={[
            { value: 1, label: s1Meta.label, sublabel: s1Meta.sublabel },
            { value: 2, label: s2Meta.label, sublabel: s2Meta.sublabel },
          ]}
        />

        {/* Header: Search + Socials */}
        <Box
          sx={{
            mb: { xs: 3, md: 5 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "center" },
            gap: { xs: 1.5, md: 3 },
          }}
        >
          <Box sx={{ flex: 1, maxWidth: { md: 500 } }}>
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

          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              justifyContent: { xs: "center", md: "flex-end" },
              flexShrink: 0,
            }}
          >
            {socials.map((s) => (
              <Tooltip key={s.name} title={s.name}>
                <IconButton
                  component="a"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Suivre RPB sur ${s.name}`}
                  size="small"
                  sx={{
                    color: "rgba(255,255,255,0.4)",
                    bgcolor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    width: { xs: 36, md: 40 },
                    height: { xs: 36, md: 40 },
                    "&:hover": {
                      color: s.color,
                      bgcolor: "rgba(255,255,255,0.08)",
                      transform: "translateY(-2px)",
                      boxShadow: `0 4px 12px ${alpha(s.color, 0.2)}`,
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: s.color,
                      outlineOffset: 2,
                    },
                    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  <s.icon sx={{ fontSize: { xs: 16, md: 20 } }} />
                </IconButton>
              </Tooltip>
            ))}
            <Tooltip title="Télécharger le classement en image">
              <IconButton
                component="a"
                href="/api/leaderboard/card"
                download="classement-rpb.png"
                aria-label="Télécharger le classement en image"
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.4)",
                  bgcolor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  width: { xs: 36, md: 40 },
                  height: { xs: 36, md: 40 },
                  "&:hover": {
                    color: "var(--rpb-secondary)",
                    bgcolor: "rgba(255,255,255,0.08)",
                  },
                }}
              >
                <Download sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Hall of Fame — champions BTS for the selected season */}
        <BtsHallOfFame champions={btsData.champions} accent="var(--rpb-primary)" />

        {/* Rankings table */}
        <Box sx={{ position: "relative" }}>
          <Suspense
            fallback={
              <Box
                sx={{
                  height: 400,
                  width: "100%",
                  bgcolor: "action.hover",
                  borderRadius: 4,
                }}
              />
            }
          >
            <RankingsTable
              profiles={profiles}
              totalPages={totalPages}
              currentPage={page}
              totalCount={btsData.total}
            />
          </Suspense>
        </Box>

        {/* Tournois de la saison — bracket DB + pools (si applicable) */}
        <BtsTournamentsSection tournaments={seasonTournaments} />

        {/* Discord CTA */}
        <Paper
          component="a"
          href="https://discord.gg/rpb"
          target="_blank"
          rel="noopener noreferrer"
          elevation={0}
          sx={{
            mt: { xs: 3, md: 5 },
            p: { xs: 2, md: 3 },
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.5, md: 2.5 },
            bgcolor: alpha("#5865F2", 0.08),
            border: "1px solid",
            borderColor: alpha("#5865F2", 0.2),
            textDecoration: "none",
            color: "text.primary",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: alpha("#5865F2", 0.12),
              borderColor: alpha("#5865F2", 0.4),
            },
          }}
        >
          <Box
            sx={{
              width: { xs: 40, md: 52 },
              height: { xs: 40, md: 52 },
              bgcolor: "#5865F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <DiscordIcon sx={{ fontSize: { xs: 22, md: 28 }, color: "white" }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: "0.85rem", md: "1rem" },
              }}
            >
              Tu veux monter dans le classement ?
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: { xs: "0.72rem", md: "0.82rem" },
              }}
            >
              Rejoins le Discord RPB pour participer aux tournois officiels et gagner des points.
            </Typography>
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              color: "#5865F2",
              fontSize: { xs: "0.75rem", md: "0.9rem" },
              whiteSpace: "nowrap",
              display: { xs: "none", sm: "block" },
            }}
          >
            Rejoindre →
          </Typography>
        </Paper>

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
            textAlign: "center",
            mt: { xs: 4, md: 6 },
            opacity: 0.15,
            letterSpacing: 2,
            fontWeight: 900,
            fontSize: { xs: "0.55rem", md: "0.7rem" },
          }}
        >
          RÉPUBLIQUE POPULAIRE DU BEYBLADE · CLASSEMENT OFFICIEL BTS
        </Typography>
      </Container>
      <ScrollToTop />
    </Box>
  );
}
