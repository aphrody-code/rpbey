/**
 * Conversion Prisma -> ViewerData (`@rose-griffon/challonge-core`).
 *
 * Le schema Prisma rpb-dashboard n'expose pas encore de modeles `Stage` / `Match` /
 * `Participant` natifs `@rose-griffon/challonge-core`. Les fonctions ci-dessous sont des
 * STUBS typiquement invocables depuis une route API, pre-cables sur la forme attendue.
 *
 * TODO: wire to Prisma models suivants quand ils seront crees :
 *   - `Tournament` (id, name, type, settings JSON)
 *   - `TournamentStage` (id, tournament_id, type, settings JSON, number)
 *   - `TournamentMatch` (id, stage_id, group_id, round_id, number, status, opponents JSON)
 *   - `TournamentParticipant` (id, tournament_id, name)
 *
 * Cf. doc fork : https://github.com/rpbey/brackets-model
 */

import type {
	Id,
	Match,
	Participant,
	Stage,
	StageType,
	ViewerData,
} from "./types";
import { Status } from "./types";

/**
 * Forme minimale d'un tournoi cote DB (a remplacer par `Prisma.Tournament` une fois schema fige).
 */
export interface TournamentLike {
	id: Id;
	name: string;
	type: StageType;
	settings?: Stage["settings"];
}

/**
 * Forme minimale d'un participant cote DB (a remplacer par `Prisma.TournamentParticipant`).
 */
export interface ParticipantLike {
	id: Id;
	tournamentId: Id;
	name: string;
}

/**
 * Forme minimale d'un match cote DB (a remplacer par `Prisma.TournamentMatch`).
 */
export interface MatchLike {
	id: Id;
	stageId: Id;
	groupId: Id;
	roundId: Id;
	number: number;
	childCount?: number;
	status?: Status;
	opponent1?: {
		id: Id | null;
		score?: number;
		result?: "win" | "loss" | "draw";
		forfeit?: boolean;
	};
	opponent2?: {
		id: Id | null;
		score?: number;
		result?: "win" | "loss" | "draw";
		forfeit?: boolean;
	};
}

/**
 * Convertit un tournoi (entite DB-like) en `Stage` au format brackets-model.
 *
 * @param tournament Le tournoi a convertir.
 * @param number Numero du stage dans le tournoi (1 par defaut).
 */
export function tournamentToStage(
	tournament: TournamentLike,
	number = 1,
): Stage {
	return {
		id: tournament.id,
		tournament_id: tournament.id,
		name: tournament.name,
		type: tournament.type,
		number,
		settings: tournament.settings ?? {},
	};
}

/**
 * Convertit un participant (entite DB-like) en `Participant` brackets-model.
 */
export function participantLikeToParticipant(p: ParticipantLike): Participant {
	return {
		id: p.id,
		tournament_id: p.tournamentId,
		name: p.name,
	};
}

/**
 * Convertit un match (entite DB-like) en `Match` brackets-model.
 */
export function matchLikeToMatch(m: MatchLike): Match {
	return {
		id: m.id,
		stage_id: m.stageId,
		group_id: m.groupId,
		round_id: m.roundId,
		number: m.number,
		child_count: m.childCount ?? 0,
		status: m.status ?? Status.Locked,
		opponent1: m.opponent1
			? {
					id: m.opponent1.id,
					...(m.opponent1.score !== undefined && { score: m.opponent1.score }),
					...(m.opponent1.result !== undefined && {
						result: m.opponent1.result,
					}),
					...(m.opponent1.forfeit !== undefined && {
						forfeit: m.opponent1.forfeit,
					}),
				}
			: null,
		opponent2: m.opponent2
			? {
					id: m.opponent2.id,
					...(m.opponent2.score !== undefined && { score: m.opponent2.score }),
					...(m.opponent2.result !== undefined && {
						result: m.opponent2.result,
					}),
					...(m.opponent2.forfeit !== undefined && {
						forfeit: m.opponent2.forfeit,
					}),
				}
			: null,
	};
}

/**
 * Convertit (`tournament`, `participants[]`, `matches[]`) en `ViewerData` consommable directement par `<BracketsViewer>`.
 *
 * @example
 *   const data = tournamentToViewerData(t, parts, matches);
 *   <BracketsViewer data={data} />
 */
export function tournamentToViewerData(
	tournament: TournamentLike,
	participants: ParticipantLike[],
	matches: MatchLike[],
): ViewerData {
	return {
		stages: [tournamentToStage(tournament)],
		participants: participants.map(participantLikeToParticipant),
		matches: matches.map(matchLikeToMatch),
		matchGames: [],
	};
}

/**
 * Helper : convertit uniquement une liste de matchs DB-like quand `stages`/`participants`
 * sont deja disponibles ailleurs (ex. cache front).
 */
export function matchesToViewerData(
	stages: Stage[],
	participants: Participant[],
	matches: MatchLike[],
): ViewerData {
	return {
		stages,
		participants,
		matches: matches.map(matchLikeToMatch),
		matchGames: [],
	};
}
