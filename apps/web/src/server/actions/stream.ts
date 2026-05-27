'use server';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const TSH_STATE_FILE = '/root/TournamentStreamHelper/out/program_state.json';
const TSH_PLAYERS_FILE =
  '/root/TournamentStreamHelper/user_data/local_players.json';

// ─── Read current TSH state ───
export async function getStreamState() {
  try {
    if (!existsSync(TSH_STATE_FILE)) {
      return { ok: false as const, error: 'program_state.json introuvable' };
    }
    const raw = readFileSync(TSH_STATE_FILE, 'utf-8');
    const state = JSON.parse(raw);
    return { ok: true as const, state };
  } catch (e) {
    return {
      ok: false as const,
      error: `Erreur lecture: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── Update TSH state (partial merge) ───
export async function updateStreamState(updates: Record<string, unknown>) {
  try {
    let state: Record<string, unknown> = {};
    if (existsSync(TSH_STATE_FILE)) {
      state = JSON.parse(readFileSync(TSH_STATE_FILE, 'utf-8'));
    }

    // Deep merge score.1 updates
    if (updates.score) {
      const scoreUpdates = (updates.score as Record<string, unknown>)[
        '1'
      ] as Record<string, unknown>;
      if (scoreUpdates) {
        if (!state.score) state.score = { '1': {} };
        const s1 = (state.score as Record<string, unknown>)['1'] as Record<
          string,
          unknown
        >;

        // Merge team data
        if (scoreUpdates.team) {
          if (!s1.team) s1.team = {};
          const teamUpdates = scoreUpdates.team as Record<string, unknown>;
          for (const [teamKey, teamData] of Object.entries(teamUpdates)) {
            (s1.team as Record<string, unknown>)[teamKey] = {
              ...((s1.team as Record<string, unknown>)[teamKey] as Record<
                string,
                unknown
              >),
              ...(teamData as Record<string, unknown>),
            };

            // Deep merge player
            const td = teamData as Record<string, unknown>;
            if (td.player) {
              const existing = (
                (s1.team as Record<string, unknown>)[teamKey] as Record<
                  string,
                  unknown
                >
              ).player as Record<string, unknown>;
              for (const [pk, pv] of Object.entries(
                td.player as Record<string, unknown>,
              )) {
                if (!existing) break;
                existing[pk] = {
                  ...(existing[pk] as Record<string, unknown>),
                  ...(pv as Record<string, unknown>),
                };
              }
            }
          }
        }

        // Merge scalar fields
        for (const key of [
          'best_of',
          'first_to',
          'phase',
          'match',
          'best_of_text',
          'first_to_text',
        ]) {
          if (scoreUpdates[key] !== undefined) {
            s1[key] = scoreUpdates[key];
          }
        }
      }
    }

    // Merge tournament info
    if (updates.tournament) {
      state.tournament = {
        ...(state.tournament as Record<string, unknown>),
        ...(updates.tournament as Record<string, unknown>),
      };
    }

    writeFileSync(TSH_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: `Erreur écriture: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── Set match info (players + scores + round) ───
export async function setStreamMatch(data: {
  player1: string;
  player2: string;
  prefix1?: string;
  prefix2?: string;
  score1: number;
  score2: number;
  phase: string;
  match: string;
  bestOf: number;
}) {
  const firstTo = Math.ceil(data.bestOf / 2);
  return updateStreamState({
    score: {
      '1': {
        team: {
          '1': {
            player: {
              '1': {
                name: data.player1,
                prefix: data.prefix1 || '',
                country_code: 'FR',
              },
            },
            score: data.score1,
          },
          '2': {
            player: {
              '1': {
                name: data.player2,
                prefix: data.prefix2 || '',
                country_code: 'FR',
              },
            },
            score: data.score2,
          },
        },
        best_of: data.bestOf,
        best_of_text: `Best of ${data.bestOf}`,
        first_to: firstTo,
        first_to_text: `First to ${firstTo}`,
        phase: data.phase,
        match: data.match,
      },
    },
  });
}

// ─── Reset scores ───
export async function resetStreamScores() {
  return updateStreamState({
    score: {
      '1': {
        team: {
          '1': { score: 0 },
          '2': { score: 0 },
        },
      },
    },
  });
}

// ─── Swap players ───
export async function swapStreamPlayers() {
  const result = await getStreamState();
  if (!result.ok) return result;

  const s1 = result.state?.score?.['1'];
  if (!s1?.team)
    return { ok: false as const, error: 'Pas de données de match' };

  const team1 = { ...s1.team['1'] };
  const team2 = { ...s1.team['2'] };

  return updateStreamState({
    score: {
      '1': {
        team: {
          '1': { player: team2.player, score: team2.score, color: team2.color },
          '2': { player: team1.player, score: team1.score, color: team1.color },
        },
      },
    },
  });
}

// ─── Get player list from TSH ───
export async function getStreamPlayers(): Promise<{
  ok: boolean;
  players: string[];
}> {
  try {
    if (!existsSync(TSH_PLAYERS_FILE)) {
      return { ok: false, players: [] };
    }
    const raw = readFileSync(TSH_PLAYERS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const players = (data as Array<{ gamerTag?: string; prefix?: string }>).map(
      (p) => (p.prefix ? `${p.prefix} | ${p.gamerTag}` : p.gamerTag || ''),
    );
    return { ok: true, players: players.filter(Boolean).sort() };
  } catch {
    return { ok: false, players: [] };
  }
}

// ─── Check if TSH process is running ───
export async function getTshStatus(): Promise<{
  running: boolean;
  port: number;
  url: string;
}> {
  try {
    const res = await fetch('http://localhost:5000/', {
      signal: AbortSignal.timeout(2000),
    });
    return { running: res.ok, port: 5000, url: 'https://rpbey.fr/tsh/' };
  } catch {
    return { running: false, port: 5000, url: 'https://rpbey.fr/tsh/' };
  }
}
