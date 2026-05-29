/**
 * Convertisseur Challonge → `ViewerData` (`@rose-griffon/challonge-core`).
 *
 * Mappe la forme canonique `ScrapedTournament` (sortie de
 * `ChallongeApi.toCanonical()`) vers le format consomme par le viewer rpbey.
 *
 * Mapping :
 *   - tournament_type "single elimination" / "double elimination" / "round robin"
 *     → `single_elimination` / `double_elimination` / `round_robin`
 *   - participants : `{ id, name, tournament_id }` direct.
 *   - matches :
 *     · group_id derivee de `bracketSide` (RR=1, WB=2/3, LB=4, GF=5).
 *     · round_id global unique : positif (WB/RR) ou offset (LB).
 *     · status : `open` → Ready, `complete` → Completed, `pending` → Locked.
 *     · scores : sum des `sets[]` Challonge.
 */

import type {
  ScrapedMatch,
  ScrapedParticipant,
  ScrapedTournament,
} from "@/lib/challonge-vendor/types";

import type { Match, Participant, Stage, ViewerData } from "./types";
import { Status } from "./types";

const TYPE_MAP: Record<string, Stage["type"]> = {
  "single elimination": "single_elimination",
  single_elimination: "single_elimination",
  "double elimination": "double_elimination",
  double_elimination: "double_elimination",
  "round robin": "round_robin",
  round_robin: "round_robin",
  swiss: "round_robin",
};

const STATE_MAP: Record<string, Status> = {
  complete: Status.Completed,
  open: Status.Ready,
  pending: Status.Locked,
  canceled: Status.Locked,
};

function mapType(challongeType: string): Stage["type"] {
  const key = (challongeType ?? "").trim().toLowerCase();
  const mapped = TYPE_MAP[key];
  if (mapped) return mapped;
  if (key.includes("double")) return "double_elimination";
  if (key.includes("round")) return "round_robin";
  return "single_elimination";
}

function mapStatus(state: string): Status {
  return STATE_MAP[state?.toLowerCase()] ?? Status.Waiting;
}

function setsToScore(sets: ScrapedMatch["sets"], side: 0 | 1): number | undefined {
  if (!sets?.length) return undefined;
  let total = 0;
  for (const set of sets) {
    const v = set?.[side];
    if (typeof v === "number") total += v;
  }
  return total || undefined;
}

interface ConvertOptions {
  /**
   * Si `true`, ajoute `position` aux participants du premier round selon leur seed
   * (utile pour aligner le rendu avec un seeding personnalise).
   */
  withSeeds?: boolean;
  /** Override du `tournament_id` injecte dans participants/stages (default = `tournament.metadata.id`). */
  tournamentId?: number | string;
}

/**
 * Calcule un `round_id` unique pour chaque match en aplatissant les rounds Challonge.
 * - WB rounds (positifs) : 1, 2, 3, …, N
 * - LB rounds (negatifs) : N + 1, N + 2, …, N + M (mappe -1 → N+1, -2 → N+2…)
 * - GF (round = N + 1 ou plus, bracketSide = "GF") : N + M + 1
 */
function buildRoundIdMap(matches: ScrapedMatch[]): Map<string, number> {
  const wbRounds = new Set<number>();
  const lbRounds = new Set<number>();
  const gfRounds = new Set<number>();
  for (const m of matches) {
    if (m.bracketSide === "GF") gfRounds.add(m.round);
    else if (m.round > 0) wbRounds.add(m.round);
    else if (m.round < 0) lbRounds.add(m.round);
    else wbRounds.add(0);
  }
  const wbSorted = [...wbRounds].sort((a, b) => a - b);
  const lbSorted = [...lbRounds].sort((a, b) => b - a); // -1, -2, -3 …
  const gfSorted = [...gfRounds].sort((a, b) => a - b);

  const out = new Map<string, number>();
  let cursor = 0;
  for (const r of wbSorted) {
    cursor++;
    out.set(`WB:${r}`, cursor);
    out.set(`RR:${r}`, cursor);
  }
  for (const r of lbSorted) {
    cursor++;
    out.set(`LB:${r}`, cursor);
  }
  for (const r of gfSorted) {
    cursor++;
    out.set(`GF:${r}`, cursor);
  }
  return out;
}

function groupIdFor(
  stageType: Stage["type"],
  side: ScrapedMatch["bracketSide"],
  groupId: number | null | undefined,
): number {
  if (stageType === "round_robin") return Math.max(1, groupId ?? 1);
  if (stageType === "single_elimination") return 2;
  // Double elimination
  if (side === "LB") return 4;
  if (side === "GF") return 5;
  return 3; // WB par defaut
}

export function challongeToViewerData(
  tournament: ScrapedTournament,
  options: ConvertOptions = {},
): ViewerData {
  const tournamentId = options.tournamentId ?? tournament.metadata.id;
  const stageType = mapType(tournament.metadata.type);

  const stage: Stage = {
    id: tournamentId,
    tournament_id: tournamentId,
    name: tournament.metadata.name || `Tournoi ${tournamentId}`,
    type: stageType,
    number: 1,
    settings: {
      size: tournament.metadata.participantsCount || tournament.participants.length,
      seedOrdering: ["natural"],
    },
  };

  const participants: Participant[] = tournament.participants.map(
    (p: ScrapedParticipant): Participant => ({
      id: p.id,
      tournament_id: tournamentId,
      name: p.name || `Joueur ${p.id}`,
    }),
  );

  const seedById = new Map<number, number>();
  if (options.withSeeds !== false) {
    for (const p of tournament.participants) seedById.set(p.id, p.seed);
  }

  const roundIdMap = buildRoundIdMap(tournament.matches);
  const groupedByRound = new Map<number, number>(); // round_id → next match.number

  const matches: Match[] = tournament.matches.map((m): Match => {
    const sideKey =
      m.bracketSide === "LB"
        ? "LB"
        : m.bracketSide === "GF"
          ? "GF"
          : stageType === "round_robin"
            ? "RR"
            : "WB";
    const roundId = roundIdMap.get(`${sideKey}:${m.round}`) ?? m.round;
    const number = (groupedByRound.get(roundId) ?? 0) + 1;
    groupedByRound.set(roundId, number);

    const groupId = groupIdFor(stageType, m.bracketSide, m.groupId);
    const status = mapStatus(m.state);

    const score1 = setsToScore(m.sets, 0);
    const score2 = setsToScore(m.sets, 1);
    const result1 =
      m.winnerId !== null && m.player1Id !== null
        ? m.winnerId === m.player1Id
          ? "win"
          : m.loserId === m.player1Id
            ? "loss"
            : undefined
        : undefined;
    const result2 =
      m.winnerId !== null && m.player2Id !== null
        ? m.winnerId === m.player2Id
          ? "win"
          : m.loserId === m.player2Id
            ? "loss"
            : undefined
        : undefined;

    return {
      id: m.id,
      stage_id: stage.id,
      group_id: groupId,
      round_id: roundId,
      number,
      child_count: 0,
      status,
      opponent1:
        m.player1Id !== null
          ? {
              id: m.player1Id,
              ...(seedById.has(m.player1Id) && {
                position: seedById.get(m.player1Id),
              }),
              ...(score1 !== undefined && { score: score1 }),
              ...(result1 && { result: result1 }),
              ...(m.forfeited && m.loserId === m.player1Id && { forfeit: true }),
            }
          : null,
      opponent2:
        m.player2Id !== null
          ? {
              id: m.player2Id,
              ...(seedById.has(m.player2Id) && {
                position: seedById.get(m.player2Id),
              }),
              ...(score2 !== undefined && { score: score2 }),
              ...(result2 && { result: result2 }),
              ...(m.forfeited && m.loserId === m.player2Id && { forfeit: true }),
            }
          : null,
    };
  });

  return {
    stages: [stage],
    participants,
    matches,
    matchGames: [],
  };
}

export type { ScrapedTournament };
