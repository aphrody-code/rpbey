/**
 * battle-engine.ts — Unified Battle Engine for RPB Bot
 *
 * Consolidates the three combat engines:
 *   - "beyblade-x"  : Full physics sim with HP, stamina drain, burst, xtreme dash,
 *                     weight advantage, multi-round (from GameGroup.ts)
 *   - "tcg-duel"    : TCG card duel with elements, rarity, special moves, momentum,
 *                     3-round Best-of-3 (from DuelCommand.ts)
 *   - "quick-battle": Single-score battle with type advantage, crit, xdash, finish
 *                     types (from battle-utils.ts runBattleSimulation)
 *
 * IMPORTANT: All numerical constants are PRESERVED EXACTLY from their source files.
 * Zero re-balancing. Only extraction and parameterization.
 */

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type BattleVariant = "beyblade-x" | "tcg-duel" | "quick-battle";

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "beyblade-x" — Full Beyblade X physics simulation
// Source: commands/General/GameGroup.ts → simulateBattle()
// ═══════════════════════════════════════════════════════════════════════════════

export interface BbxComboStats {
	attack: number;
	defense: number;
	stamina: number;
	dash: number;
	burst: number;
	weight: number;
}

export interface BbxBattleLog {
	phase: string;
	text: string;
}

const BBX_FINISH_TYPES = [
	{ result: "xtreme", message: "⚡ X-TREME FINISH !", points: 3, emoji: "⚡" },
	{ result: "burst", message: "💥 BURST FINISH !", points: 2, emoji: "💥" },
	{ result: "over", message: "🔄 OVER FINISH !", points: 2, emoji: "🔄" },
	{ result: "spin", message: "🌀 SPIN FINISH !", points: 1, emoji: "🌀" },
] as const;

export type BbxFinishType = (typeof BBX_FINISH_TYPES)[number];

export interface BbxBattleResult {
	winner: "A" | "B";
	finishType: BbxFinishType;
	hpA: number;
	hpB: number;
	maxHp: number;
	log: BbxBattleLog[];
	rounds: number;
}

/**
 * Type advantage multiplier for Beyblade X:
 * 1.25 = advantage, 0.8 = disadvantage, 1.0 = neutral
 * Attack > Stamina > Defense > Attack; Balance = neutral
 */
function bbxTypeMatchup(
	attacker: string | null,
	defender: string | null,
): number {
	const a = attacker || "BALANCE";
	const d = defender || "BALANCE";
	if (a === d) return 1.0;
	if (a === "BALANCE" || d === "BALANCE") return 1.0;
	if (a === "ATTACK" && d === "STAMINA") return 1.25;
	if (a === "STAMINA" && d === "DEFENSE") return 1.25;
	if (a === "DEFENSE" && d === "ATTACK") return 1.25;
	return 0.8; // disadvantage
}

/**
 * Full Beyblade X battle simulation.
 * Preserves all constants from GameGroup.ts:
 * - maxHp = 200, MAX_ROUNDS = 12
 * - endurance: 50 + sta*1.2 + def*0.3 + weight*0.15
 * - burstRes: burst + def*0.5 + weight*0.2
 * - launch advantage: dash*0.8 + rand*15, threshold *1.3
 * - attack: rawAtk - def*0.3*(0.7+rand*0.6), floor 2
 * - weight knockback: if |diff|>3 → diff*0.5
 * - critical: 10% + atk*0.001 → +12..20 PV
 * - stamina drain: max(1, 8 - sta*0.08)
 * - burst trigger: hp < 35% and rand < rawAtk*0.01 - burstRes*0.005 + 0.05
 * - xtreme: accumulate dash*0.003, on trigger → 30 + dash*0.5
 * - finish: loserHp<=-5 → (dash>30 && rand<0.5 ? xtreme : burst); rounds>=10 → spin; else over
 */
export function simulateBbxBattle(
	sA: BbxComboStats,
	typeA: string | null,
	sB: BbxComboStats,
	typeB: string | null,
	nameA: string,
	nameB: string,
): BbxBattleResult {
	const log: BbxBattleLog[] = [];
	const MAX_ROUNDS = 12;
	const maxHp = 200;
	let hpA = maxHp;
	let hpB = maxHp;

	const enduranceA =
		50 + sA.stamina * 1.2 + sA.defense * 0.3 + sA.weight * 0.15;
	const enduranceB =
		50 + sB.stamina * 1.2 + sB.defense * 0.3 + sB.weight * 0.15;
	const burstResA = sA.burst + sA.defense * 0.5 + sA.weight * 0.2;
	const burstResB = sB.burst + sB.defense * 0.5 + sB.weight * 0.2;

	// Phase 2: Launch
	const launchA = sA.dash * 0.8 + Math.random() * 15;
	const launchB = sB.dash * 0.8 + Math.random() * 15;
	if (launchA > launchB * 1.3) {
		const dmg = 15 + Math.random() * 10;
		hpB -= dmg;
		log.push({
			phase: "Lancement",
			text: `${nameA} prend l'avantage au lancement ! (-${Math.round(dmg)} PV)`,
		});
	} else if (launchB > launchA * 1.3) {
		const dmg = 15 + Math.random() * 10;
		hpA -= dmg;
		log.push({
			phase: "Lancement",
			text: `${nameB} domine le lancement ! (-${Math.round(dmg)} PV)`,
		});
	} else {
		log.push({
			phase: "Lancement",
			text: "Lancement équilibré, les deux toupies entrent en collision !",
		});
	}

	// Phase 3: Combat rounds
	let round = 0;
	let xtremeChanceA = 0;
	let xtremeChanceB = 0;

	while (hpA > 0 && hpB > 0 && round < MAX_ROUNDS) {
		round++;
		const matchA = bbxTypeMatchup(typeA, typeB);
		const matchB = bbxTypeMatchup(typeB, typeA);
		const rawAtkA = sA.attack * matchA * (0.8 + Math.random() * 0.4);
		const rawAtkB = sB.attack * matchB * (0.8 + Math.random() * 0.4);
		const dmgToB = Math.max(
			2,
			rawAtkA - sB.defense * 0.3 * (0.7 + Math.random() * 0.6),
		);
		const dmgToA = Math.max(
			2,
			rawAtkB - sA.defense * 0.3 * (0.7 + Math.random() * 0.6),
		);
		const weightDiff = sA.weight - sB.weight;
		const knockbackA = weightDiff > 3 ? weightDiff * 0.5 : 0;
		const knockbackB = weightDiff < -3 ? Math.abs(weightDiff) * 0.5 : 0;
		hpB -= dmgToB + knockbackA;
		hpA -= dmgToA + knockbackB;

		if (Math.random() < 0.1 + sA.attack * 0.001) {
			const critDmg = 12 + Math.random() * 8;
			hpB -= critDmg;
			log.push({
				phase: `Tour ${round}`,
				text: `💥 ${nameA} place un coup critique ! (-${Math.round(critDmg)} PV supplémentaires)`,
			});
		}
		if (Math.random() < 0.1 + sB.attack * 0.001) {
			const critDmg = 12 + Math.random() * 8;
			hpA -= critDmg;
			log.push({
				phase: `Tour ${round}`,
				text: `💥 ${nameB} contre-attaque avec un coup critique !`,
			});
		}

		const drainA = Math.max(1, 8 - sA.stamina * 0.08);
		const drainB = Math.max(1, 8 - sB.stamina * 0.08);
		hpA -= drainA;
		hpB -= drainB;

		if (
			hpB < maxHp * 0.35 &&
			Math.random() < rawAtkA * 0.01 - burstResB * 0.005 + 0.05
		) {
			hpB = -10;
			log.push({
				phase: `Tour ${round}`,
				text: `💥 ${nameA} fait BURST ${nameB} !`,
			});
			break;
		}
		if (
			hpA < maxHp * 0.35 &&
			Math.random() < rawAtkB * 0.01 - burstResA * 0.005 + 0.05
		) {
			hpA = -10;
			log.push({
				phase: `Tour ${round}`,
				text: `💥 ${nameB} fait BURST ${nameA} !`,
			});
			break;
		}

		xtremeChanceA += sA.dash * 0.003;
		xtremeChanceB += sB.dash * 0.003;
		if (Math.random() < xtremeChanceA && hpB > 0) {
			const xtDmg = 30 + sA.dash * 0.5;
			hpB -= xtDmg;
			log.push({
				phase: `Tour ${round}`,
				text: `⚡ ${nameA} active la X-LINE ! Dash dévastateur ! (-${Math.round(xtDmg)} PV)`,
			});
			xtremeChanceA = 0;
		}
		if (Math.random() < xtremeChanceB && hpA > 0) {
			const xtDmg = 30 + sB.dash * 0.5;
			hpA -= xtDmg;
			log.push({
				phase: `Tour ${round}`,
				text: `⚡ ${nameB} active la X-LINE ! Dash dévastateur ! (-${Math.round(xtDmg)} PV)`,
			});
			xtremeChanceB = 0;
		}
	}

	// Phase 4: Determine result
	hpA = Math.max(hpA, -10);
	hpB = Math.max(hpB, -10);
	if (hpA > 0 && hpB > 0) {
		const finalA = hpA + enduranceA * 0.2;
		const finalB = hpB + enduranceB * 0.2;
		if (finalA >= finalB) hpB = 0;
		else hpA = 0;
	}

	const winner: "A" | "B" = hpA > hpB ? "A" : "B";
	const loserHp = winner === "A" ? hpB : hpA;
	const winnerStats = winner === "A" ? sA : sB;
	let finishType: BbxFinishType;
	if (loserHp <= -5) {
		finishType =
			winnerStats.dash > 30 && Math.random() < 0.5
				? BBX_FINISH_TYPES[0]!
				: BBX_FINISH_TYPES[1]!;
	} else if (round >= MAX_ROUNDS - 2) {
		finishType = BBX_FINISH_TYPES[3]!;
	} else {
		finishType = BBX_FINISH_TYPES[2]!;
	}

	return {
		winner,
		finishType,
		hpA: Math.max(hpA, 0),
		hpB: Math.max(hpB, 0),
		maxHp,
		log,
		rounds: round,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "tcg-duel" — TCG Card Duel (Best of 3)
// Source: commands/General/DuelCommand.ts
// ═══════════════════════════════════════════════════════════════════════════════

export interface TcgDuelCard {
	id: string;
	name: string;
	rarity: string;
	element: string;
	att: number;
	def: number;
	end: number;
	equilibre: number;
	imageUrl: string | null;
	specialMove: string | null;
	beyblade: string | null;
	series: string;
}

export interface TcgRoundBonuses {
	synergy: boolean;
	underdog: boolean;
	momentum: boolean;
	lastStand: boolean;
}

export interface TcgRoundResult {
	cardA: TcgDuelCard;
	cardB: TcgDuelCard;
	powerA: number;
	powerB: number;
	winner: "A" | "B";
	events: string[];
	mvpDelta: number;
}

// Constants preserved from DuelCommand.ts
const TCG_RARITY_POWER: Record<string, number> = {
	COMMON: 0,
	RARE: 12,
	SUPER_RARE: 28,
	LEGENDARY: 50,
	SECRET: 70,
};

const TCG_ELEMENT_BEATS: Record<string, string> = {
	FEU: "VENT",
	VENT: "TERRE",
	TERRE: "EAU",
	EAU: "FEU",
	OMBRE: "LUMIERE",
	LUMIERE: "OMBRE",
};

export const TCG_ELEMENT_EMOJI: Record<string, string> = {
	FEU: "🔥",
	EAU: "💧",
	TERRE: "🌍",
	VENT: "🌪️",
	OMBRE: "🌑",
	LUMIERE: "✨",
	NEUTRAL: "⚪",
};

export const TCG_ELEMENT_NAME: Record<string, string> = {
	FEU: "Feu",
	EAU: "Eau",
	TERRE: "Terre",
	VENT: "Vent",
	OMBRE: "Ombre",
	LUMIERE: "Lumière",
	NEUTRAL: "Neutre",
};

export const TCG_RARITY_EMOJI: Record<string, string> = {
	COMMON: "⚪",
	RARE: "🔵",
	SUPER_RARE: "🟣",
	LEGENDARY: "🟡",
	SECRET: "🔴",
};

export const TCG_RARITY_LABEL: Record<string, string> = {
	COMMON: "Commune",
	RARE: "Rare",
	SUPER_RARE: "Super Rare",
	LEGENDARY: "Légendaire",
	SECRET: "Secrète",
};

export const TCG_FINISH_TYPES = [
	{ min: 1.6, msg: "⚡ X-TREME FINISH !", emoji: "⚡", color: 0xfbbf24 },
	{ min: 1.35, msg: "💥 BURST FINISH !", emoji: "💥", color: 0xef4444 },
	{ min: 1.1, msg: "🔄 OVER FINISH !", emoji: "🔄", color: 0x8b5cf6 },
	{ min: 0, msg: "🌀 SPIN FINISH !", emoji: "🌀", color: 0x22c55e },
] as const;

export type TcgFinishType = (typeof TCG_FINISH_TYPES)[number];

export const TCG_RANK_TIERS = [
	{ min: 1800, name: "Maître", emoji: "👑", color: "#fbbf24" },
	{ min: 1500, name: "Diamant", emoji: "💎", color: "#22d3ee" },
	{ min: 1300, name: "Platine", emoji: "🔷", color: "#a78bfa" },
	{ min: 1100, name: "Or", emoji: "🥇", color: "#f59e0b" },
	{ min: 900, name: "Argent", emoji: "🥈", color: "#9ca3af" },
	{ min: 0, name: "Bronze", emoji: "🥉", color: "#cd7f32" },
] as const;

/**
 * Compute TCG card power for one round.
 * Preserves all constants from DuelCommand.ts:
 * - base: att*1.2 + def*0.6 + end*0.8 + equilibre*0.4
 * - rarity bonus: from TCG_RARITY_POWER
 * - element advantage: ×1.5 (beats) / ×0.75 (beaten)
 * - critical hit: 12% → ×1.4
 * - special move: 10% → ×1.35
 * - defense wall: def>60, 8% → ×0.7
 * - synergy bonus: ×1.1
 * - underdog bonus: ×1.12
 * - momentum bonus: ×1.06
 * - last stand bonus: ×1.15
 * - variance: 0.85..1.15
 */
export function tcgComputePower(
	card: TcgDuelCard,
	opponentElement: string,
	bonuses: TcgRoundBonuses,
): { power: number; events: string[] } {
	const events: string[] = [];
	const base =
		card.att * 1.2 + card.def * 0.6 + card.end * 0.8 + card.equilibre * 0.4;
	const rarityBonus = TCG_RARITY_POWER[card.rarity] ?? 0;
	let mult = 1.0;

	if (TCG_ELEMENT_BEATS[card.element] === opponentElement) {
		mult *= 1.5;
		events.push(
			`${TCG_ELEMENT_EMOJI[card.element] ?? ""} **${TCG_ELEMENT_NAME[card.element]}** domine **${TCG_ELEMENT_NAME[opponentElement]}** !`,
		);
	} else if (TCG_ELEMENT_BEATS[opponentElement] === card.element) {
		mult *= 0.75;
	}

	if (Math.random() < 0.12) {
		mult *= 1.4;
		events.push("⚡ **Coup critique** — puissance décuplée !");
	}
	if (card.specialMove && Math.random() < 0.1) {
		mult *= 1.35;
		events.push(`💫 **${card.specialMove}** déclenché !`);
	}
	if (card.def > 60 && Math.random() < 0.08) {
		mult *= 0.7;
		events.push("🛡️ **Mur de défense** — impact absorbé !");
	}
	if (bonuses.synergy) {
		mult *= 1.1;
		events.push("🔗 **Synergie élémentaire** — équipe harmonisée !");
	}
	if (bonuses.underdog) {
		mult *= 1.12;
		events.push("🔥 **Underdog** — la rage du plus faible !");
	}
	if (bonuses.momentum) {
		mult *= 1.06;
		events.push("💨 **Momentum** — sur sa lancée !");
	}
	if (bonuses.lastStand) {
		mult *= 1.15;
		events.push("🔥 **Dernier souffle** — tout ou rien !");
	}

	const variance = 0.85 + Math.random() * 0.3;
	return {
		power: Math.round((base + rarityBonus) * mult * variance * 100) / 100,
		events,
	};
}

/** Check if all non-neutral cards share one element (synergy) */
export function tcgHasSynergy(cards: TcgDuelCard[]): boolean {
	const elements = cards.map((c) => c.element).filter((e) => e !== "NEUTRAL");
	if (elements.length < 2) return false;
	return new Set(elements).size === 1;
}

/** Sum of all card base stats */
export function tcgTeamPower(cards: TcgDuelCard[]): number {
	return cards.reduce((s, c) => s + c.att + c.def + c.end + c.equilibre, 0);
}

/** Resolve one TCG round */
export function tcgResolveRound(
	cardA: TcgDuelCard,
	cardB: TcgDuelCard,
	bonusesA: TcgRoundBonuses,
	bonusesB: TcgRoundBonuses,
): TcgRoundResult {
	const a = tcgComputePower(cardA, cardB.element, bonusesA);
	const b = tcgComputePower(cardB, cardA.element, bonusesB);
	const winner: "A" | "B" = a.power >= b.power ? "A" : "B";
	const mvpDelta = Math.abs(a.power - b.power);
	return {
		cardA,
		cardB,
		powerA: a.power,
		powerB: b.power,
		winner,
		events: [...a.events, ...b.events],
		mvpDelta,
	};
}

/**
 * Get finish type from average power ratio over rounds.
 * Threshold order: >=1.6 xtreme, >=1.35 burst, >=1.1 over, else spin
 */
export function tcgGetFinish(avgRatio: number): TcgFinishType {
	return (
		TCG_FINISH_TYPES.find((f) => avgRatio >= f.min) ?? TCG_FINISH_TYPES[3]!
	);
}

/**
 * Get rank tier from ELO rating.
 * Tiers: Maître>=1800, Diamant>=1500, Platine>=1300, Or>=1100, Argent>=900, Bronze>=0
 */
export function tcgGetRankTier(
	rating: number,
): (typeof TCG_RANK_TIERS)[number] {
	return TCG_RANK_TIERS.find((t) => rating >= t.min) ?? TCG_RANK_TIERS[5]!;
}

/**
 * Sort metric for cards (sum of base stats, descending).
 */
export function tcgCardSortPower(c: {
	att: number;
	def: number;
	end: number;
	equilibre: number;
}): number {
	return c.att + c.def + c.end + c.equilibre;
}

/**
 * TCG power bar display (10 chars).
 */
export function tcgPowerBar(value: number, max: number, len = 10): string {
	const filled = Math.round((value / Math.max(max, 1)) * len);
	return (
		"█".repeat(Math.min(filled, len)) + "░".repeat(Math.max(len - filled, 0))
	);
}

/**
 * ELO calculation — K=32 (preserved from DuelCommand.ts).
 */
export function calcElo(
	ratingA: number,
	ratingB: number,
	winnerIsA: boolean,
): { newA: number; newB: number; deltaA: number; deltaB: number } {
	const ELO_K = 32;
	const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
	const expectedB = 1 - expectedA;
	const actualA = winnerIsA ? 1 : 0;
	const actualB = winnerIsA ? 0 : 1;
	const deltaA = Math.round(ELO_K * (actualA - expectedA));
	const deltaB = Math.round(ELO_K * (actualB - expectedB));
	return { newA: ratingA + deltaA, newB: ratingB + deltaB, deltaA, deltaB };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT: "quick-battle" — Single-score battle (Beyblade-style)
// Source: lib/battle-utils.ts → runBattleSimulation()
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickBattleStats {
	attack: number;
	defense: number;
	stamina: number;
	dash: number;
	power: number;
	beyType?: QuickBeyType;
}

export type QuickBeyType = "ATTACK" | "DEFENSE" | "STAMINA" | "BALANCE";

export const QUICK_BEY_TYPES = {
	ATTACK: { name: "Attaque", emoji: "🔴", color: "#ef4444", element: "Feu" },
	DEFENSE: { name: "Défense", emoji: "🔵", color: "#3b82f6", element: "Glace" },
	STAMINA: {
		name: "Endurance",
		emoji: "🟢",
		color: "#22c55e",
		element: "Vent",
	},
	BALANCE: {
		name: "Équilibre",
		emoji: "🟣",
		color: "#a855f7",
		element: "Terre",
	},
} as const;

export const QUICK_FINISH_TYPES = {
	xtreme: {
		result: "xtreme",
		name: "X-TREME FINISH",
		message: "⚡ **X-TREME FINISH !**",
		description: "Éjection à pleine vitesse via le X-Line !",
		points: 3,
		emoji: "⚡",
		dominantStat: "attack" as const,
		minPowerRatio: 0.4,
		color: "#f7d301",
	},
	burst: {
		result: "burst",
		name: "BURST FINISH",
		message: "💥 **BURST FINISH !**",
		description: "La toupie adverse explose sous l'impact !",
		points: 2,
		emoji: "💥",
		dominantStat: "attack" as const,
		minPowerRatio: 0.3,
		color: "#ce0c07",
	},
	over: {
		result: "over",
		name: "OVER FINISH",
		message: "🔄 **OVER FINISH !**",
		description: "Éjection du stadium par la force défensive !",
		points: 2,
		emoji: "🔄",
		dominantStat: "defense" as const,
		minPowerRatio: 0.3,
		color: "#3b82f6",
	},
	spin: {
		result: "spin",
		name: "SPIN FINISH",
		message: "🌀 **SPIN FINISH !**",
		description: "La toupie adverse s'arrête de tourner.",
		points: 1,
		emoji: "🌀",
		dominantStat: "stamina" as const,
		minPowerRatio: 0.0,
		color: "#22c55e",
	},
	xcelerator: {
		result: "xcelerator",
		name: "X-CELERATOR FINISH",
		message: "🔥 **X-CELERATOR FINISH !**",
		description: "Impact dévastateur depuis le Xtreme Dash !",
		points: 3,
		emoji: "🔥",
		dominantStat: "dash" as const,
		minPowerRatio: 0.0,
		color: "#e68002",
	},
	survivor: {
		result: "survivor",
		name: "SURVIVOR FINISH",
		message: "🛡️ **SURVIVOR FINISH !**",
		description: "Victoire par résistance — tous les coups encaissés !",
		points: 1,
		emoji: "🛡️",
		dominantStat: "defense" as const,
		minPowerRatio: 0.35,
		color: "#60a5fa",
	},
} as const;

export type QuickFinishKey = keyof typeof QUICK_FINISH_TYPES;
export type QuickFinishType = (typeof QUICK_FINISH_TYPES)[QuickFinishKey];

// Type advantage matrix: attacker → which type it beats
const QUICK_TYPE_ADVANTAGE: Record<QuickBeyType, QuickBeyType> = {
	ATTACK: "STAMINA", // Attaque > Endurance (overwhelm)
	STAMINA: "DEFENSE", // Endurance > Défense (outlast)
	DEFENSE: "ATTACK", // Défense > Attaque (absorb)
	BALANCE: "BALANCE", // Équilibre — neutral
};

function quickGetTypeAdvantage(
	attacker: QuickBeyType | undefined,
	defender: QuickBeyType | undefined,
): number {
	if (
		!attacker ||
		!defender ||
		attacker === "BALANCE" ||
		defender === "BALANCE"
	)
		return 1.0;
	if (QUICK_TYPE_ADVANTAGE[attacker] === defender) return 1.15; // 15% bonus
	if (QUICK_TYPE_ADVANTAGE[defender] === attacker) return 0.88; // 12% malus
	return 1.0;
}

/**
 * Detect dominant bey type from stats.
 * Threshold: 38% of total (atk+def+sta).
 */
export function detectBeyType(stats: {
	attack: number;
	defense: number;
	stamina: number;
}): QuickBeyType {
	const { attack, defense, stamina } = stats;
	const total = attack + defense + stamina;
	if (total === 0) return "BALANCE";
	const threshold = 0.38;
	const atkRatio = attack / total;
	const defRatio = defense / total;
	const staRatio = stamina / total;
	if (atkRatio > threshold && atkRatio >= defRatio && atkRatio >= staRatio)
		return "ATTACK";
	if (defRatio > threshold && defRatio >= atkRatio && defRatio >= staRatio)
		return "DEFENSE";
	if (staRatio > threshold && staRatio >= atkRatio && staRatio >= defRatio)
		return "STAMINA";
	return "BALANCE";
}

function quickDetermineFinishType(
	winnerStats: QuickBattleStats,
	loserStats: QuickBattleStats,
): QuickFinishType {
	const { attack, defense, stamina, dash } = winnerStats;
	const total = attack + defense + stamina;
	if (total === 0) return QUICK_FINISH_TYPES.spin;
	const atkRatio = attack / total;
	const defRatio = defense / total;
	const dashBonus = dash > 50 ? 0.15 : 0;
	const powerGap =
		(winnerStats.power - loserStats.power) / Math.max(winnerStats.power, 1);
	const roll = Math.random();

	if (dash > 60 && atkRatio > 0.3 && roll < 0.12 + dashBonus)
		return QUICK_FINISH_TYPES.xcelerator;
	if (atkRatio > 0.35 && roll < atkRatio * 0.4 + dashBonus + powerGap * 0.1)
		return QUICK_FINISH_TYPES.xtreme;
	if (roll < atkRatio * 0.7 + dashBonus) return QUICK_FINISH_TYPES.burst;
	if (defRatio > 0.35 && Math.abs(powerGap) < 0.1 && roll < 0.5)
		return QUICK_FINISH_TYPES.survivor;
	if (roll < atkRatio * 0.7 + defRatio * 0.6) return QUICK_FINISH_TYPES.over;
	return QUICK_FINISH_TYPES.spin;
}

export interface QuickBattleScoreResult {
	scoreA: number;
	scoreB: number;
	typeAdvantageA: number;
	typeAdvantageB: number;
	criticalHit: "A" | "B" | null;
	xDash: "A" | "B" | null;
}

/**
 * Calculate battle scores with all modifiers for quick-battle variant.
 * Preserves all constants from battle-utils.ts:
 * - luck: 0.82..1.18
 * - type advantage: ×1.15 (advantage) / ×0.88 (disadvantage)
 * - critical: 8% → ×1.25
 * - xDash: dash>55, 20% → ×1.15
 */
export function quickCalculateBattleScores(
	statsA: QuickBattleStats,
	statsB: QuickBattleStats,
): QuickBattleScoreResult {
	const luckA = 0.82 + Math.random() * 0.36;
	const luckB = 0.82 + Math.random() * 0.36;
	const typeAdvA = quickGetTypeAdvantage(statsA.beyType, statsB.beyType);
	const typeAdvB = quickGetTypeAdvantage(statsB.beyType, statsA.beyType);
	const critA = Math.random() < 0.08;
	const critB = Math.random() < 0.08;
	const critMultA = critA ? 1.25 : 1.0;
	const critMultB = critB ? 1.25 : 1.0;
	const xDashA = statsA.dash > 55 && Math.random() < 0.2;
	const xDashB = statsB.dash > 55 && Math.random() < 0.2;
	const xDashMultA = xDashA ? 1.15 : 1.0;
	const xDashMultB = xDashB ? 1.15 : 1.0;
	const scoreA = statsA.power * luckA * typeAdvA * critMultA * xDashMultA;
	const scoreB = statsB.power * luckB * typeAdvB * critMultB * xDashMultB;
	return {
		scoreA,
		scoreB,
		typeAdvantageA: typeAdvA,
		typeAdvantageB: typeAdvB,
		criticalHit: critA ? "A" : critB ? "B" : null,
		xDash: xDashA ? "A" : xDashB ? "B" : null,
	};
}

/**
 * Build narrative lines for quick-battle result.
 */
export function quickBuildNarrative(
	scores: QuickBattleScoreResult,
	winnerIsA: boolean,
	finish: QuickFinishType,
	challengerName: string,
	opponentName: string,
): string[] {
	const lines: string[] = [];
	const winnerName = winnerIsA ? challengerName : opponentName;
	if (scores.xDash) {
		const dasher = scores.xDash === "A" ? challengerName : opponentName;
		lines.push(`💨 **${dasher}** active le **Xtreme Dash** !`);
	}
	if (scores.typeAdvantageA > 1 || scores.typeAdvantageB > 1) {
		const advantaged =
			scores.typeAdvantageA > 1 ? challengerName : opponentName;
		lines.push(`🎯 **${advantaged}** a l'avantage de type !`);
	}
	if (scores.criticalHit) {
		const critter = scores.criticalHit === "A" ? challengerName : opponentName;
		lines.push(`💢 **${critter}** porte un coup critique !`);
	}
	lines.push(`${finish.emoji} **${winnerName}** remporte le combat !`);
	lines.push(`> *${finish.description}*`);
	return lines;
}

/**
 * Run a complete quick battle simulation.
 * Returns winner, finish type, narrative, and raw scores.
 */
export function simulateQuickBattle(
	statsA: QuickBattleStats,
	statsB: QuickBattleStats,
	nameA: string,
	nameB: string,
): {
	winnerIsA: boolean;
	scores: QuickBattleScoreResult;
	finishType: QuickFinishType;
	narrative: string[];
} {
	if (!statsA.beyType) statsA.beyType = detectBeyType(statsA);
	if (!statsB.beyType) statsB.beyType = detectBeyType(statsB);

	const scores = quickCalculateBattleScores(statsA, statsB);
	const winnerIsA = scores.scoreA > scores.scoreB;
	const winnerStats = winnerIsA ? statsA : statsB;
	const loserStats = winnerIsA ? statsB : statsA;
	const finishType = quickDetermineFinishType(winnerStats, loserStats);
	const narrative = quickBuildNarrative(
		scores,
		winnerIsA,
		finishType,
		nameA,
		nameB,
	);

	return { winnerIsA, scores, finishType, narrative };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Pick a random element from an array */
export function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Stat bar display (block chars) */
export function statBar(value: number, max = 100): string {
	const filled = Math.round((value / max) * 10);
	return (
		"█".repeat(Math.min(filled, 10)) + "░".repeat(10 - Math.min(filled, 10))
	);
}

/** Get type color for Beyblade X type */
export function getTypeColor(beyType: string | null): number {
	switch (beyType) {
		case "ATTACK":
			return 0xef4444;
		case "DEFENSE":
			return 0x3b82f6;
		case "STAMINA":
			return 0x22c55e;
		case "BALANCE":
			return 0xa855f7;
		default:
			return 0x8b5cf6;
	}
}

/** Get type emoji for Beyblade X type */
export function getTypeEmoji(beyType: string | null): string {
	switch (beyType) {
		case "ATTACK":
			return "⚔️";
		case "DEFENSE":
			return "🛡️";
		case "STAMINA":
			return "🌀";
		case "BALANCE":
			return "⚖️";
		default:
			return "🌀";
	}
}
