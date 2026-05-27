/**
 * Donnees de demonstration pour la page showcase brackets.
 * 3 stages : round-robin (4 equipes), single elimination (8), double elimination (8).
 *
 * Format conforme `ViewerData` du fork rpbey/brackets-viewer.js.
 */

import type { Participant, ViewerData } from "./types";
import { Status } from "./types";

const TEAMS_8: Participant[] = [
	{ id: 1, tournament_id: 1, name: "Storm Pegasus" },
	{ id: 2, tournament_id: 1, name: "Lightning L-Drago" },
	{ id: 3, tournament_id: 1, name: "Galaxy Pegasus" },
	{ id: 4, tournament_id: 1, name: "Big Bang Pegasus" },
	{ id: 5, tournament_id: 1, name: "Meteo L-Drago" },
	{ id: 6, tournament_id: 1, name: "Earth Eagle" },
	{ id: 7, tournament_id: 1, name: "Rock Leone" },
	{ id: 8, tournament_id: 1, name: "Flame Sagittario" },
];

const TEAMS_4: Participant[] = TEAMS_8.slice(0, 4);

/**
 * Round-robin : 4 equipes, 1 groupe, chaque equipe joue contre chaque autre une fois.
 * 6 matchs au total, repartis sur 3 rounds (Berger tables).
 */
export const roundRobin: ViewerData = {
	stages: [
		{
			id: 1,
			tournament_id: 1,
			name: "Phase de poules",
			type: "round_robin",
			number: 1,
			settings: {
				size: 4,
				groupCount: 1,
				roundRobinMode: "simple",
				seedOrdering: ["groups.effort_balanced"],
			},
		},
	],
	participants: TEAMS_4,
	matchGames: [],
	matches: [
		// Round 1
		{
			id: 1,
			stage_id: 1,
			group_id: 1,
			round_id: 1,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, score: 3, result: "win" },
			opponent2: { id: 4, score: 1, result: "loss" },
		},
		{
			id: 2,
			stage_id: 1,
			group_id: 1,
			round_id: 1,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 2, score: 2, result: "win" },
			opponent2: { id: 3, score: 0, result: "loss" },
		},
		// Round 2
		{
			id: 3,
			stage_id: 1,
			group_id: 1,
			round_id: 2,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, score: 2, result: "win" },
			opponent2: { id: 3, score: 1, result: "loss" },
		},
		{
			id: 4,
			stage_id: 1,
			group_id: 1,
			round_id: 2,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 4, score: 1, result: "draw" },
			opponent2: { id: 2, score: 1, result: "draw" },
		},
		// Round 3
		{
			id: 5,
			stage_id: 1,
			group_id: 1,
			round_id: 3,
			number: 1,
			child_count: 0,
			status: Status.Running,
			opponent1: { id: 1, score: 1 },
			opponent2: { id: 2, score: 1 },
		},
		{
			id: 6,
			stage_id: 1,
			group_id: 1,
			round_id: 3,
			number: 2,
			child_count: 0,
			status: Status.Ready,
			opponent1: { id: 3 },
			opponent2: { id: 4 },
		},
	],
};

/**
 * Single elimination : 8 equipes, 1 bracket, 3 rounds (QF, SF, F).
 */
export const singleElimination: ViewerData = {
	stages: [
		{
			id: 2,
			tournament_id: 1,
			name: "Tableau principal",
			type: "single_elimination",
			number: 1,
			settings: {
				size: 8,
				seedOrdering: ["inner_outer"],
				consolationFinal: false,
			},
		},
	],
	participants: TEAMS_8,
	matchGames: [],
	matches: [
		// Quarter finals — group 2 (single bracket)
		{
			id: 10,
			stage_id: 2,
			group_id: 2,
			round_id: 4,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, position: 1, score: 2, result: "win" },
			opponent2: { id: 8, position: 8, score: 0, result: "loss" },
		},
		{
			id: 11,
			stage_id: 2,
			group_id: 2,
			round_id: 4,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 4, position: 4, score: 1, result: "loss" },
			opponent2: { id: 5, position: 5, score: 2, result: "win" },
		},
		{
			id: 12,
			stage_id: 2,
			group_id: 2,
			round_id: 4,
			number: 3,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 3, position: 3, score: 2, result: "win" },
			opponent2: { id: 6, position: 6, score: 1, result: "loss" },
		},
		{
			id: 13,
			stage_id: 2,
			group_id: 2,
			round_id: 4,
			number: 4,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 2, position: 2, score: 2, result: "win" },
			opponent2: { id: 7, position: 7, score: 0, result: "loss" },
		},
		// Semi finals
		{
			id: 14,
			stage_id: 2,
			group_id: 2,
			round_id: 5,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, score: 2, result: "win" },
			opponent2: { id: 5, score: 1, result: "loss" },
		},
		{
			id: 15,
			stage_id: 2,
			group_id: 2,
			round_id: 5,
			number: 2,
			child_count: 0,
			status: Status.Running,
			opponent1: { id: 3, score: 1 },
			opponent2: { id: 2, score: 0 },
		},
		// Final
		{
			id: 16,
			stage_id: 2,
			group_id: 2,
			round_id: 6,
			number: 1,
			child_count: 0,
			status: Status.Waiting,
			opponent1: { id: 1 },
			opponent2: null,
		},
	],
};

/**
 * Double elimination : 8 equipes, WB + LB + Grand Final simple.
 */
export const doubleElimination: ViewerData = {
	stages: [
		{
			id: 3,
			tournament_id: 1,
			name: "Tableau double elimination",
			type: "double_elimination",
			number: 1,
			settings: {
				size: 8,
				seedOrdering: ["inner_outer", "natural"],
				grandFinal: "simple",
			},
		},
	],
	participants: TEAMS_8,
	matchGames: [],
	matches: [
		// WB Round 1 (group 3 = winner bracket)
		{
			id: 20,
			stage_id: 3,
			group_id: 3,
			round_id: 7,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, position: 1, score: 2, result: "win" },
			opponent2: { id: 8, position: 8, score: 0, result: "loss" },
		},
		{
			id: 21,
			stage_id: 3,
			group_id: 3,
			round_id: 7,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 4, position: 4, score: 1, result: "loss" },
			opponent2: { id: 5, position: 5, score: 2, result: "win" },
		},
		{
			id: 22,
			stage_id: 3,
			group_id: 3,
			round_id: 7,
			number: 3,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 3, position: 3, score: 2, result: "win" },
			opponent2: { id: 6, position: 6, score: 0, result: "loss" },
		},
		{
			id: 23,
			stage_id: 3,
			group_id: 3,
			round_id: 7,
			number: 4,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 2, position: 2, score: 2, result: "win" },
			opponent2: { id: 7, position: 7, score: 1, result: "loss" },
		},
		// WB Round 2 (semi)
		{
			id: 24,
			stage_id: 3,
			group_id: 3,
			round_id: 8,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 1, score: 2, result: "win" },
			opponent2: { id: 5, score: 0, result: "loss" },
		},
		{
			id: 25,
			stage_id: 3,
			group_id: 3,
			round_id: 8,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 3, score: 1, result: "loss" },
			opponent2: { id: 2, score: 2, result: "win" },
		},
		// WB Final
		{
			id: 26,
			stage_id: 3,
			group_id: 3,
			round_id: 9,
			number: 1,
			child_count: 0,
			status: Status.Running,
			opponent1: { id: 1, score: 1 },
			opponent2: { id: 2, score: 1 },
		},
		// LB Round 1 (group 4 = loser bracket)
		{
			id: 30,
			stage_id: 3,
			group_id: 4,
			round_id: 10,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 8, score: 0, result: "loss" },
			opponent2: { id: 4, score: 2, result: "win" },
		},
		{
			id: 31,
			stage_id: 3,
			group_id: 4,
			round_id: 10,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 6, score: 1, result: "loss" },
			opponent2: { id: 7, score: 2, result: "win" },
		},
		// LB Round 2
		{
			id: 32,
			stage_id: 3,
			group_id: 4,
			round_id: 11,
			number: 1,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 4, score: 2, result: "win" },
			opponent2: { id: 5, score: 0, result: "loss" },
		},
		{
			id: 33,
			stage_id: 3,
			group_id: 4,
			round_id: 11,
			number: 2,
			child_count: 0,
			status: Status.Completed,
			opponent1: { id: 7, score: 1, result: "loss" },
			opponent2: { id: 3, score: 2, result: "win" },
		},
		// LB Round 3
		{
			id: 34,
			stage_id: 3,
			group_id: 4,
			round_id: 12,
			number: 1,
			child_count: 0,
			status: Status.Ready,
			opponent1: { id: 4 },
			opponent2: { id: 3 },
		},
		// LB Final (waiting on round 3)
		{
			id: 35,
			stage_id: 3,
			group_id: 4,
			round_id: 13,
			number: 1,
			child_count: 0,
			status: Status.Locked,
			opponent1: null,
			opponent2: null,
		},
		// Grand Final (group 5 = final group)
		{
			id: 40,
			stage_id: 3,
			group_id: 5,
			round_id: 14,
			number: 1,
			child_count: 0,
			status: Status.Locked,
			opponent1: null,
			opponent2: null,
		},
	],
};

/**
 * Helper barrel : tous les jeux de demo dans un objet.
 */
export const mock = {
	roundRobin,
	singleElimination,
	doubleElimination,
} as const;

export type MockKey = keyof typeof mock;
