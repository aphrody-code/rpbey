import "server-only";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  schema,
  type SQL,
} from "@/lib/db";
import { DiscordRoleMapping, type RoleType } from "@/lib/role-colors";
import { type TeamGroup } from "@/lib/discord-types";
import { type BotMember } from "@/types";
import { loadJsonSafe } from "@/lib/data-cache";

/**
 * Data Access Layer — tournois (tournaments / participants / matches / pools / live)
 * + équipe staff Discord (jointure DB du helper `lib/discord-data`).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Invariant timestamp : toutes les colonnes de ce domaine sont `mode:"string"`
 * (PgTimestampString) → on écrit des strings ISO (`new Date().toISOString()`) et
 * on lit des strings ISO. Aucune colonne auth ici.
 *
 * Note Drizzle : les sous-requêtes relationnelles (`with`) doivent être des
 * littéraux inline — extraire vers un `const … as const` casse l'inférence du
 * relational query builder (orderBy en readonly tuple rejeté). On les répète donc.
 */

type TournamentStatusVal = (typeof schema.tournamentStatus.enumValues)[number];

// ── Remap helpers (relations Drizzle → forme Prisma-style des call-sites legacy) ──

function remapProfileUser<P, T extends { profiles?: P[] }>(u: T | null | undefined) {
  if (!u) return null;
  const { profiles, ...rest } = u;
  return { ...rest, profile: profiles?.[0] ?? null };
}

type DeckItemRel = {
  beyblade?: unknown;
  part_bladeId?: unknown;
  part_ratchetId?: unknown;
  part_bitId?: unknown;
};

function remapDeckUser<
  P,
  D extends { deckItems?: DeckItemRel[] },
  T extends { profiles?: P[]; decks?: D[] },
>(u: T | null | undefined) {
  if (!u) return null;
  const { profiles, decks, ...rest } = u;
  return {
    ...rest,
    profile: profiles?.[0] ?? null,
    decks: (decks ?? []).map((d) => {
      const { deckItems, ...drest } = d;
      return {
        ...drest,
        items: (deckItems ?? []).map((it) => ({
          ...it,
          bey: it.beyblade ?? null,
          blade: it.part_bladeId ?? null,
          ratchet: it.part_ratchetId ?? null,
          bit: it.part_bitId ?? null,
        })),
      };
    }),
  };
}

/**
 * Réduit un user à la forme contrat `TournamentPlayer`. Tolère un user brut
 * (relation `profiles[]`) comme un user déjà remappé (`profile` singulier).
 */
function toPlayer(
  u:
    | ({
        id: string;
        name?: string | null;
        image?: string | null;
        profile?: { bladerName?: string | null } | null;
        profiles?: Array<{ bladerName?: string | null }>;
      } & Record<string, unknown>)
    | null,
) {
  if (!u) return null;
  const profile = u.profile ?? u.profiles?.[0] ?? null;
  return {
    id: u.id,
    name: u.name ?? null,
    bladerName: profile?.bladerName ?? null,
    imageUrl: u.image ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listes / cartes publiques
// ─────────────────────────────────────────────────────────────────────────────

export interface TournamentsFilter {
  status?: TournamentStatusVal;
  limit?: number;
  offset?: number;
}

/** Liste paginée + compteurs (route `/api/v1/tournaments` + `/api/tournaments` legacy). */
export async function listTournamentCards(params: TournamentsFilter) {
  const { status, limit = 50, offset = 0 } = params;
  const where = status ? eq(schema.tournaments.status, status) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.tournaments.findMany({
      where,
      with: {
        tournamentParticipants: { columns: { id: true } },
        tournamentMatches: { columns: { id: true } },
        tournamentCategory: {
          columns: { id: true, name: true, color: true, logoUrl: true },
        },
      },
      orderBy: desc(schema.tournaments.date),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(schema.tournaments).where(where),
  ]);

  const items = rows.map((t) => {
    const { tournamentParticipants, tournamentMatches, tournamentCategory, ...rest } = t;
    return {
      ...rest,
      category: tournamentCategory ?? null,
      participantsCount: tournamentParticipants.length,
      matchesCount: tournamentMatches.length,
    };
  });

  return { items, total: totalRows[0]?.value ?? 0, limit, offset };
}

/** Liste complète (page marketing `/tournaments`) — toutes les colonnes + catégorie + compteur. */
export async function listAllTournamentsForMarketing() {
  const rows = await db.query.tournaments.findMany({
    orderBy: desc(schema.tournaments.date),
    with: {
      tournamentParticipants: { columns: { id: true } },
      tournamentCategory: {
        columns: { id: true, name: true, color: true, logoUrl: true },
      },
    },
  });
  return rows.map((t) => {
    const { tournamentParticipants, tournamentCategory, ...rest } = t;
    return {
      ...rest,
      category: tournamentCategory ?? null,
      _count: { participants: tournamentParticipants.length },
    };
  });
}

export async function getCompletedStardustTournamentForHome() {
  const row = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.challongeId, "T_SS1"),
    with: {
      tournamentParticipants: {
        orderBy: asc(schema.tournamentParticipants.finalPlacement),
      },
    },
  });
  if (!row) return null;

  const matchesCount = await db
    .select({ value: count() })
    .from(schema.tournamentMatches)
    .where(eq(schema.tournamentMatches.tournamentId, row.id));

  return {
    ...row,
    participants: row.tournamentParticipants,
    matchesCount: matchesCount[0]?.value ?? 0,
  };
}

const BTS_EDITIONS_FOR_HOME = [
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

function mapDbStatusForHome(status: string): string {
  const mapping: Record<string, string> = {
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

export async function getAllTournamentsForHome() {
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
    db.query.tournaments.findMany({
      orderBy: desc(schema.tournaments.date),
      with: {
        tournamentParticipants: {
          orderBy: asc(schema.tournamentParticipants.finalPlacement),
        },
        tournamentMatches: {
          columns: { id: true },
        },
        tournamentCategory: {
          columns: { id: true, name: true, color: true, logoUrl: true },
        },
      },
    }),
    Promise.all(
      BTS_EDITIONS_FOR_HOME.map(async (edition) => ({
        edition,
        data: await loadJsonSafe<BtsExport>(`data/exports/${edition.file}`),
      })),
    ),
    getCompletedStardustTournamentForHome(),
  ]);

  // 1. Process BTS JSON Tournaments
  const btsCards: any[] = [];
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
      date: new Date(edition.date).toISOString(),
      poster: edition.poster,
      participants: data.participantsCount || edition.fallbackCount,
      matchesCount: data.matchesCount || 0,
      podium,
      status: "complete",
    });
  }

  // Find upcoming BTS tournament from DB
  const nextBts = dbTournaments.find(
    (t) =>
      t.name.toLowerCase().includes("bey-tamashii") &&
      (t.status === "UPCOMING" ||
        t.status === "REGISTRATION_OPEN" ||
        t.status === "CHECKIN" ||
        t.status === "UNDERWAY"),
  );

  const nextBtsItem = nextBts
    ? {
        id: nextBts.id,
        name: nextBts.name,
        date: new Date(nextBts.date).toISOString(),
        poster: nextBts.posterUrl || "/logo.webp",
        participants: nextBts.tournamentParticipants.length,
        matchesCount: nextBts.tournamentMatches.length,
        podium: [],
        status: mapDbStatusForHome(nextBts.status),
      }
    : null;

  // 2. Process Stardust Tournaments
  const stardustItems = dbTournaments.filter((t) =>
    (t.tournamentCategory?.name ?? "").toUpperCase().includes("STARDUST"),
  );

  const mappedStardust = stardustItems
    .filter((t) => mapDbStatusForHome(t.status) !== "cancelled")
    .map((t) => {
      const isStardust1 = t.challongeId === "T_SS1";
      if (isStardust1 && completedStardust) {
        const podium = (completedStardust.participants || [])
          .filter((p) => p.finalPlacement && p.finalPlacement <= 3)
          .sort((a, b) => (a.finalPlacement || 0) - (b.finalPlacement || 0))
          .map((p) => ({
            name: (p.playerName || "").replace(/✅|✔️/g, "").trim(),
            rank: p.finalPlacement || 0,
            wins: p.wins || 0,
            losses: p.losses || 0,
          }));
        return {
          id: t.id,
          name: t.name,
          date: new Date(t.date).toISOString(),
          poster: t.posterUrl || "/tournaments/SS1_poster.webp",
          participants: completedStardust.participants?.length || 0,
          matchesCount: completedStardust.matchesCount || 0,
          podium,
          status: mapDbStatusForHome(t.status),
        };
      } else {
        const podium = t.tournamentParticipants
          .filter((p) => p.finalPlacement && p.finalPlacement <= 3)
          .sort((a, b) => (a.finalPlacement || 0) - (b.finalPlacement || 0))
          .map((p) => ({
            name: (p.playerName || "").replace(/✅|✔️/g, "").trim(),
            rank: p.finalPlacement || 0,
            wins: p.wins || 0,
            losses: p.losses || 0,
          }));
        return {
          id: t.id,
          name: t.name,
          date: new Date(t.date).toISOString(),
          poster: t.posterUrl || "/logo.webp",
          participants: t.tournamentParticipants.length,
          matchesCount: t.tournamentMatches.length,
          podium,
          status: mapDbStatusForHome(t.status),
        };
      }
    });

  // 3. Process Generic DB Tournaments
  const dbScrapedIds = new Set(BTS_EDITIONS_FOR_HOME.map((e) => e.id));
  const dbScrapedNames = new Set(BTS_EDITIONS_FOR_HOME.map((e) => e.name.toLowerCase()));

  const otherDbItems = dbTournaments
    .filter((t) => {
      const idStr = String(t.id);
      if (dbScrapedIds.has(idStr) || dbScrapedNames.has(t.name.toLowerCase())) return false;
      if (nextBts && t.id === nextBts.id) return false;
      if ((t.tournamentCategory?.name ?? "").toUpperCase().includes("STARDUST")) return false;
      const status = mapDbStatusForHome(t.status);
      return status !== "cancelled";
    })
    .map((t) => {
      const podium = t.tournamentParticipants
        .filter((p) => p.finalPlacement && p.finalPlacement <= 3)
        .sort((a, b) => (a.finalPlacement || 0) - (b.finalPlacement || 0))
        .map((p) => ({
          name: (p.playerName || "").replace(/✅|✔️/g, "").trim(),
          rank: p.finalPlacement || 0,
          wins: p.wins || 0,
          losses: p.losses || 0,
        }));
      return {
        id: t.id,
        name: t.name,
        date: new Date(t.date).toISOString(),
        poster: t.posterUrl || "/logo.webp",
        participants: t.tournamentParticipants.length,
        matchesCount: t.tournamentMatches.length,
        podium,
        status: mapDbStatusForHome(t.status),
      };
    });

  // 4. Merge & Sort (Newest to Oldest)
  const merged: any[] = [];
  if (nextBtsItem) {
    merged.push(nextBtsItem);
  }
  merged.push(...btsCards);
  merged.push(...mappedStardust);
  merged.push(...otherDbItems);

  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Détail tournoi
// ─────────────────────────────────────────────────────────────────────────────

/** Détail brut (relations Drizzle remappées Prisma-style) — route `/api/tournaments/[id]` legacy. */
export async function getTournamentFull(idOrSlug: string) {
  let row = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, idOrSlug),
    with: {
      tournamentParticipants: {
        with: { user: { with: { profiles: true } } },
        orderBy: asc(schema.tournamentParticipants.seed),
      },
      tournamentMatches: {
        with: {
          user_player1Id: { with: { profiles: true } },
          user_player2Id: { with: { profiles: true } },
          user_winnerId: { with: { profiles: true } },
        },
        orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
      },
    },
  });

  if (!row) {
    row = await db.query.tournaments.findFirst({
      where: or(
        eq(schema.tournaments.challongeId, idOrSlug),
        ilike(schema.tournaments.challongeUrl, `%${idOrSlug}%`),
      ),
      with: {
        tournamentParticipants: {
          with: { user: { with: { profiles: true } } },
          orderBy: asc(schema.tournamentParticipants.seed),
        },
        tournamentMatches: {
          with: {
            user_player1Id: { with: { profiles: true } },
            user_player2Id: { with: { profiles: true } },
            user_winnerId: { with: { profiles: true } },
          },
          orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
        },
      },
    });
  }

  if (!row) return null;
  const { tournamentParticipants, tournamentMatches, ...rest } = row;
  return {
    ...rest,
    participants: tournamentParticipants.map((p) => ({
      ...p,
      user: remapProfileUser(p.user),
    })),
    matches: tournamentMatches.map((m) => ({
      ...m,
      player1: m.user_player1Id ?? null,
      player2: m.user_player2Id ?? null,
      winner: m.user_winnerId ?? null,
    })),
  };
}

/** Détail normalisé contrat (`/api/v1/tournaments/[id]`) — résolu par id, challongeId ou slug. */
export async function getTournamentDetail(idOrSlug: string) {
  const row = await getTournamentFull(idOrSlug);
  if (!row) {
    return { tournament: null, participants: [], matches: [] };
  }
  const { participants, matches, ...tournament } = row;
  return {
    tournament,
    participants: participants.map((p) => ({
      id: p.id,
      tournamentId: p.tournamentId,
      userId: p.userId ?? null,
      playerName: p.playerName ?? null,
      seed: p.seed ?? null,
      finalPlacement: p.finalPlacement ?? null,
      challongeParticipantId: p.challongeParticipantId ?? null,
      player: toPlayer(p.user),
    })),
    matches: matches.map((m) => ({
      id: m.id,
      tournamentId: m.tournamentId,
      challongeMatchId: m.challongeMatchId ?? null,
      round: m.round,
      state: m.state ?? null,
      score: m.score ?? null,
      player1Id: m.player1Id ?? null,
      player2Id: m.player2Id ?? null,
      winnerId: m.winnerId ?? null,
      player1: toPlayer(m.player1),
      player2: toPlayer(m.player2),
      winner: toPlayer(m.winner),
    })),
  };
}

/** Colonnes + catégorie (page détail marketing `_lib/getTournament`). */
const detailColumns = {
  id: true,
  name: true,
  status: true,
  description: true,
  date: true,
  location: true,
  format: true,
  maxPlayers: true,
  challongeId: true,
  challongeUrl: true,
  posterUrl: true,
  standings: true,
  stations: true,
  activityLog: true,
  updatedAt: true,
} as const;

export type MarketingTournament = NonNullable<Awaited<ReturnType<typeof getMarketingTournament>>>;

/** Détail marketing (colonnes ciblées) — résolu par id puis challongeId/slug. */
export async function getMarketingTournament(idOrSlug: string) {
  const remap = <
    T extends {
      tournamentCategory: {
        id: string;
        name: string;
        color: string | null;
        logoUrl: string | null;
      } | null;
    },
  >(
    t: T | null | undefined,
  ) => {
    if (!t) return null;
    const { tournamentCategory, ...rest } = t;
    return { ...rest, category: tournamentCategory ?? null };
  };

  return (
    remap(
      await db.query.tournaments.findFirst({
        where: eq(schema.tournaments.id, idOrSlug),
        columns: detailColumns,
        with: {
          tournamentCategory: {
            columns: { id: true, name: true, color: true, logoUrl: true },
          },
        },
      }),
    ) ??
    remap(
      await db.query.tournaments.findFirst({
        where: or(
          eq(schema.tournaments.challongeId, idOrSlug),
          ilike(schema.tournaments.challongeUrl, `%${idOrSlug}%`),
        ),
        columns: detailColumns,
        with: {
          tournamentCategory: {
            columns: { id: true, name: true, color: true, logoUrl: true },
          },
        },
      }),
    )
  );
}

/** Ligne nue (existence / sync checks). */
export async function getTournamentById(id: string) {
  return db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
  });
}

/** Tournoi + participants bruts (report match admin → résoudre challongeParticipantId). */
export async function getTournamentWithParticipants(id: string) {
  return db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
    with: { tournamentParticipants: true },
  });
}

export async function getTournamentForLive(id: string) {
  return db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
    columns: {
      id: true,
      status: true,
      standings: true,
      stations: true,
      activityLog: true,
      updatedAt: true,
    },
  });
}

export async function getTournamentChallongeRef(id: string) {
  return db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
    columns: { id: true, challongeId: true, challongeUrl: true },
  });
}

/** Pour la phase de poules : tournoi + matches round=-100 (scores live). */
export async function getTournamentPoolMatches(idOrChallongeId: string) {
  return db.query.tournaments.findFirst({
    where: or(
      eq(schema.tournaments.id, idOrChallongeId),
      eq(schema.tournaments.challongeId, idOrChallongeId),
    ),
    columns: { id: true, name: true, challongeId: true },
    with: {
      tournamentMatches: {
        where: eq(schema.tournamentMatches.round, -100),
        columns: {
          challongeMatchId: true,
          score: true,
          state: true,
          winnerName: true,
        },
      },
    },
  });
}

/** Bracket DB → ViewerData : tournoi + participants + matches bruts. */
export async function getTournamentForBracket(idOrChallongeId: string) {
  return db.query.tournaments.findFirst({
    where: or(
      eq(schema.tournaments.id, idOrChallongeId),
      eq(schema.tournaments.challongeId, idOrChallongeId),
    ),
    with: { tournamentParticipants: true, tournamentMatches: true },
  });
}

/** Export CSV admin : tournoi + participants (avec user/profile) triés par placement. */
export async function getTournamentForExport(id: string) {
  const row = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
    with: {
      tournamentParticipants: {
        with: { user: { with: { profiles: true } } },
        orderBy: asc(schema.tournamentParticipants.finalPlacement),
      },
    },
  });
  if (!row) return null;
  const { tournamentParticipants, ...rest } = row;
  return {
    ...rest,
    participants: tournamentParticipants.map((p) => ({
      ...p,
      user: remapProfileUser(p.user),
    })),
  };
}

/** Export Google Sheets admin : tournoi + participants (decks) + matches. */
export async function getTournamentForSheets(id: string) {
  const row = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, id),
    with: {
      tournamentParticipants: {
        with: {
          user: {
            with: {
              profiles: true,
              decks: {
                where: eq(schema.decks.isActive, true),
                with: {
                  deckItems: {
                    with: {
                      beyblade: true,
                      part_bladeId: true,
                      part_ratchetId: true,
                      part_bitId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: asc(schema.tournamentParticipants.seed),
      },
      tournamentMatches: {
        with: {
          user_player1Id: { with: { profiles: true } },
          user_player2Id: { with: { profiles: true } },
          user_winnerId: { with: { profiles: true } },
        },
        orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
      },
    },
  });
  if (!row) return null;
  const { tournamentParticipants, tournamentMatches, ...rest } = row;
  // Remap inline (et non via `remapDeckUser`) pour préserver l'inférence profonde
  // des relations decks/parts attendue par l'export Sheets (`item.blade.height`, …).
  return {
    ...rest,
    participants: tournamentParticipants.map((p) => ({
      ...p,
      user: p.user
        ? {
            ...p.user,
            profile: p.user.profiles[0] ?? null,
            decks: p.user.decks.map((d) => ({
              ...d,
              items: d.deckItems.map((it) => ({
                ...it,
                bey: it.beyblade,
                blade: it.part_bladeId,
                ratchet: it.part_ratchetId,
                bit: it.part_bitId,
              })),
            })),
          }
        : null,
    })),
    matches: tournamentMatches.map((m) => ({
      ...m,
      player1: m.user_player1Id ?? null,
      player2: m.user_player2Id ?? null,
      winner: m.user_winnerId ?? null,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants & matches (lecture)
// ─────────────────────────────────────────────────────────────────────────────

/** Participants d'un tournoi avec decks actifs (route `/api/tournaments/[id]/participants`). */
export async function listTournamentParticipantsFull(tournamentId: string) {
  const rows = await db.query.tournamentParticipants.findMany({
    where: eq(schema.tournamentParticipants.tournamentId, tournamentId),
    with: {
      user: {
        with: {
          profiles: true,
          decks: {
            where: eq(schema.decks.isActive, true),
            with: {
              deckItems: {
                with: {
                  beyblade: true,
                  part_bladeId: true,
                  part_ratchetId: true,
                  part_bitId: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      asc(schema.tournamentParticipants.seed),
      asc(schema.tournamentParticipants.createdAt),
    ],
  });
  return rows.map((p) => ({ ...p, user: remapDeckUser(p.user) }));
}

/** Matches d'un tournoi (filtrables round/state) avec decks — route `/api/tournaments/[id]/matches`. */
export async function listTournamentMatchesFull(params: {
  tournamentId: string;
  round?: number;
  state?: string;
}) {
  const conditions: SQL[] = [eq(schema.tournamentMatches.tournamentId, params.tournamentId)];
  if (params.round !== undefined) {
    conditions.push(eq(schema.tournamentMatches.round, params.round));
  }
  if (params.state) conditions.push(eq(schema.tournamentMatches.state, params.state));

  const rows = await db.query.tournamentMatches.findMany({
    where: and(...conditions),
    with: {
      user_player1Id: {
        with: {
          profiles: true,
          decks: {
            where: eq(schema.decks.isActive, true),
            with: {
              deckItems: {
                with: {
                  beyblade: true,
                  part_bladeId: true,
                  part_ratchetId: true,
                  part_bitId: true,
                },
              },
            },
          },
        },
      },
      user_player2Id: {
        with: {
          profiles: true,
          decks: {
            where: eq(schema.decks.isActive, true),
            with: {
              deckItems: {
                with: {
                  beyblade: true,
                  part_bladeId: true,
                  part_ratchetId: true,
                  part_bitId: true,
                },
              },
            },
          },
        },
      },
      user_winnerId: { with: { profiles: true } },
    },
    orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
  });
  return rows.map((m) => ({
    ...m,
    player1: remapDeckUser(m.user_player1Id),
    player2: remapDeckUser(m.user_player2Id),
    winner: remapProfileUser(m.user_winnerId),
  }));
}

export async function countParticipants(tournamentId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(schema.tournamentParticipants)
    .where(eq(schema.tournamentParticipants.tournamentId, tournamentId));
  return row?.value ?? 0;
}

export async function findParticipant(tournamentId: string, userId: string) {
  return db.query.tournamentParticipants.findFirst({
    where: and(
      eq(schema.tournamentParticipants.tournamentId, tournamentId),
      eq(schema.tournamentParticipants.userId, userId),
    ),
  });
}

export async function findParticipantWithTournament(tournamentId: string, userId: string) {
  return db.query.tournamentParticipants.findFirst({
    where: and(
      eq(schema.tournamentParticipants.tournamentId, tournamentId),
      eq(schema.tournamentParticipants.userId, userId),
    ),
    with: { tournament: true },
  });
}

export async function getParticipantWithUser(id: string) {
  const row = await db.query.tournamentParticipants.findFirst({
    where: eq(schema.tournamentParticipants.id, id),
    with: { user: { with: { profiles: true } } },
  });
  if (!row) return null;
  return { ...row, user: remapProfileUser(row.user) };
}

export async function getMatchWithContext(matchId: string, tournamentId: string) {
  return db.query.tournamentMatches.findFirst({
    where: and(
      eq(schema.tournamentMatches.id, matchId),
      eq(schema.tournamentMatches.tournamentId, tournamentId),
    ),
    with: { tournament: true, user_player1Id: true, user_player2Id: true },
  });
}

export async function getMatchWithPlayers(matchId: string) {
  const row = await db.query.tournamentMatches.findFirst({
    where: eq(schema.tournamentMatches.id, matchId),
    with: {
      user_player1Id: { with: { profiles: true } },
      user_player2Id: { with: { profiles: true } },
      user_winnerId: { with: { profiles: true } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    player1: remapProfileUser(row.user_player1Id),
    player2: remapProfileUser(row.user_player2Id),
    winner: remapProfileUser(row.user_winnerId),
  };
}

export async function listParticipantsByUserIds(tournamentId: string, userIds: string[]) {
  if (userIds.length === 0) return [];
  return db.query.tournamentParticipants.findMany({
    where: and(
      eq(schema.tournamentParticipants.tournamentId, tournamentId),
      inArray(schema.tournamentParticipants.userId, userIds),
    ),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// User / profile / account helpers (lecture pour les flux Challonge)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserWithProfile(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    with: { profiles: true },
  });
  if (!row) return null;
  const { profiles, ...rest } = row;
  return { ...rest, profile: profiles[0] ?? null };
}

export async function getProviderAccount(userId: string, providerId: string) {
  return db.query.accounts.findFirst({
    where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, providerId)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export interface TournamentCreateValues {
  name: string;
  description?: string | null;
  date: string; // ISO
  location?: string | null;
  format?: string;
  maxPlayers?: number;
  status?: TournamentStatusVal;
  challongeId?: string | null;
  challongeUrl?: string | null;
  categoryId?: string | null;
  weight?: number;
}

export async function createTournamentRow(values: TournamentCreateValues) {
  const [row] = await db
    .insert(schema.tournaments)
    .values({
      name: values.name,
      description: values.description,
      date: values.date,
      location: values.location,
      format: values.format ?? "3on3 Double Elimination",
      maxPlayers: values.maxPlayers ?? 64,
      status: values.status ?? "UPCOMING",
      challongeId: values.challongeId,
      challongeUrl: values.challongeUrl,
      categoryId: values.categoryId,
      ...(values.weight !== undefined ? { weight: values.weight } : {}),
    })
    .returning();
  return row;
}

export interface TournamentUpdateValues {
  name?: string;
  description?: string | null;
  date?: string; // ISO
  location?: string | null;
  format?: string;
  maxPlayers?: number;
  status?: TournamentStatusVal;
  challongeUrl?: string | null;
  categoryId?: string | null;
  weight?: number;
}

export async function updateTournamentRow(id: string, values: TournamentUpdateValues) {
  const [row] = await db
    .update(schema.tournaments)
    .set({
      ...(values.name !== undefined ? { name: values.name } : {}),
      ...(values.description !== undefined ? { description: values.description } : {}),
      ...(values.date !== undefined ? { date: values.date } : {}),
      ...(values.location !== undefined ? { location: values.location } : {}),
      ...(values.format !== undefined ? { format: values.format } : {}),
      ...(values.maxPlayers !== undefined ? { maxPlayers: values.maxPlayers } : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(values.challongeUrl !== undefined ? { challongeUrl: values.challongeUrl } : {}),
      ...(values.categoryId !== undefined ? { categoryId: values.categoryId } : {}),
      ...(values.weight !== undefined ? { weight: values.weight } : {}),
    })
    .where(eq(schema.tournaments.id, id))
    .returning();
  return row;
}

export async function setTournamentStatus(id: string, status: TournamentStatusVal) {
  await db.update(schema.tournaments).set({ status }).where(eq(schema.tournaments.id, id));
}

export async function persistLiveSnapshot(
  id: string,
  values: {
    challongeId?: string | null;
    challongeState?: string | null;
    standings: unknown;
    stations: unknown;
    activityLog: unknown;
  },
) {
  await db
    .update(schema.tournaments)
    .set({
      ...(values.challongeId !== undefined ? { challongeId: values.challongeId } : {}),
      challongeState: values.challongeState ?? null,
      standings: values.standings as never,
      stations: values.stations as never,
      activityLog: values.activityLog as never,
    })
    .where(eq(schema.tournaments.id, id));
}

/** Suppression atomique tournoi + matches + participants. */
export async function deleteTournamentCascade(id: string) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.tournamentMatches).where(eq(schema.tournamentMatches.tournamentId, id));
    await tx
      .delete(schema.tournamentParticipants)
      .where(eq(schema.tournamentParticipants.tournamentId, id));
    await tx.delete(schema.tournaments).where(eq(schema.tournaments.id, id));
  });
}

export async function deleteTournamentRow(id: string) {
  await db.delete(schema.tournaments).where(eq(schema.tournaments.id, id));
}

/** Suppression de masse (admin) : tous, ou seulement les "fake" (sans challongeId). */
export async function deleteTournamentsBulk(opts: { all: boolean }) {
  if (opts.all) {
    const deleted = await db.delete(schema.tournaments).returning({ id: schema.tournaments.id });
    return deleted.length;
  }
  const deleted = await db
    .delete(schema.tournaments)
    .where(isNull(schema.tournaments.challongeId))
    .returning({ id: schema.tournaments.id });
  return deleted.length;
}

export async function ensureProfile(userId: string, bladerName?: string | null) {
  await db
    .insert(schema.profiles)
    .values({ userId, bladerName })
    .onConflictDoNothing({ target: schema.profiles.userId });
}

export interface ParticipantCreateValues {
  tournamentId: string;
  userId: string;
  seed?: number;
  challongeParticipantId?: string;
}

export async function createParticipant(values: ParticipantCreateValues) {
  const [row] = await db
    .insert(schema.tournamentParticipants)
    .values({
      tournamentId: values.tournamentId,
      userId: values.userId,
      seed: values.seed,
      challongeParticipantId: values.challongeParticipantId,
    })
    .returning();
  return row;
}

export async function deleteParticipant(tournamentId: string, userId: string) {
  await db
    .delete(schema.tournamentParticipants)
    .where(
      and(
        eq(schema.tournamentParticipants.tournamentId, tournamentId),
        eq(schema.tournamentParticipants.userId, userId),
      ),
    );
}

export async function setParticipantChallongeId(participantId: string, challongeId: string) {
  await db
    .update(schema.tournamentParticipants)
    .set({ challongeParticipantId: challongeId })
    .where(eq(schema.tournamentParticipants.id, participantId));
}

export interface MatchReportValues {
  winnerId: string;
  score: string;
  state?: string;
}

export async function reportMatchById(matchId: string, values: MatchReportValues) {
  await db
    .update(schema.tournamentMatches)
    .set({
      winnerId: values.winnerId,
      score: values.score,
      state: values.state ?? "complete",
    })
    .where(eq(schema.tournamentMatches.id, matchId));
}

export async function reportMatchByChallongeId(
  tournamentId: string,
  challongeMatchId: string,
  values: MatchReportValues,
) {
  await db
    .update(schema.tournamentMatches)
    .set({
      winnerId: values.winnerId,
      score: values.score,
      state: values.state ?? "complete",
    })
    .where(
      and(
        eq(schema.tournamentMatches.tournamentId, tournamentId),
        eq(schema.tournamentMatches.challongeMatchId, challongeMatchId),
      ),
    );
}

export interface MatchUpsertValues {
  tournamentId: string;
  challongeMatchId: string;
  round: number;
  state: string;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  score: string | null;
}

/** Upsert d'un match synchronisé depuis Challonge (sync action). */
export async function upsertMatchFromChallonge(values: MatchUpsertValues) {
  await db
    .insert(schema.tournamentMatches)
    .values({
      tournamentId: values.tournamentId,
      challongeMatchId: values.challongeMatchId,
      round: values.round,
      state: values.state,
      player1Id: values.player1Id,
      player2Id: values.player2Id,
      winnerId: values.winnerId,
      score: values.score,
    })
    .onConflictDoUpdate({
      target: [schema.tournamentMatches.tournamentId, schema.tournamentMatches.challongeMatchId],
      set: {
        round: values.round,
        state: values.state,
        score: values.score,
        winnerId: values.winnerId,
      },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin — list + sync (depuis `(admin)/admin/tournaments/actions`)
// ─────────────────────────────────────────────────────────────────────────────

export async function listExistingChallongeIds(challongeIds: string[]) {
  if (challongeIds.length === 0) return [];
  const rows = await db.query.tournaments.findMany({
    where: inArray(schema.tournaments.challongeId, challongeIds),
    columns: { challongeId: true },
  });
  return rows.map((r) => r.challongeId).filter((v): v is string => Boolean(v));
}

/** Liste paginée admin + résumés agrégés. */
export async function listTournamentsAdmin(page = 1, pageSize = 10, search = "") {
  const skip = (page - 1) * pageSize;
  const where = search
    ? or(
        ilike(schema.tournaments.name, `%${search}%`),
        ilike(schema.tournaments.description, `%${search}%`),
      )
    : undefined;

  const [tournaments, totalRows, totalAll, activeRows, participantRows] = await Promise.all([
    db.query.tournaments.findMany({
      where,
      offset: skip,
      limit: pageSize,
      orderBy: desc(schema.tournaments.date),
    }),
    db.select({ value: count() }).from(schema.tournaments).where(where),
    db.select({ value: count() }).from(schema.tournaments),
    db
      .select({ value: count() })
      .from(schema.tournaments)
      .where(inArray(schema.tournaments.status, ["REGISTRATION_OPEN", "UNDERWAY", "CHECKIN"])),
    db.select({ value: count() }).from(schema.tournamentParticipants),
  ]);

  const ids = tournaments.map((t) => t.id);
  const countById = new Map<string, number>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        tournamentId: schema.tournamentParticipants.tournamentId,
        value: count(),
      })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.tournamentId, ids))
      .groupBy(schema.tournamentParticipants.tournamentId);
    for (const r of rows) countById.set(r.tournamentId, r.value);
  }

  return {
    tournaments: tournaments.map((t) => ({
      ...t,
      _count: { participants: countById.get(t.id) ?? 0 },
    })),
    total: totalRows[0]?.value ?? 0,
    summary: {
      totalTournaments: totalAll[0]?.value ?? 0,
      activeTournaments: activeRows[0]?.value ?? 0,
      totalParticipants: participantRows[0]?.value ?? 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Équipe staff Discord (migré de `lib/discord-data`)
// ─────────────────────────────────────────────────────────────────────────────

/** Membres staff actifs groupés par rôle (Source of Truth via `/sync` du bot). */
export async function getDiscordTeam(): Promise<TeamGroup[]> {
  try {
    const staffMembers = await db.query.staffMembers.findMany({
      where: eq(schema.staffMembers.isActive, true),
      orderBy: [asc(schema.staffMembers.displayIndex), desc(schema.staffMembers.createdAt)],
    });

    const roles = Object.entries(DiscordRoleMapping);

    const teamData = roles.map(([roleId, roleType]) => {
      const members = staffMembers
        .filter((m) => m.role === roleType)
        .map(
          (m) =>
            ({
              id: m.discordId || m.id,
              username: m.name,
              displayName: m.nickname || m.name,
              avatar: m.imageUrl,
              nickname: m.nickname || undefined,
              joinedAt: m.joinedAt ?? undefined,
              premiumSince: m.premiumSince ?? null,
              roles: (m.roles as unknown[]) || [],
              status: m.status || undefined,
              activities: (m.activities as unknown[]) || [],
              serverAvatar: m.serverAvatar || null,
              globalName: m.globalName || null,
              createdAt: m.accountCreatedAt ?? undefined,
            }) as BotMember,
        );

      return { roleId, roleType: roleType as RoleType, members };
    });

    const sortOrder: RoleType[] = ["ADMIN", "RH", "ARBITRE", "STAFF"];

    return teamData
      .filter((t) => t.members.length > 0)
      .sort((a, b) => {
        const indexA = sortOrder.indexOf(a.roleType);
        const indexB = sortOrder.indexOf(b.roleType);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
  } catch (error) {
    console.error("Failed to fetch Discord team:", error);
    return [];
  }
}
