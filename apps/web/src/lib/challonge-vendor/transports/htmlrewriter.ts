/**
 * Transport HTMLRewriter — extraction zero-dépendance d'un tournoi Challonge
 * depuis sa page publique `/module`. Aucune clé API ni Puppeteer requis.
 *
 * Utilise `Bun.HTMLRewriter` (https://bun.com/docs/runtime/html-rewriter) en
 * streaming sur le HTML brut. Couvre :
 *   1. Phase de poules (round-robin) — standings + match-history dans
 *      `<table.standings>` (groupes A, B, …, F + matches reconstruits).
 *   2. Bracket SVG (final-stage / single-elim / double-elim) — parsing du
 *      `<g class="match">` avec `data-match-id`, `data-participant-id`,
 *      seeds, scores, classes `-winner`. Round inferé depuis la coordonnée X
 *      du SVG (Challonge aligne les rounds verticalement). Bracket side
 *      (WB/LB/GF) inferé depuis Y pour les tournois double-elim.
 *
 * Limites :
 *   - Bun-only : `HTMLRewriter` est un global Bun (cf. `bun-augments.d.ts`).
 *   - IDs participants : synthétiques pour les groupes (le HTML standings ne
 *     renvoie pas l'id Challonge), mais RÉELS pour les participants vus dans
 *     le bracket SVG (`data-participant-id`).
 *   - Sets non disponibles côté HTML — on utilise le score affiché comme set
 *     unique `[s1, s2]`.
 *
 * Usage :
 *   import { fetchAndParseModule } from "@rose-griffon/challonge/htmlrewriter";
 *   const scraped = await fetchAndParseModule("T_SS1");
 *   // scraped est un ScrapedTournament canonique compatible `toCanonical()`.
 */

import type {
	ScrapedMatch,
	ScrapedParticipant,
	ScrapedTournament,
	ScrapedTournamentMetadata,
} from "../types";

interface MatchHistoryEntry {
	matchId: string;
	matchState: string;
	result: "W" | "L" | "?";
}

interface GroupParticipant {
	rank: number | null;
	displayName: string;
	challongeUsername: string | null;
	portraitUrl: string | null;
	advanced: boolean;
	wins: number;
	losses: number;
	ties: number;
	tb: number;
	setWins: number;
	setTies: number;
	pts: number;
	matchHistory: MatchHistoryEntry[];
}

interface GroupData {
	name: string;
	participants: GroupParticipant[];
}

/**
 * Match issu du bracket SVG `<g class="match">` (final-stage / single-elim /
 * double-elim). Plus riche que `rawMatches` (ids natifs Challonge).
 */
export interface BracketMatch {
	matchId: number;
	identifier: string;
	state: "complete" | "open" | "pending" | string;
	/** Y du `<g transform="translate(X Y)">` — sert à grouper par round. */
	x: number;
	y: number;
	player1: BracketPlayer | null;
	player2: BracketPlayer | null;
}

export interface BracketPlayer {
	participantId: number | null;
	name: string;
	seed: number | null;
	score: number | null;
	winner: boolean;
}

export interface HtmlRewriterModuleData {
	slug: string;
	tournamentName: string | null;
	tournamentType: string | null;
	groups: GroupData[];
	rawMatches: Array<{
		matchId: string;
		groupName: string;
		state: string;
		winnerName?: string;
		loserName?: string;
	}>;
	bracketMatches: BracketMatch[];
}

const MODULE_URL = (slug: string): string =>
	`https://challonge.com/${encodeURIComponent(slug)}/module`;

export interface FetchAndParseOptions {
	signal?: AbortSignal;
	/** Fournit le HTML directement (utile en tests/debug — pas de fetch réseau). */
	htmlOverride?: string;
	/** Logger optionnel. */
	log?: (msg: string) => void;
	/** User-Agent HTTP custom. Default : RPB-Bracket-Importer. */
	userAgent?: string;
}

const DEFAULT_UA =
	"Mozilla/5.0 (compatible; RPB-Bracket-Importer/2; +https://rpbey.fr)";

/**
 * Fetch + parse la page `/module` Challonge sans clé API.
 *
 * Retourne la donnée intermédiaire (groupes + matchs) — voir
 * `parseModuleToScrapedTournament()` pour la projection vers `ScrapedTournament`.
 */
export async function fetchAndParseModule(
	slug: string,
	options: FetchAndParseOptions = {},
): Promise<HtmlRewriterModuleData> {
	let html: string;
	if (options.htmlOverride) {
		html = options.htmlOverride;
	} else {
		const url = MODULE_URL(slug);
		options.log?.(`[challonge:htmlrewriter] GET ${url}`);
		const res = await fetch(url, {
			signal: options.signal,
			headers: {
				"user-agent": options.userAgent ?? DEFAULT_UA,
				accept: "text/html,application/xhtml+xml",
			},
		});
		if (!res.ok) {
			throw new Error(
				`Challonge HTML fetch failed (HTTP ${res.status}) for ${slug}`,
			);
		}
		html = await res.text();
	}

	const groups: GroupData[] = [];
	let currentGroup: GroupData | null = null;
	let inGroupStandingsPane = false;
	let inStandingsTable = false;
	let inTbody = false;
	let currentRow: GroupParticipant | null = null;
	let cellIndex = -1;
	let currentCellText: string[] = [];
	let inMatchHistoryCell = false;
	let tournamentName: string | null = null;
	let tournamentType: string | null = null;

	// === Bracket SVG state (final-stage / single-elim / double-elim) ===
	const bracketMatches: BracketMatch[] = [];
	let currentMatch: BracketMatch | null = null;
	let currentPlayer: BracketPlayer | null = null;
	let inPlayerName = false;
	let inPlayerScore = false;
	let inPlayerSeed = false;
	const playerNameBuf: string[] = [];
	const playerScoreBuf: string[] = [];
	const playerSeedBuf: string[] = [];

	const parseTransform = (val: string | null): { x: number; y: number } => {
		const m = val?.match(/translate\(([\-\d.]+)\s+([\-\d.]+)\)/);
		return {
			x: m ? parseFloat(m[1]!) : 0,
			y: m ? parseFloat(m[2]!) : 0,
		};
	};

	const flushCell = (): void => {
		if (!currentRow) return;
		const text = currentCellText.join(" ").replace(/\s+/g, " ").trim();
		switch (cellIndex) {
			case 0:
				currentRow.rank = parseInt(text, 10) || null;
				break;
			case 1: {
				const advanced = /\bAdvanced\b/i.test(text);
				const cleaned = text
					.replace(/\bAdvanced\b/i, "")
					.replace(/✅|❌/g, "")
					.trim();
				const m = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
				if (m) {
					currentRow.displayName = m[1]!.trim();
					currentRow.challongeUsername = m[2]!.trim();
				} else {
					currentRow.displayName = cleaned;
				}
				currentRow.advanced = advanced;
				break;
			}
			case 2: {
				const m = text.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
				if (m) {
					currentRow.wins = parseInt(m[1]!, 10);
					currentRow.losses = parseInt(m[2]!, 10);
					currentRow.ties = parseInt(m[3]!, 10);
				}
				break;
			}
			case 3:
				currentRow.tb = parseInt(text, 10) || 0;
				break;
			case 4:
				currentRow.setWins = parseInt(text, 10) || 0;
				break;
			case 5:
				currentRow.setTies = parseInt(text, 10) || 0;
				break;
			case 6:
				currentRow.pts = parseInt(text, 10) || 0;
				break;
		}
		currentCellText = [];
	};

	const rewriter = new HTMLRewriter()
		.on('meta[property="og:title"]', {
			element(el) {
				const content = el.getAttribute("content") ?? "";
				if (!content) return;
				tournamentName =
					content.replace(/\s*[-—–]\s*Challonge\s*$/i, "").trim() || null;
			},
		})
		.on("[data-tournament-type]", {
			element(el) {
				if (tournamentType) return;
				tournamentType = el.getAttribute("data-tournament-type");
			},
		})
		.on("li.group-name", {
			text(t) {
				const name = t.text.trim();
				if (!name) return;
				if (currentGroup) groups.push(currentGroup);
				currentGroup = { name, participants: [] };
			},
		})
		.on("div.group-standings-pane", {
			element(el) {
				inGroupStandingsPane = true;
				el.onEndTag(() => {
					inGroupStandingsPane = false;
				});
			},
		})
		.on("table.standings", {
			element(el) {
				if (!inGroupStandingsPane) return;
				inStandingsTable = true;
				el.onEndTag(() => {
					inStandingsTable = false;
				});
			},
		})
		.on("tbody", {
			element(el) {
				if (!inStandingsTable) return;
				inTbody = true;
				el.onEndTag(() => {
					inTbody = false;
				});
			},
		})
		.on("tr", {
			element(el) {
				if (!inStandingsTable || !inTbody || !currentGroup) return;
				currentRow = {
					rank: null,
					displayName: "",
					challongeUsername: null,
					portraitUrl: null,
					advanced: false,
					wins: 0,
					losses: 0,
					ties: 0,
					tb: 0,
					setWins: 0,
					setTies: 0,
					pts: 0,
					matchHistory: [],
				};
				cellIndex = -1;
				el.onEndTag(() => {
					if (currentGroup && currentRow) {
						currentGroup.participants.push(currentRow);
					}
					currentRow = null;
					cellIndex = -1;
				});
			},
		})
		.on("td", {
			element(el) {
				if (!inStandingsTable || !inTbody || !currentRow) return;
				cellIndex += 1;
				currentCellText = [];
				const cls = el.getAttribute("class") ?? "";
				inMatchHistoryCell = cls.includes("match-history");
				el.onEndTag(() => {
					flushCell();
					inMatchHistoryCell = false;
				});
			},
			text(t) {
				if (!inStandingsTable || !inTbody || !currentRow) return;
				if (inMatchHistoryCell) return;
				if (t.text.trim()) currentCellText.push(t.text);
			},
		})
		.on("img.portrait", {
			element(el) {
				if (!inStandingsTable || !inTbody || !currentRow) return;
				if (cellIndex !== 1) return;
				currentRow.portraitUrl = el.getAttribute("src") ?? null;
			},
		})
		.on("a.match-report", {
			element(el) {
				if (!inStandingsTable || !inTbody || !currentRow) return;
				if (!inMatchHistoryCell) return;
				const matchId = el.getAttribute("data-match-id") ?? "";
				if (!matchId) return;
				currentRow.matchHistory.push({
					matchId,
					matchState: el.getAttribute("data-match-state") ?? "",
					result: "?",
				});
			},
		})
		.on("a.match-report div.trend-box", {
			element(el) {
				if (!inStandingsTable || !inTbody || !currentRow) return;
				if (!inMatchHistoryCell) return;
				const cls = el.getAttribute("class") ?? "";
				const last =
					currentRow.matchHistory[currentRow.matchHistory.length - 1];
				if (!last) return;
				if (cls.includes("-win")) last.result = "W";
				else if (cls.includes("-loss")) last.result = "L";
			},
		})
		// === Bracket SVG handlers ===
		.on("g.match", {
			element(el) {
				const matchId = parseInt(el.getAttribute("data-match-id") ?? "0", 10);
				if (!matchId) return;
				const cls = el.getAttribute("class") ?? "";
				const stateMatch = cls.match(/\s-(complete|open|pending|locked)\b/);
				const transform = parseTransform(el.getAttribute("transform"));
				currentMatch = {
					matchId,
					identifier: el.getAttribute("data-identifier") ?? "",
					state: stateMatch ? stateMatch[1]! : "pending",
					x: transform.x,
					y: transform.y,
					player1: null,
					player2: null,
				};
				el.onEndTag(() => {
					if (currentMatch) bracketMatches.push(currentMatch);
					currentMatch = null;
				});
			},
		})
		.on("svg.match--player", {
			element(el) {
				if (!currentMatch) return;
				const pid = parseInt(el.getAttribute("data-participant-id") ?? "", 10);
				currentPlayer = {
					participantId: Number.isFinite(pid) ? pid : null,
					name: "",
					seed: null,
					score: null,
					winner: false,
				};
				el.onEndTag(() => {
					if (!currentMatch || !currentPlayer) return;
					if (!currentMatch.player1) currentMatch.player1 = currentPlayer;
					else if (!currentMatch.player2) currentMatch.player2 = currentPlayer;
					currentPlayer = null;
				});
			},
		})
		.on("text.match--seed", {
			element(el) {
				if (!currentPlayer) return;
				inPlayerSeed = true;
				playerSeedBuf.length = 0;
				el.onEndTag(() => {
					inPlayerSeed = false;
					if (currentPlayer) {
						const seed = parseInt(playerSeedBuf.join("").trim(), 10);
						currentPlayer.seed = Number.isFinite(seed) ? seed : null;
					}
				});
			},
			text(t) {
				if (inPlayerSeed && t.text) playerSeedBuf.push(t.text);
			},
		})
		.on('text[class^="match--player-name"]', {
			element(el) {
				if (!currentPlayer) return;
				inPlayerName = true;
				playerNameBuf.length = 0;
				const cls = el.getAttribute("class") ?? "";
				if (cls.includes("-winner") && currentPlayer) {
					currentPlayer.winner = true;
				}
				el.onEndTag(() => {
					inPlayerName = false;
					if (currentPlayer) {
						currentPlayer.name = playerNameBuf
							.join("")
							.replace(/✅|❌/g, "")
							.replace(/\s+/g, " ")
							.trim();
					}
				});
			},
			text(t) {
				if (inPlayerName && t.text) playerNameBuf.push(t.text);
			},
		})
		.on('text[class^="match--player-score"]', {
			element(el) {
				if (!currentPlayer) return;
				inPlayerScore = true;
				playerScoreBuf.length = 0;
				el.onEndTag(() => {
					inPlayerScore = false;
					if (currentPlayer) {
						const raw = playerScoreBuf.join("").trim();
						const n = parseInt(raw, 10);
						currentPlayer.score = Number.isFinite(n) ? n : null;
					}
				});
			},
			text(t) {
				if (inPlayerScore && t.text) playerScoreBuf.push(t.text);
			},
		});

	await rewriter.transform(new Response(html)).text();
	if (currentGroup) groups.push(currentGroup);

	const matchById = new Map<
		string,
		{
			groupName: string;
			winnerName?: string;
			loserName?: string;
			state: string;
		}
	>();
	for (const g of groups) {
		for (const p of g.participants) {
			for (const m of p.matchHistory) {
				const cur = matchById.get(m.matchId) ?? {
					groupName: g.name,
					state: m.matchState,
				};
				if (m.result === "W") cur.winnerName = p.displayName;
				if (m.result === "L") cur.loserName = p.displayName;
				matchById.set(m.matchId, cur);
			}
		}
	}

	return {
		slug,
		tournamentName,
		tournamentType,
		groups,
		rawMatches: [...matchById.entries()].map(([matchId, m]) => ({
			matchId,
			...m,
		})),
		bracketMatches,
	};
}

/**
 * Projette un `HtmlRewriterModuleData` (fetch interne) vers la forme canonique
 * `ScrapedTournament` du package — directement consommable par les helpers
 * existants (toCanonical déjà appliqué).
 *
 * IDs : participants auto-incrémentés (1..N), matches conservent l'id Challonge
 * réel (parsé depuis `data-match-id`).
 *
 * Sets : non disponibles côté HTML public — on synthétise `[1, 0]` (W) /
 * `[0, 1]` (L) pour que `setsToScore()` retourne 1/0 dans les viewers en aval.
 */
export function parseModuleToScrapedTournament(
	data: HtmlRewriterModuleData,
): ScrapedTournament {
	const participantIdByName = new Map<string, number>();
	const allParticipants: ScrapedParticipant[] = [];
	let nextId = 1;
	let totalParticipants = 0;

	for (const g of data.groups) {
		for (const p of g.participants) {
			totalParticipants++;
			if (participantIdByName.has(p.displayName)) continue;
			const id = nextId++;
			participantIdByName.set(p.displayName, id);
			allParticipants.push({
				id,
				name: p.displayName,
				seed: p.rank ?? 0,
				challongeUsername: p.challongeUsername,
				challongeProfileUrl: p.challongeUsername
					? `https://challonge.com/users/${p.challongeUsername}`
					: null,
				challongeUserId: null,
				emailHash: null,
				portraitUrl: p.portraitUrl ?? null,
				finalRank: p.rank,
				clinched: p.advanced,
				metadata: null,
			});
		}
	}

	const matches: ScrapedMatch[] = data.rawMatches.map((m) => {
		const winnerId = m.winnerName
			? (participantIdByName.get(m.winnerName) ?? null)
			: null;
		const loserId = m.loserName
			? (participantIdByName.get(m.loserName) ?? null)
			: null;
		const sets: Array<[number, number]> =
			winnerId && loserId
				? [winnerId === Number(m.matchId) ? [1, 0] : [1, 0]]
				: [];
		return {
			id: parseInt(m.matchId, 10) || 0,
			identifier: "",
			round: 1,
			bracketSide: "RR",
			player1Id: winnerId,
			player2Id: loserId,
			winnerId,
			loserId,
			scores: winnerId && loserId ? "1-0" : "",
			sets,
			state: m.state || "complete",
			forfeited: null,
			optional: null,
			startedAt: null,
			underwayAt: null,
			completedAt: null,
			createdAt: null,
			updatedAt: null,
			attachmentCount: null,
			hasAttachment: null,
			suggestedPlayOrder: null,
			groupId: null,
		};
	});

	// === Bracket SVG matches (final-stage / single-elim / double-elim) ===
	// Round inferé depuis la coordonnée X du SVG (Challonge align les rounds
	// verticalement par colonne X). Bracket side inferé depuis Y :
	// y < 400 = Winners Bracket (haut), y > 400 = Losers Bracket (bas) — heuristique
	// qui marche pour les double-elim Challonge standards.
	const bracketEnabled = data.bracketMatches.length > 0;
	if (bracketEnabled) {
		const xPositions = [
			...new Set(data.bracketMatches.map((b) => Math.round(b.x))),
		].sort((a, b) => a - b);
		const xToRound = new Map<number, number>();
		xPositions.forEach((x, i) => xToRound.set(x, i + 1));

		// Inscription des participants présents uniquement dans le bracket
		// (les vrais ids Challonge ne matchent pas les ids synth des groupes).
		const bracketParticipantIds = new Set<number>();
		for (const bm of data.bracketMatches) {
			for (const p of [bm.player1, bm.player2]) {
				if (!p?.participantId || !p.name) continue;
				if (bracketParticipantIds.has(p.participantId)) continue;
				bracketParticipantIds.add(p.participantId);
				if (allParticipants.find((a) => a.id === p.participantId)) continue;
				allParticipants.push({
					id: p.participantId,
					name: p.name,
					seed: p.seed ?? 0,
					challongeUsername: null,
					challongeProfileUrl: null,
					challongeUserId: null,
					emailHash: null,
					portraitUrl: null,
					finalRank: null,
					clinched: false,
					metadata: null,
				});
			}
		}

		const isDoubleElim = (data.tournamentType ?? "")
			.toLowerCase()
			.includes("double");
		const yMid =
			data.bracketMatches.reduce((sum, b) => sum + b.y, 0) /
				Math.max(1, data.bracketMatches.length) || 0;

		for (const bm of data.bracketMatches) {
			const round = xToRound.get(Math.round(bm.x)) ?? 1;
			const isLB = isDoubleElim && bm.y > yMid;
			const winnerSide =
				bm.player1?.winner && bm.player1.participantId
					? bm.player1.participantId
					: bm.player2?.winner && bm.player2.participantId
						? bm.player2.participantId
						: null;
			const loserSide =
				winnerSide && bm.player1?.participantId === winnerSide
					? (bm.player2?.participantId ?? null)
					: winnerSide
						? (bm.player1?.participantId ?? null)
						: null;

			const s1 = bm.player1?.score ?? null;
			const s2 = bm.player2?.score ?? null;
			const sets: Array<[number, number]> =
				s1 !== null && s2 !== null ? [[s1, s2]] : [];

			matches.push({
				id: bm.matchId,
				identifier: bm.identifier,
				round: isLB ? -round : round,
				bracketSide: isLB
					? "LB"
					: isDoubleElim && round === xPositions.length
						? "GF"
						: "WB",
				player1Id: bm.player1?.participantId ?? null,
				player2Id: bm.player2?.participantId ?? null,
				winnerId: winnerSide,
				loserId: loserSide,
				scores: s1 !== null && s2 !== null ? `${s1}-${s2}` : "",
				sets,
				state: bm.state || "pending",
				forfeited: null,
				optional: null,
				startedAt: null,
				underwayAt: null,
				completedAt: null,
				createdAt: null,
				updatedAt: null,
				attachmentCount: null,
				hasAttachment: null,
				suggestedPlayOrder: null,
				groupId: null,
			});
		}
	}

	const metadata: ScrapedTournamentMetadata = {
		id: 0,
		name: data.tournamentName ?? data.slug,
		url: `https://challonge.com/${data.slug}`,
		state: "underway",
		type: data.tournamentType ?? "round robin",
		participantsCount: totalParticipants,
		startedAt: null,
		completedAt: null,
		game: null,
		subdomain: null,
	};

	return {
		metadata,
		participants: allParticipants,
		matches,
		standings: [],
		stations: [],
		log: [],
		raw: data,
	};
}

/**
 * One-shot helper : fetch + parse + projette en `ScrapedTournament` direct.
 * Equivalent à `parseModuleToScrapedTournament(await fetchAndParseModule(slug))`.
 */
export async function fetchAndParseAsScrapedTournament(
	slug: string,
	options: FetchAndParseOptions = {},
): Promise<ScrapedTournament> {
	const data = await fetchAndParseModule(slug, options);
	return parseModuleToScrapedTournament(data);
}

/**
 * Tente de récupérer le JSON public Challonge via la route `/{slug}.json`.
 * Cette route renvoie souvent (mais pas toujours) le tournoi sérialisé en JSON
 * — utile pour double-elimination quand l'API v1 nécessite une clé.
 *
 * Retourne `null` si la route renvoie HTML (route non publique pour ce tournoi).
 *
 * @example
 *   const json = await fetchPublicTournamentJson("B_TS4");
 *   if (json) {
 *     // json.matches[], json.participants[], json.tournament_type, …
 *   }
 */
export async function fetchPublicTournamentJson(
	slug: string,
	options: { signal?: AbortSignal; userAgent?: string } = {},
): Promise<unknown | null> {
	const url = `https://challonge.com/${encodeURIComponent(slug)}.json`;
	const res = await fetch(url, {
		signal: options.signal,
		headers: {
			"user-agent": options.userAgent ?? DEFAULT_UA,
			accept: "application/json",
		},
	});
	if (!res.ok) return null;
	const ct = res.headers.get("content-type") ?? "";
	if (!ct.includes("json")) return null;
	try {
		return await res.json();
	} catch {
		return null;
	}
}
