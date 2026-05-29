"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadJsonSafe } from "@/lib/data-cache";
import { db, schema, inArray, isNotNull } from "@/lib/db";
import { getRankingConfig } from "./ranking";

// ─── Types ─────────────────────────────────────────────────────────

export type BtsSeason = 1 | 2;

interface BtsParticipant {
  id: number;
  name: string;
  seed?: number;
  portraitUrl?: string;
  finalRank?: number | null;
  challongeUsername?: string | null;
  discordUsername?: string | null;
}

interface BtsMatch {
  id: number;
  winnerId: number | null;
  loserId: number | null;
  state?: string;
}

interface BtsTournament {
  metadata?: {
    id?: number;
    name?: string;
    state?: string;
    url?: string;
    participantsCount?: number;
  };
  participants?: BtsParticipant[];
  matches?: BtsMatch[];
}

/**
 * A tournament export is "trustworthy for placements" when:
 *   1. Challonge state is `complete` (or missing — legacy BTS1/2/3 imports
 *      pre-date the `state` field).
 *   2. There is at least one rank-1 finisher AND the rank distribution shows
 *      diversity (otherwise the export is a pre-tournament dump where every
 *      participant has finalRank=1).
 *
 * If the export is *not* trustworthy we still credit participation + W/L for
 * complete matches (fairer mid-tournament view), but we drop placement
 * bonuses, championship counts, bestFinish, and Hall-of-Fame entries.
 *
 * This guard exists because B_TS4.json shipped with `state=pending` and 70
 * participants all stamped `finalRank=1` (Challonge default for unstarted
 * single/double-elim brackets) — flipping SEASON_MAP without re-scraping
 * would have credited 70 fake champions at +20 pts each.
 */
function isTrustworthyForPlacements(t: BtsTournament): boolean {
  const state = t.metadata?.state;
  if (state && state !== "complete") return false;
  const ranks = (t.participants ?? [])
    .map((p) => p.finalRank)
    .filter((r): r is number => r != null && r > 0);
  if (ranks.length === 0) return false;
  const unique = new Set(ranks);
  // All identical → garbage. Need at least 2 distinct buckets.
  return unique.size > 1;
}

export interface BtsRankingEntry {
  rank: number;
  playerName: string;
  points: number;
  wins: number;
  losses: number;
  tournamentWins: number;
  participations: number;
  avatarUrl: string | null;
  bestFinish: number | null;
}

export interface BtsChampion {
  tournament: string;
  winner: string;
  date: string;
  participantsCount: number;
  matchesCount: number;
}

interface BtsRankingResult {
  entries: BtsRankingEntry[];
  total: number;
  champions: BtsChampion[];
  tournamentsLoaded: string[];
}

// ─── Season → tournament mapping ───────────────────────────────────

const SEASON_MAP: Record<BtsSeason, number[]> = {
  1: [1],
  2: [2, 3, 4, 5],
};

const POINTS_BY_FINISH = new Map<number, keyof PointsKeys>([
  [1, "firstPlace"],
  [2, "secondPlace"],
  [3, "thirdPlace"],
  [4, "top8"],
  [5, "top8"],
  [6, "top8"],
  [7, "top8"],
  [8, "top8"],
]);

type PointsKeys = {
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  top8: number;
  matchWinWinner: number;
  matchWinLoser: number;
  participation: number;
};

// ─── Helpers ───────────────────────────────────────────────────────

async function loadBts(n: number): Promise<{ name: string; data: BtsTournament } | null> {
  const data = await loadJsonSafe<BtsTournament>(`data/exports/B_TS${n}.json`);
  if (!data) return null;
  return { name: `BTS${n}`, data };
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

interface AliasMapEntry {
  primaryName: string;
  challongeUsername?: string | null;
  aliases?: string[];
}

/**
 * Load `data/exports/participants_map.json` and build an alias→canonicalKey
 * resolver. Same player under different Challonge names ("Younsi" vs
 * "SAtR_Younsi", "Yumetoo" vs "RNSX_Yumetoo") gets a single ranking entry.
 *
 * The map is best-effort: if it's missing or parse-fails, we fall back to
 * `normalizeKey(name)` (= legacy behaviour).
 */
async function loadAliasResolver(): Promise<{
  resolveKey: (name: string) => string;
  primaryNameOf: (key: string) => string | undefined;
}> {
  try {
    const map =
      (await loadJsonSafe<Record<string, AliasMapEntry>>("data/exports/participants_map.json")) ??
      {};
    const aliasToKey = new Map<string, string>();
    const primaryByKey = new Map<string, string>();
    for (const [key, e] of Object.entries(map)) {
      primaryByKey.set(key, e.primaryName);
      const candidates = new Set<string>([e.primaryName, ...(e.aliases ?? [])]);
      if (e.challongeUsername) candidates.add(e.challongeUsername);
      for (const a of candidates) {
        if (!a) continue;
        const k = normalizeKey(a);
        if (k) aliasToKey.set(k, key);
      }
    }
    return {
      resolveKey: (name: string) => {
        const n = normalizeKey(name);
        return aliasToKey.get(n) ?? n;
      },
      primaryNameOf: (key: string) => primaryByKey.get(key),
    };
  } catch {
    return {
      resolveKey: normalizeKey,
      primaryNameOf: () => undefined,
    };
  }
}

function aggregatePoints(
  tournaments: Array<{ name: string; data: BtsTournament }>,
  config: PointsKeys,
  resolver: {
    resolveKey: (n: string) => string;
    primaryNameOf: (k: string) => string | undefined;
  },
): Array<BtsRankingEntry & { challongeUsername: string | null }> {
  interface PlayerAccum {
    name: string;
    challongeUsername: string | null;
    wins: number;
    losses: number;
    points: number;
    tournamentWins: number;
    participations: number;
    challongePortraitUrl: string | null;
    bestFinish: number | null;
  }
  const players = new Map<string, PlayerAccum>();

  for (const { data } of tournaments) {
    const participants = data.participants ?? [];
    const matches = data.matches ?? [];
    const trustPlacements = isTrustworthyForPlacements(data);

    // Lookup participant by challonge id for match resolution
    const byId = new Map<number, BtsParticipant>();
    for (const p of participants) byId.set(p.id, p);

    // Points via finalRank + participation. Names are resolved through
    // `participants_map.json` so a player with multiple Challonge aliases
    // ("Younsi"/"SAtR_Younsi", "Yumetoo"/"RNSX_Yumetoo") collapses into a
    // single ranking entry instead of being split.
    for (const p of participants) {
      if (!p.name) continue;
      const key = resolver.resolveKey(p.name);
      const displayName = resolver.primaryNameOf(key) ?? p.name;
      const acc: PlayerAccum = players.get(key) ?? {
        name: displayName,
        challongeUsername: p.challongeUsername ?? null,
        wins: 0,
        losses: 0,
        points: 0,
        tournamentWins: 0,
        participations: 0,
        challongePortraitUrl: null,
        bestFinish: null,
      };

      acc.participations += 1;
      acc.points += config.participation;
      if (!acc.challongeUsername && p.challongeUsername)
        acc.challongeUsername = p.challongeUsername;
      if (p.portraitUrl && !acc.challongePortraitUrl) acc.challongePortraitUrl = p.portraitUrl;

      const rank = trustPlacements ? (p.finalRank ?? null) : null;
      if (rank) {
        const bucket = POINTS_BY_FINISH.get(rank);
        if (bucket) acc.points += config[bucket];
        if (rank === 1) acc.tournamentWins += 1;
        if (acc.bestFinish === null || rank < acc.bestFinish) {
          acc.bestFinish = rank;
        }
      }
      players.set(key, acc);
    }

    // W/L + match points
    for (const m of matches) {
      if (m.state && m.state !== "complete") continue;
      if (m.winnerId == null || m.loserId == null) continue;
      const winner = byId.get(m.winnerId);
      const loser = byId.get(m.loserId);
      if (winner?.name) {
        const key = resolver.resolveKey(winner.name);
        const acc = players.get(key);
        if (acc) {
          acc.wins += 1;
          acc.points += config.matchWinWinner;
        }
      }
      if (loser?.name) {
        const key = resolver.resolveKey(loser.name);
        const acc = players.get(key);
        if (acc) {
          acc.losses += 1;
          acc.points += config.matchWinLoser;
        }
      }
    }
  }

  const sorted = [...players.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.tournamentWins !== a.tournamentWins) return b.tournamentWins - a.tournamentWins;
    return b.wins - a.wins;
  });

  return sorted.map((p, i) => ({
    rank: i + 1,
    playerName: p.name,
    challongeUsername: p.challongeUsername,
    points: p.points,
    wins: p.wins,
    losses: p.losses,
    tournamentWins: p.tournamentWins,
    participations: p.participations,
    // Discord avatar resolved post-aggregation in `getBtsRanking`.
    avatarUrl: p.challongePortraitUrl,
    bestFinish: p.bestFinish,
  }));
}

// Resolver Discord — User.image prioritaire sur portrait Challonge.
async function loadDiscordImageResolver(): Promise<
  (playerName: string, challongeUsername: string | null) => string | null
> {
  const norm = (s: string | null | undefined) =>
    s
      ? s
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]/g, "")
      : "";
  let map: Record<
    string,
    {
      primaryName?: string;
      challongeUsername?: string | null;
      discordId?: string | null;
      discordUsername?: string | null;
      aliases?: string[];
    }
  > = {};
  try {
    const loaded = await loadJsonSafe<typeof map>("data/exports/participants_map.json");
    if (loaded) map = loaded;
  } catch {
    /* ignore */
  }
  const aliasToKey = new Map<string, string>();
  for (const [k, e] of Object.entries(map)) {
    const cs = new Set<string>([e.primaryName ?? "", ...(e.aliases ?? [])]);
    if (e.challongeUsername) cs.add(e.challongeUsername);
    if (e.discordUsername) cs.add(e.discordUsername);
    for (const a of cs) {
      const n = norm(a);
      if (n) aliasToKey.set(n, k);
    }
  }
  let users: any[] = [];
  try {
    const userRows = await db.query.users.findMany({
      where: isNotNull(schema.users.discordId),
      columns: {
        id: true,
        discordId: true,
        username: true,
        displayUsername: true,
        name: true,
        globalName: true,
        nickname: true,
        discordTag: true,
        image: true,
      },
      with: {
        profiles: {
          columns: { challongeUsername: true, bladerName: true },
        },
      },
    });
    users = userRows.map((u) => ({ ...u, profile: u.profiles[0] ?? null }));
  } catch {
    /* ignore */
  }
  const imageByDiscordId = new Map<string, string | null>();
  for (const u of users) if (u.discordId) imageByDiscordId.set(u.discordId, u.image ?? null);
  const imageByKey = new Map<string, string>();
  const setIfFree = (k: string, img: string | null) => {
    if (k && img && !imageByKey.has(k)) imageByKey.set(k, img);
  };
  for (const u of users)
    if (u.profile?.challongeUsername) setIfFree(norm(u.profile.challongeUsername), u.image);
  for (const u of users) {
    setIfFree(norm(u.username), u.image);
    setIfFree(norm(u.displayUsername), u.image);
    setIfFree(norm(u.globalName), u.image);
    setIfFree(norm(u.nickname), u.image);
    setIfFree(norm(u.discordTag), u.image);
    setIfFree(norm(u.profile?.bladerName), u.image);
    setIfFree(norm(u.name), u.image);
  }
  return (playerName: string, challongeUsername: string | null) => {
    const cands = new Set<string>([norm(playerName)]);
    if (challongeUsername) cands.add(norm(challongeUsername));
    const mapKey = aliasToKey.get(norm(playerName));
    if (mapKey) {
      const e = map[mapKey];
      if (e?.discordId) {
        const img = imageByDiscordId.get(e.discordId);
        if (img) return img;
      }
      if (e?.challongeUsername) cands.add(norm(e.challongeUsername));
      if (e?.discordUsername) cands.add(norm(e.discordUsername));
      for (const a of e?.aliases ?? []) cands.add(norm(a));
    }
    for (const c of cands) {
      const img = imageByKey.get(c);
      if (img) return img;
    }
    return null;
  };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Get the aggregated BTS ranking for a given season, plus the list of
 * champions (finalRank=1 per tournament) usable for a Hall of Fame.
 */
export async function getBtsRanking(
  season: BtsSeason,
  opts: { search?: string; page?: number; pageSize?: number } = {},
): Promise<BtsRankingResult> {
  const { search = "", page = 1, pageSize = 100 } = opts;
  const slugs = SEASON_MAP[season] ?? [];

  const loaded = (await Promise.all(slugs.map(loadBts))).filter(
    (x): x is { name: string; data: BtsTournament } => x !== null,
  );

  const [config, resolver, discordImageOf] = await Promise.all([
    getRankingConfig(),
    loadAliasResolver(),
    loadDiscordImageResolver().catch(() => () => null as string | null),
  ]);

  const aggregated = aggregatePoints(
    loaded,
    {
      firstPlace: config.firstPlace,
      secondPlace: config.secondPlace,
      thirdPlace: config.thirdPlace,
      top8: config.top8,
      matchWinWinner: config.matchWinWinner,
      matchWinLoser: config.matchWinLoser,
      participation: config.participation,
    },
    resolver,
  );

  // Discord avatar prioritaire — Challonge portrait reste le fallback
  const entries: BtsRankingEntry[] = aggregated.map((e) => ({
    ...e,
    avatarUrl: discordImageOf(e.playerName, e.challongeUsername) ?? e.avatarUrl,
  }));

  const filtered = search
    ? entries.filter((e) => e.playerName.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize).map((e, i) => ({
    ...e,
    rank: start + i + 1,
  }));

  // Only surface a champion when the export is trustworthy. Otherwise
  // (pre-tournament dump where everyone has finalRank=1, or state≠complete)
  // we drop the entry entirely — no fake Hall-of-Fame card.
  const champions: BtsChampion[] = loaded
    .filter(({ data }) => isTrustworthyForPlacements(data))
    .map(({ name, data }) => {
      const champ = (data.participants ?? []).find((p) => p.finalRank === 1);
      return {
        tournament: name,
        winner: champ?.name ?? "—",
        date: name,
        participantsCount: (data.participants ?? []).length,
        matchesCount: (data.matches ?? []).length,
      };
    });

  return {
    entries: paged,
    total: filtered.length,
    champions,
    tournamentsLoaded: loaded.map((t) => t.name),
  };
}

/**
 * Season metadata for UI rendering. Must be async because the host file
 * uses `'use server'` — Next.js forbids sync exported functions there.
 */
export async function getBtsSeasonMeta(season: BtsSeason): Promise<{
  label: string;
  sublabel: string;
  tournaments: string[];
}> {
  const slugs = SEASON_MAP[season];
  return {
    label: `Saison ${season}`,
    sublabel:
      season === 1
        ? "BTS 1"
        : slugs.length > 1
          ? `BTS ${slugs[0]} → ${slugs[slugs.length - 1]}`
          : `BTS ${slugs[0]}`,
    tournaments: slugs.map((n) => `BTS${n}`),
  };
}

/**
 * Liste des tournois BTS d'une saison, enrichie avec la donnée DB pour
 * permettre au front d'afficher le bracket + les pools en accordéon dans la
 * page `/rankings`. Si le tournoi n'a pas été importé en DB (legacy BTS1-3),
 * on renvoie un fallback avec lien Challonge uniquement.
 */
export interface BtsSeasonTournament {
  slug: string;
  name: string;
  challongeUrl: string | null;
  dbTournamentId: string | null;
  posterUrl: string | null;
  hasPools: boolean;
  participantsCount: number;
  state: string | null;
}

/**
 * Top 10 du tournoi BTS demandé (slug = "BTS1" → fichier `B_TS1.json`).
 * Tri par finalRank asc. Renvoie au plus 10 entrées.
 *
 * Si le fichier n'existe pas, ou que l'export n'est pas trustworthy
 * (pre-tournament dump où tout le monde a finalRank=1), renvoie une liste
 * vide plutôt que de produire un faux top 10.
 */
export async function getBtsTournamentTop10(slug: string): Promise<{
  success: boolean;
  data?: Array<{ rank: number; name: string }>;
  error?: string;
}> {
  try {
    const m = slug.match(/BTS(\d+)/i);
    if (!m?.[1]) return { success: true, data: [] };
    const n = parseInt(m[1], 10);
    const data = await loadJsonSafe<BtsTournament>(`data/exports/B_TS${n}.json`);
    if (!data) return { success: true, data: [] };
    if (!isTrustworthyForPlacements(data)) {
      return { success: true, data: [] };
    }
    const top10 = (data.participants ?? [])
      .filter((p) => p.finalRank != null && p.finalRank > 0)
      .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999))
      .slice(0, 10)
      .map((p, i) => ({
        rank: p.finalRank ?? i + 1,
        name: p.name,
      }));
    return { success: true, data: top10 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getBtsSeasonTournaments(season: BtsSeason): Promise<BtsSeasonTournament[]> {
  const slugs = SEASON_MAP[season] ?? [];
  const exports_ = await Promise.all(slugs.map((n) => loadBts(n)));

  const challongeIds = exports_
    .map((e) => e?.data.metadata?.id)
    .filter((id): id is number => typeof id === "number")
    .map((id) => String(id));

  const dbTournaments =
    challongeIds.length > 0
      ? await db.query.tournaments.findMany({
          where: inArray(schema.tournaments.challongeId, challongeIds),
          columns: {
            id: true,
            name: true,
            challongeId: true,
            posterUrl: true,
          },
        })
      : [];
  const dbByChallongeId = new Map(dbTournaments.map((t) => [t.challongeId ?? "", t]));

  // Pool data: presence of `data/pools/B_TS{n}.json` indicates a pool stage.
  // Sur Vercel : fetch HEAD via CDN. Sur VPS / dev : test FS local.
  const poolFiles = await Promise.all(
    slugs.map(async (n) => {
      try {
        if (process.env.VERCEL === "1") {
          const url = `${process.env.NEXT_PUBLIC_CDN_DATA_URL ?? "https://cdn.rpbey.fr/static/rpb-dashboard"}/data/pools/B_TS${n}.json`;
          const res = await fetch(url, {
            method: "HEAD",
            next: { revalidate: 3600 },
          });
          return { n, exists: res.ok };
        }
        const { access } = await import("node:fs/promises");
        await access(join(process.cwd(), "data", "pools", `B_TS${n}.json`));
        return { n, exists: true };
      } catch {
        return { n, exists: false };
      }
    }),
  );
  const hasPoolsBySlug = new Map(poolFiles.map((p) => [`BTS${p.n}`, p.exists]));

  return exports_
    .map((e, i): BtsSeasonTournament | null => {
      if (!e) return null;
      const slugN = slugs[i]!;
      const slug = `BTS${slugN}`;
      const meta = e.data.metadata ?? {};
      const challongeId = meta.id ? String(meta.id) : null;
      const db = challongeId ? (dbByChallongeId.get(challongeId) ?? null) : null;
      return {
        slug,
        name: meta.name && meta.name !== "Tournoi Importé" ? meta.name : slug,
        challongeUrl: meta.url ?? `https://challonge.com/B_TS${slugN}`,
        dbTournamentId: db?.id ?? null,
        posterUrl: db?.posterUrl ?? null,
        hasPools: hasPoolsBySlug.get(slug) ?? false,
        participantsCount: meta.participantsCount ?? 0,
        state: meta.state ?? null,
      };
    })
    .filter((t): t is BtsSeasonTournament => t !== null);
}
