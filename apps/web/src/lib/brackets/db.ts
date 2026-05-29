/**
 * Conversion **Prisma DB → ViewerData** (`@rose-griffon/challonge-core`).
 *
 * Source de vérité : nos tables `tournament_matches` + `tournament_participants`
 * + JSONB `tournament.standings` — déconnectées de Challonge à ce stade.
 *
 * Convention bracket double-elim Challonge → groups brackets-viewer:
 *   - WB rounds 1..N    → group 1 (Winner Bracket)    round_id 1..N
 *   - LB rounds -1..-M  → group 2 (Loser Bracket)     round_id N+1..N+M
 *   - GF (round = max+1) → group 3 (Grand Final)      round_id N+M+1
 *
 * Convention pool stage:
 *   - matches `round === -100`    → groups 1..K (Group A..F) si on a la
 *     structure (passée en argument). Sinon skip.
 *
 * Pour T_SS1 : la structure pool n'est PAS en DB — elle vient du HTML scrape.
 * V1 ici : on rend uniquement le bracket DE. Pool stage = V2 (à wirer quand
 * on aura un champ `Tournament.poolStructure` JSONB).
 */

import type { Group, Match, Participant, Round, Stage, ViewerData } from "./types";
import { Status } from "./types";

const POOL_ROUND_SENTINEL = -100;

interface PrismaTournament {
  id: string;
  name: string;
  format?: string | null;
}

interface PrismaParticipant {
  id: string;
  playerName: string | null;
  finalPlacement: number | null;
}

interface PrismaMatch {
  id: string;
  round: number;
  player1Name: string | null;
  player2Name: string | null;
  winnerName: string | null;
  score: string | null;
  state: string;
}

/**
 * Parse "X-Y" → [X, Y]. Renvoie [0, 0] si format invalide.
 */
function parseScore(raw: string | null): [number, number] {
  if (!raw) return [0, 0];
  const m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return [0, 0];
  return [parseInt(m[1]!, 10), parseInt(m[2]!, 10)];
}

/**
 * Convertit un tournoi DB (bracket finals double-elim uniquement) en
 * `ViewerData` consommable par `<BracketsViewer>`.
 *
 * Les matches `round === -100` (phase de poule) sont **skip** dans cette V1.
 *
 * Sortie :
 *   - 1 stage `double_elimination`
 *   - 3 groups : WB (1) / LB (2) / GF (3)
 *   - rounds dérivés des `round` Challonge (positifs WB, négatifs LB, max+1 = GF)
 *   - matches avec opponent1/opponent2 référencés par participant id
 */
export function bracketDbToViewerData(
  tournament: PrismaTournament,
  participants: PrismaParticipant[],
  matches: PrismaMatch[],
): ViewerData {
  const stageId = `${tournament.id}-stage-1`;
  const groupWb = `${stageId}-wb`;
  const groupLb = `${stageId}-lb`;
  const groupGf = `${stageId}-gf`;

  // Bracket-only : skip pool + matches non-complete sans opponents
  const bracketMatches = matches.filter((m) => m.round !== POOL_ROUND_SENTINEL);

  // Identifier les rounds réels présents
  const wbRounds = [...new Set(bracketMatches.filter((m) => m.round > 0).map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  const lbRounds = [...new Set(bracketMatches.filter((m) => m.round < 0).map((m) => m.round))].sort(
    (a, b) => b - a,
  ); // -1, -2, -3 ... → ordre logique

  // Conventionnellement, le dernier round WB = grande finale.
  // Challonge encode parfois R6 = GF avec 2 matches (bracket reset).
  const wbMaxRound = wbRounds[wbRounds.length - 1] ?? 0;
  const gfRound = wbMaxRound; // Le dernier round positif est la GF

  // Regular WB rounds = tous sauf le dernier (qui est GF)
  const regularWbRounds = wbRounds.slice(0, -1);

  // === Stages ===
  const stages: Stage[] = [
    {
      id: stageId,
      tournament_id: tournament.id,
      name: tournament.name,
      type: "double_elimination",
      number: 1,
      settings: {},
    },
  ];

  // === Groups ===
  const _groups: Group[] = [
    { id: groupWb, stage_id: stageId, number: 1 },
    { id: groupLb, stage_id: stageId, number: 2 },
    { id: groupGf, stage_id: stageId, number: 3 },
  ];

  // === Rounds ===
  const rounds: Round[] = [];
  const roundIdByKey = new Map<string, string>();

  regularWbRounds.forEach((r, idx) => {
    const id = `${groupWb}-r${r}`;
    roundIdByKey.set(`wb:${r}`, id);
    rounds.push({
      id,
      stage_id: stageId,
      group_id: groupWb,
      number: idx + 1,
    });
  });
  lbRounds.forEach((r, idx) => {
    const id = `${groupLb}-r${Math.abs(r)}`;
    roundIdByKey.set(`lb:${r}`, id);
    rounds.push({
      id,
      stage_id: stageId,
      group_id: groupLb,
      number: idx + 1,
    });
  });
  if (gfRound > 0) {
    const id = `${groupGf}-r1`;
    roundIdByKey.set(`gf:${gfRound}`, id);
    rounds.push({
      id,
      stage_id: stageId,
      group_id: groupGf,
      number: 1,
    });
  }

  // === Participants ===
  // brackets-viewer attend des `Id` (string|number). On garde le `playerName`
  // en `id` pour matcher facilement avec les matches qui n'ont que des noms.
  const participantById = new Map<string, Participant>();
  const participantIdByName = new Map<string, string>();
  for (const p of participants) {
    if (!p.playerName) continue;
    const part: Participant = {
      id: p.id,
      tournament_id: tournament.id,
      name: p.playerName,
    };
    participantById.set(p.id, part);
    participantIdByName.set(p.playerName.toLowerCase(), p.id);
  }
  const participantsOut: Participant[] = [...participantById.values()];

  // === Matches ===
  const matchesOut: Match[] = [];
  let matchNumber = 0;
  for (const m of bracketMatches) {
    matchNumber += 1;
    let groupId: string;
    let roundKey: string;
    if (m.round > 0 && m.round === gfRound) {
      groupId = groupGf;
      roundKey = `gf:${m.round}`;
    } else if (m.round > 0) {
      groupId = groupWb;
      roundKey = `wb:${m.round}`;
    } else {
      groupId = groupLb;
      roundKey = `lb:${m.round}`;
    }
    const roundId = roundIdByKey.get(roundKey);
    if (!roundId) continue;

    const [s1, s2] = parseScore(m.score);
    const p1Id = m.player1Name ? participantIdByName.get(m.player1Name.toLowerCase()) : null;
    const p2Id = m.player2Name ? participantIdByName.get(m.player2Name.toLowerCase()) : null;
    const winnerId = m.winnerName ? participantIdByName.get(m.winnerName.toLowerCase()) : null;

    const status: Status =
      m.state === "complete"
        ? Status.Completed
        : m.state === "underway"
          ? Status.Running
          : Status.Ready;

    const opp1Result = winnerId && p1Id ? (winnerId === p1Id ? "win" : "loss") : undefined;
    const opp2Result = winnerId && p2Id ? (winnerId === p2Id ? "win" : "loss") : undefined;

    matchesOut.push({
      id: m.id,
      stage_id: stageId,
      group_id: groupId,
      round_id: roundId,
      number: matchNumber,
      child_count: 0,
      status,
      opponent1: p1Id
        ? {
            id: p1Id,
            score: s1 || undefined,
            ...(opp1Result ? { result: opp1Result } : {}),
          }
        : null,
      opponent2: p2Id
        ? {
            id: p2Id,
            score: s2 || undefined,
            ...(opp2Result ? { result: opp2Result } : {}),
          }
        : null,
    });
  }

  return {
    stages,
    participants: participantsOut,
    matches: matchesOut,
    matchGames: [],
  };
}
