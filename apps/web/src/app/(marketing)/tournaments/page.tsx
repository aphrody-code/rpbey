import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventIcon from "@mui/icons-material/Event";
import GroupsIcon from "@mui/icons-material/Groups";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TournamentCardGrid } from "@/components/cards/TournamentCard";
import { type TournamentStatus } from "@/components/ui/StatusChip";
import { loadJsonSafe } from "@/lib/data-cache";
import {
  listAllTournamentsForMarketing,
  getCompletedStardustTournamentForHome,
} from "@/server/dal/tournaments";
import { createPageMetadata } from "@/lib/seo-utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Tournois | RPB",
  description:
    "Découvrez les tournois Beyblade X organisés par la République Populaire du Beyblade. Inscrivez-vous et participez !",
  path: "/tournaments",
});

function mapDbStatus(status: string): TournamentStatus {
  const mapping: Record<string, TournamentStatus> = {
    UPCOMING: "upcoming",
    PENDING: "pending",
    ACTIVE: "underway",
    UNDERWAY: "underway",
    COMPLETE: "complete",
    ARCHIVED: "complete",
    CANCELLED: "cancelled",
  };
  return mapping[status] || "pending";
}

// ── Data ──

const BTS_EDITIONS = [
  {
    id: "bts5",
    file: "B_TS5.json",
    name: "Bey-Tamashii Séries #5",
    date: "2026-05-10",
    poster: "/tournaments/BTS5_poster.gif",
    fallbackCount: 60,
  },
  {
    id: "bts4",
    file: "B_TS4.json",
    name: "Bey-Tamashii Séries #4",
    date: "2026-04-26",
    poster: "/tournaments/BTS4_poster.webp",
    fallbackCount: 81,
  },
  {
    id: "bts3",
    file: "B_TS3.json",
    name: "Bey-Tamashii Séries #3",
    date: "2026-03-01",
    poster: "/tournaments/BTS3_poster.webp",
    fallbackCount: 73,
  },
  {
    id: "bts2",
    file: "B_TS2.json",
    name: "Bey-Tamashii Séries #2",
    date: "2026-02-08",
    poster: "/tournaments/BTS2.webp",
    fallbackCount: 60,
  },
  {
    id: "bts1",
    file: "B_TS1.json",
    name: "Bey-Tamashii Séries #1",
    date: "2026-01-11",
    poster: "/tournaments/BTS1_poster.webp",
    fallbackCount: 69,
  },
];

const PARTNER_SERIES = [
  {
    id: "satr",
    name: "Sun After The Reign",
    subtitle: "Beyblade Battle Tournament",
    href: "/tournaments/satr",
    logo: "/satr-logo.webp",
    logoWidth: 56,
    logoHeight: 28,
    logoRounded: false,
    color: "#fbbf24",
  },
  {
    id: "wb",
    name: "Wild Breakers",
    subtitle: "Ultime Bataille",
    href: "/tournaments/wb",
    logo: "/wb-logo.webp",
    logoWidth: 44,
    logoHeight: 44,
    logoRounded: true,
    color: "#f87171",
  },
] as const;

// ── Page ──

export default async function TournamentsPage() {
  interface BtsCard {
    id: string;
    name: string;
    date: string;
    poster: string;
    participants: number;
    matchesCount: number;
    podium: { name: string; rank: number; wins: number; losses: number }[];
  }
  type BtsExport = {
    participants?: {
      name: string;
      rank: number;
      exactWins?: number;
      exactLosses?: number;
    }[];
    participantsCount?: number;
    matchesCount?: number;
  };

  const [dbTournaments, btsExports, completedStardust] = await Promise.all([
    listAllTournamentsForMarketing(),
    Promise.all(
      BTS_EDITIONS.map(async (edition) => ({
        edition,
        data: await loadJsonSafe<BtsExport>(`data/exports/${edition.file}`),
      })),
    ),
    getCompletedStardustTournamentForHome(),
  ]);

  const btsCards: BtsCard[] = [];
  for (const { edition, data } of btsExports) {
    if (!data) continue;
    const participants = data.participants || [];
    const podium = participants
      .filter((p) => p.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
      .map((p) => ({
        name: p.name.replace(/✅|✔️/g, "").trim(),
        rank: p.rank,
        wins: p.exactWins || 0,
        losses: p.exactLosses || 0,
      }));

    btsCards.push({
      id: edition.id,
      name: edition.name,
      date: edition.date,
      poster: edition.poster,
      participants: data.participantsCount || edition.fallbackCount,
      matchesCount: data.matchesCount || 0,
      podium,
    });
  }

  // Find upcoming BTS tournament from DB to feature it in the BTS section
  const nextBts = dbTournaments.find(
    (t) =>
      t.name.toLowerCase().includes("bey-tamashii") &&
      (t.status === "UPCOMING" ||
        t.status === "REGISTRATION_OPEN" ||
        t.status === "CHECKIN" ||
        t.status === "UNDERWAY"),
  );

  const dbScrapedIds = new Set(BTS_EDITIONS.map((e) => e.id));
  const dbScrapedNames = new Set(BTS_EDITIONS.map((e) => e.name.toLowerCase()));
  // Les tournois Stardust sont montrés dans leur propre section — on les exclut du bucket générique.
  // Les BTS déjà exposés via JSON (BTS_EDITIONS) sont filtrés par nom pour éviter les doublons
  // quand un record DB partage le même titre avec un CUID Prisma au lieu du slug bts<N>.
  const dbCards = dbTournaments
    .filter(
      (t) =>
        !dbScrapedIds.has(t.id) &&
        !dbScrapedNames.has(t.name.toLowerCase()) &&
        t.id !== nextBts?.id &&
        !(t.category?.name ?? "").toUpperCase().includes("STARDUST"),
    )
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      startDate: new Date(t.date).toISOString(),
      status: mapDbStatus(t.status),
      currentParticipants: t._count.participants,
      maxParticipants: t.maxPlayers,
      categoryColor: t.category?.color ?? null,
      categoryLogo: t.category?.logoUrl ?? null,
      categoryName: t.category?.name ?? null,
    }));

  const upcoming = dbCards.filter(
    (t) =>
      t.status === "upcoming" ||
      t.status === "pending" ||
      t.status === "registration_open" ||
      t.status === "underway" ||
      t.status === "in_progress",
  );
  const completed = dbCards.filter((t) => t.status === "complete");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        pb: 8,
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: { xs: "40vh", md: "50vh" },
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(var(--rpb-primary-rgb), 0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: "relative", px: { xs: 2, sm: 3 } }}>
        {/* ═══ HERO ═══ */}
        <Box
          sx={{
            pt: { xs: 2, md: 6 },
            pb: { xs: 3, md: 5 },
            textAlign: "center",
          }}
        >
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 900,
              letterSpacing: "-0.03em",
              fontSize: { xs: "1.6rem", md: "2.5rem" },
              mb: 1,
            }}
          >
            Nos{" "}
            <Box
              component="span"
              sx={{
                background:
                  "linear-gradient(135deg, var(--rpb-primary) 0%, var(--rpb-secondary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Tournois
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              maxWidth: 520,
              mx: "auto",
              fontSize: { xs: "0.85rem", md: "0.95rem" },
              opacity: 0.6,
            }}
          >
            Compétitions officielles RPB et séries partenaires
          </Typography>
        </Box>

        {/* ═══════════════════════════════════════
            SECTION 1 — BEY-TAMASHII SÉRIES (NOS TOURNOIS)
            ═══════════════════════════════════════ */}
        {(btsCards.length > 0 || nextBts) && (
          <Box id="bey-tamashii-series" sx={{ mb: { xs: 6, md: 8 }, scrollMarginTop: 80 }}>
            <Heading
              title="Bey-Tamashii Séries"
              accent="OFFICIEL RPB"
              accentColor="var(--rpb-primary)"
              logo="/logo.webp"
            />

            <Grid container spacing={{ xs: 2, md: 3 }}>
              {/* ── Next BTS tournament (upcoming) ── */}
              {nextBts && (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ order: { xs: -1, md: 1 } }}>
                  <NextBtsTournamentCard tournament={nextBts} />
                </Grid>
              )}

              {btsCards.map((bts) => (
                <Grid key={bts.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Link
                    href={`/tournaments/${bts.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        borderRadius: 3,
                        overflow: "hidden",
                        bgcolor: "rgba(var(--rpb-primary-rgb), 0.03)",
                        border: "1px solid rgba(var(--rpb-primary-rgb), 0.1)",
                        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        "&:hover": {
                          borderColor: "rgba(var(--rpb-primary-rgb), 0.35)",
                          transform: "translateY(-3px)",
                          boxShadow: "0 12px 32px rgba(var(--rpb-primary-rgb), 0.15)",
                        },
                      }}
                    >
                      {/* Poster — uniform max height */}
                      <Box
                        sx={{
                          position: "relative",
                          overflow: "hidden",
                          maxHeight: { xs: 300, md: 400 },
                        }}
                      >
                        <Image
                          src={bts.poster}
                          alt={bts.name}
                          width={1040}
                          height={1467}
                          style={{
                            width: "100%",
                            height: "auto",
                            display: "block",
                          }}
                        />
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "40%",
                            background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                          }}
                        />
                      </Box>

                      {/* Info */}
                      <Box sx={{ p: 2 }}>
                        <Stack
                          direction="row"
                          sx={{
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: 1.5,
                          }}
                        >
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: "900",
                                fontSize: "0.85rem",
                                lineHeight: 1.3,
                              }}
                            >
                              {bts.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.7rem",
                              }}
                            >
                              {new Date(bts.date).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </Typography>
                          </Box>
                          <NavigateNextIcon
                            sx={{
                              color: "rgba(var(--rpb-primary-rgb), 0.3)",
                              fontSize: 20,
                            }}
                          />
                        </Stack>

                        {/* Stats chips */}
                        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                          <Chip
                            icon={<GroupsIcon sx={{ fontSize: 13 }} />}
                            label={`${bts.participants} joueurs`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              bgcolor: "rgba(var(--rpb-primary-rgb), 0.08)",
                              color: "text.secondary",
                            }}
                          />
                          {bts.matchesCount > 0 && (
                            <Chip
                              label={`${bts.matchesCount} matchs`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                bgcolor: "rgba(255,255,255,0.04)",
                                color: "text.secondary",
                              }}
                            />
                          )}
                        </Stack>

                        {/* Podium */}
                        {bts.podium.length > 0 && (
                          <Stack spacing={0.5}>
                            {bts.podium.map((p) => (
                              <Stack
                                key={p.rank}
                                direction="row"
                                spacing={1}
                                sx={{
                                  alignItems: "center",
                                  py: 0.4,
                                  px: 1,
                                  borderRadius: 1.5,

                                  bgcolor: p.rank === 1 ? "rgba(255,215,0,0.06)" : "transparent",
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: "0.75rem",
                                    width: 18,
                                    textAlign: "center",
                                  }}
                                >
                                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  noWrap
                                  sx={{
                                    fontWeight: p.rank === 1 ? 800 : 600,
                                    flex: 1,
                                    fontSize: "0.72rem",

                                    color: p.rank === 1 ? "#fbbf24" : "text.primary",
                                  }}
                                >
                                  {p.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: "0.6rem",
                                    color: "text.disabled",
                                  }}
                                >
                                  {p.wins}V-{p.losses}D
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Paper>
                  </Link>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* ═══════════════════════════════════════
            SECTION 1.5 — STARDUST SÉRIES (RPB Nord)
            ═══════════════════════════════════════ */}
        <StardustSeriesSection tournaments={dbTournaments} completedStardust={completedStardust} />

        {/* ═══════════════════════════════════════
            SECTION 2 — SÉRIES PARTENAIRES
            ═══════════════════════════════════════ */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Heading title="Séries Partenaires" />

          {/* Partner links */}
          <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ mb: 3 }}>
            {PARTNER_SERIES.map((series) => (
              <Grid key={series.id} size={{ xs: 12, sm: 6 }}>
                <Link href={series.href} style={{ textDecoration: "none", color: "inherit" }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      borderRadius: 3,
                      bgcolor: alpha(series.color, 0.03),
                      border: `1px solid ${alpha(series.color, 0.1)}`,
                      transition: "all 0.25s ease",
                      "&:hover": {
                        bgcolor: alpha(series.color, 0.07),
                        borderColor: alpha(series.color, 0.25),
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: series.logoWidth,
                        height: series.logoHeight,
                        flexShrink: 0,
                      }}
                    >
                      <Image
                        src={series.logo}
                        alt={series.name}
                        fill
                        style={{
                          objectFit: "contain",
                          borderRadius: series.logoRounded ? "50%" : 0,
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: "900",
                          color: series.color,
                          fontSize: { xs: "0.9rem", md: "0.95rem" },
                          lineHeight: 1.3,
                        }}
                      >
                        {series.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.68rem",
                        }}
                      >
                        {series.subtitle} · Classement & Historique
                      </Typography>
                    </Box>
                    <NavigateNextIcon sx={{ color: alpha(series.color, 0.3), fontSize: 22 }} />
                  </Paper>
                </Link>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* ═══════════════════════════════════════
            SECTION 3 — PROCHAINS TOURNOIS / HISTORIQUE
            ═══════════════════════════════════════ */}
        {upcoming.length > 0 && (
          <Box sx={{ mb: { xs: 5, md: 6 } }}>
            <Heading title="Prochains Tournois" accentColor="#60a5fa" />
            <TournamentCardGrid tournaments={upcoming} />
          </Box>
        )}

        {completed.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Heading title="Historique" />
            <TournamentCardGrid tournaments={completed} />
          </Box>
        )}

        {upcoming.length === 0 && completed.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              textAlign: "center",
              py: { xs: 4, md: 5 },
              px: 3,
              mb: 4,
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            <EventIcon sx={{ fontSize: 40, color: "rgba(255,255,255,0.15)", mb: 1 }} />
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
              }}
            >
              Aucun autre tournoi pour le moment
            </Typography>
          </Paper>
        )}

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
            textAlign: "center",
            mt: 6,
            opacity: 0.12,
            letterSpacing: 2,
            fontWeight: 900,
            fontSize: { xs: "0.55rem", md: "0.7rem" },
          }}
        >
          RÉPUBLIQUE POPULAIRE DU BEYBLADE · TOURNOIS OFFICIELS
        </Typography>
      </Container>
    </Box>
  );
}

// ── Stardust Series Section (RPB Nord) ──

interface CompletedStardustData {
  id: string;
  name: string;
  date: string;
  posterUrl: string | null;
  matchesCount: number;
  participants: {
    playerName: string | null;
    finalPlacement: number | null;
    wins: number | null;
    losses: number | null;
  }[];
}

type DbTournament = {
  id: string;
  challongeId: string | null;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  status: string;
  challongeUrl: string | null;
  posterUrl: string | null;
  maxPlayers: number;
  _count: { participants: number };
  category: {
    id: string;
    name: string;
    color: string | null;
    logoUrl: string | null;
  } | null;
};

function StardustSeriesSection({
  tournaments,
  completedStardust,
}: {
  tournaments: DbTournament[];
  completedStardust: CompletedStardustData | null;
}) {
  const stardustItems = tournaments.filter((t) =>
    (t.category?.name ?? "").toUpperCase().includes("STARDUST"),
  );
  if (stardustItems.length === 0) return null;

  const accent = stardustItems[0]?.category?.color ?? "#60A5FA";
  const logo = stardustItems[0]?.category?.logoUrl ?? "/stardust-logo.webp";
  const upcoming = stardustItems.find((t) =>
    ["UPCOMING", "REGISTRATION_OPEN", "CHECKIN", "UNDERWAY"].includes(t.status),
  );

  return (
    <Box id="stardust-series" sx={{ mb: { xs: 6, md: 8 }, scrollMarginTop: 80 }}>
      <Heading title="Stardust Séries" accent="RPB NORD" accentColor={accent} logo={logo} />
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {upcoming && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ order: { xs: -1, md: 1 } }}>
            <UpcomingSeriesCard tournament={upcoming} accent={accent} />
          </Grid>
        )}
        {stardustItems
          .filter((t) => t.id !== upcoming?.id)
          .map((t) => {
            const isStardust1 = t.challongeId === "T_SS1";
            const enriched =
              isStardust1 && completedStardust
                ? {
                    ...t,
                    participantsCount: completedStardust.participants?.length || 0,
                    matchesCount: completedStardust.matchesCount || 0,
                    podium: (completedStardust.participants || [])
                      .filter((p) => p.finalPlacement && p.finalPlacement <= 3)
                      .sort((a, b) => (a.finalPlacement || 0) - (b.finalPlacement || 0))
                      .map((p) => ({
                        name: (p.playerName || "").replace(/✅|✔️/g, "").trim(),
                        rank: p.finalPlacement || 0,
                        wins: p.wins || 0,
                        losses: p.losses || 0,
                      })),
                  }
                : t;
            return (
              <Grid key={t.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <CompletedSeriesCard tournament={enriched} accent={accent} />
              </Grid>
            );
          })}
      </Grid>
    </Box>
  );
}

// ── Upcoming tournament card for a RPB series ──

function UpcomingSeriesCard({ tournament, accent }: { tournament: DbTournament; accent: string }) {
  const formattedDate = new Date(tournament.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = new Date(tournament.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  const poster = tournament.posterUrl ?? "/logo.webp";
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
          bgcolor: alpha(accent, 0.03),
          border: `1px solid ${alpha(accent, 0.25)}`,
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "&:hover": {
            borderColor: alpha(accent, 0.5),
            transform: "translateY(-3px)",
            boxShadow: `0 12px 32px ${alpha(accent, 0.2)}`,
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            width: "100%",
            aspectRatio: "1040 / 1377",
          }}
        >
          <Image
            src={poster}
            alt={tournament.name}
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
            style={{ objectFit: "contain" }}
            priority
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(transparent 55%, rgba(0,0,0,0.8))",
              pointerEvents: "none",
            }}
          />
          <Chip
            label="À VENIR"
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              left: 12,
              fontWeight: 900,
              fontSize: "0.6rem",
              letterSpacing: 1,
              bgcolor: alpha(accent, 0.95),
              color: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              color: "white",
            }}
          >
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: { xs: "0.9rem", md: "1rem" },
                lineHeight: 1.2,
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {tournament.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                fontSize: "0.68rem",
                opacity: 0.9,
                textTransform: "capitalize",
              }}
            >
              {formattedDate} · {formattedTime}
            </Typography>
            {tournament.location && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: "0.68rem",
                  opacity: 0.75,
                  mt: 0.25,
                }}
                noWrap
              >
                {tournament.location}
              </Typography>
            )}
          </Box>
        </Box>
        <Box
          sx={{
            p: { xs: 1.5, md: 2 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip
              icon={<GroupsIcon sx={{ fontSize: 13 }} />}
              label={`${tournament._count.participants}/${tournament.maxPlayers}`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                fontWeight: 700,
                bgcolor: alpha(accent, 0.12),
                color: "text.secondary",
              }}
            />
            <Chip
              label="Pré-inscriptions"
              size="small"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                fontWeight: 700,
                bgcolor: "rgba(255,255,255,0.04)",
                color: "text.secondary",
              }}
            />
          </Stack>
          <NavigateNextIcon sx={{ color: alpha(accent, 0.5), fontSize: 20 }} />
        </Box>
      </Paper>
    </Link>
  );
}

// ── Completed / past tournament card for a RPB series ──

function CompletedSeriesCard({
  tournament,
  accent,
}: {
  tournament: DbTournament & {
    participantsCount?: number;
    matchesCount?: number;
    podium?: { name: string; rank: number; wins: number; losses: number }[];
  };
  accent: string;
}) {
  const poster =
    tournament.posterUrl ??
    (tournament.challongeId === "T_SS1" ? "/tournaments/SS1_poster.webp" : "/logo.webp");
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: alpha(accent, 0.02),
          border: `1px solid ${alpha(accent, 0.1)}`,
          transition: "all 0.25s ease",
          "&:hover": {
            borderColor: alpha(accent, 0.3),
            transform: "translateY(-2px)",
            boxShadow: `0 10px 24px ${alpha(accent, 0.12)}`,
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            width: "100%",
            aspectRatio: "1040 / 1377",
          }}
        >
          <Image
            src={poster}
            alt={tournament.name}
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
            style={{ objectFit: "contain" }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(transparent 55%, rgba(0,0,0,0.7))",
              pointerEvents: "none",
            }}
          />
        </Box>
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "0.85rem", md: "0.9rem" },
              lineHeight: 1.3,
              mb: 1,
            }}
            noWrap
          >
            {tournament.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontSize: "0.68rem", display: "block", mb: 1.2 }}
          >
            {new Date(tournament.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Typography>

          {/* Render Stats and Podium if available */}
          {tournament.participantsCount !== undefined && (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Chip
                  icon={<GroupsIcon sx={{ fontSize: 13 }} />}
                  label={`${tournament.participantsCount} joueurs`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    bgcolor: alpha(accent, 0.08),
                    color: "text.secondary",
                  }}
                />
                {tournament.matchesCount !== undefined && tournament.matchesCount > 0 && (
                  <Chip
                    label={`${tournament.matchesCount} matchs`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      bgcolor: "rgba(255,255,255,0.04)",
                      color: "text.secondary",
                    }}
                  />
                )}
              </Stack>

              {tournament.podium && tournament.podium.length > 0 && (
                <Stack spacing={0.5}>
                  {tournament.podium.map((p) => (
                    <Stack
                      key={p.rank}
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                        py: 0.4,
                        px: 1,
                        borderRadius: 1.5,
                        bgcolor: p.rank === 1 ? "rgba(255,215,0,0.06)" : "transparent",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          width: 18,
                          textAlign: "center",
                        }}
                      >
                        {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                      </Typography>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontWeight: p.rank === 1 ? 800 : 600,
                          flex: 1,
                          fontSize: "0.72rem",
                          color: p.rank === 1 ? "#fbbf24" : "text.primary",
                        }}
                      >
                        {p.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: "0.6rem",
                          color: "text.disabled",
                        }}
                      >
                        {p.wins}V-{p.losses}D
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Paper>
    </Link>
  );
}

// ── Next BTS Tournament Card (upcoming) ──

function NextBtsTournamentCard({
  tournament,
}: {
  tournament: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    description: string | null;
    status: string;
    posterUrl: string | null;
    challongeUrl: string | null;
    maxPlayers: number;
    _count: { participants: number };
  };
}) {
  const formattedDate = new Date(tournament.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = new Date(tournament.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  // Determine poster — prefer the row's own posterUrl (DB). The edition-derived
  // path mis-maps special editions (e.g. "Hors-Série #1" → BTS1's poster), so it
  // only serves as a fallback for legacy rows without a posterUrl.
  const edition = tournament.name.match(/#(\d+)/)?.[1];
  const poster =
    tournament.posterUrl ?? (edition ? `/tournaments/BTS${edition}_poster.webp` : "/logo.webp");

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
          bgcolor: "rgba(var(--rpb-primary-rgb), 0.03)",
          border: "1px solid rgba(var(--rpb-primary-rgb), 0.25)",
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "&:hover": {
            borderColor: "rgba(var(--rpb-primary-rgb), 0.5)",
            transform: "translateY(-3px)",
            boxShadow: "0 12px 32px rgba(var(--rpb-primary-rgb), 0.2)",
          },
        }}
      >
        {/* Poster */}
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            maxHeight: { xs: 300, md: 400 },
          }}
        >
          <Image
            src={poster}
            alt={tournament.name}
            width={1040}
            height={1467}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40%",
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
            }}
          />
          {/* UPCOMING badge */}
          <Chip
            label="À VENIR"
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              left: 12,
              fontWeight: 900,
              fontSize: "0.6rem",
              height: 22,
              bgcolor: "var(--rpb-primary)",
              color: "#fff",
              letterSpacing: 1,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          />
        </Box>

        {/* Info */}
        <Box sx={{ p: 2 }}>
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontWeight: "900",
                  fontSize: "0.85rem",
                  lineHeight: 1.3,
                }}
              >
                {tournament.name}
              </Typography>
            </Box>
            <NavigateNextIcon sx={{ color: "rgba(var(--rpb-primary-rgb), 0.3)", fontSize: 20 }} />
          </Stack>

          {/* Date & Location */}
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: "center",
              }}
            >
              <CalendarMonthIcon sx={{ fontSize: 13, color: "var(--rpb-primary)", opacity: 0.7 }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.68rem",
                }}
              >
                {formattedDate} à {formattedTime}
              </Typography>
            </Stack>
            {tournament.location && (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{
                  alignItems: "center",
                }}
              >
                <LocationOnIcon
                  sx={{
                    fontSize: 13,
                    color: "var(--rpb-primary)",
                    opacity: 0.7,
                  }}
                />
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    fontSize: "0.68rem",
                  }}
                >
                  {tournament.location.split(",")[0]}
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <GroupsIcon sx={{ fontSize: 13, color: "var(--rpb-primary)", opacity: 0.7 }} />
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontWeight: 700,
                  fontSize: "0.68rem",
                }}
              >
                {tournament._count.participants}
                {tournament.maxPlayers > 0 ? `/${tournament.maxPlayers}` : ""} inscrits
              </Typography>
            </Stack>
          </Stack>

          {/* CTA */}
          {tournament.challongeUrl && (
            <Box
              sx={{
                py: 1,
                px: 2,
                borderRadius: 2,
                bgcolor: "rgba(var(--rpb-primary-rgb), 0.1)",
                border: "1px solid rgba(var(--rpb-primary-rgb), 0.2)",
                textAlign: "center",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 900,
                  color: "var(--rpb-primary)",
                  fontSize: "0.68rem",
                  letterSpacing: 0.5,
                }}
              >
                S&apos;INSCRIRE
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Link>
  );
}

// ── Section heading ──

function Heading({
  title,
  accent,
  accentColor,
  logo,
}: {
  title: string;
  accent?: string;
  accentColor?: string;
  logo?: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        mb: 2.5,
      }}
    >
      <Box
        sx={{
          width: 3,
          height: 24,
          borderRadius: 2,
          bgcolor: accentColor || "rgba(255,255,255,0.2)",
          flexShrink: 0,
        }}
      />
      {logo && <Image src={logo} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />}
      <Typography
        variant="h6"
        sx={{
          fontWeight: "900",
          fontSize: { xs: "0.95rem", md: "1.05rem" },
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Typography>
      {accent && accentColor && (
        <Chip
          label={accent}
          size="small"
          sx={{
            fontWeight: 900,
            fontSize: "0.55rem",
            height: 20,
            bgcolor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
            color: accentColor,
            border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
          }}
        />
      )}
    </Stack>
  );
}
