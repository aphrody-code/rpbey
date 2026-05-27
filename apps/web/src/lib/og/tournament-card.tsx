/**
 * Generateur OG card pour un tournoi Challonge — sortie raster via next/og
 * (Satori, JSX) en remplacement du rendu Skia natif (pour deploy Vercel).
 *
 * Lib pure : `renderTournamentCardEncoded()` ne fait aucun fetch reseau, recoit
 * en entree un `ViewerData` deja resolu (via `convertChallongeToBrackets`) plus
 * une `ChallongeSource` decrivant le tournoi.
 *
 * Layout :
 *   - Header  : titre tournoi + sous-titre meta + monogramme RPB / badge LIVE.
 *   - Corps   : depend du `stage.type` :
 *               · `round_robin`      → grille des poules (top 3 par groupe).
 *               · `single_elim`      → podium 1/2/3-4 avec medailles dorees.
 *               · `double_elim`      → idem podium.
 *   - Footer  : URL Challonge + URL showcase rpbey.fr + branding.
 *
 * NOTE: la sortie native d'`ImageResponse` est PNG. Les formats `webp` et
 * `avif` retombent sur PNG (Satori ne supporte pas ces encodings). La
 * content-negotiation est conservee pour compat API mais sans gain de bytes.
 */

import { ImageResponse } from "next/og";

import type {
	Id,
	Match,
	Participant,
	Stage,
	StageType,
	ViewerData,
} from "@/lib/brackets/types";
import { Status } from "@/lib/brackets/types";

import { loadInterFonts } from "./fonts";
import { getPalette, type OgPalette, type OgTheme } from "./theme";

export interface ChallongeSource {
	idOrSlug: string;
	challongeId: number | null;
	name: string;
	url: string;
	state: string | null;
	type: string | null;
	participantsCount: number;
	matchesCount: number;
}

export interface RenderOptions {
	data: ViewerData;
	source: ChallongeSource;
	theme?: OgTheme;
	width?: number;
	height?: number;
	fetchedAt?: string;
}

export const DEFAULT_WIDTH = 1200;
export const DEFAULT_HEIGHT = 630;

// ─── Mapping stage / state ─────────────────────────────────────────────────

const TYPE_LABEL: Record<StageType, string> = {
	round_robin: "Round-robin",
	single_elimination: "Single elimination",
	double_elimination: "Double elimination",
};

function stateLabel(state: string | null): { label: string; isLive: boolean } {
	if (!state) return { label: "Inconnu", isLive: false };
	const lc = state.toLowerCase();
	if (lc === "underway" || lc === "in_progress" || lc === "checking_in")
		return { label: "En cours", isLive: true };
	if (lc === "complete" || lc === "completed" || lc === "ended")
		return { label: "Termine", isLive: false };
	if (lc === "pending" || lc === "registration_open" || lc === "checked_in")
		return { label: "A venir", isLive: false };
	return { label: state, isLive: false };
}

function isStageLive(matches: Match[]): boolean {
	return matches.some(
		(m) => m.status === Status.Running || m.status === Status.Ready,
	);
}

function ellipsize(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, Math.max(1, max - 1))}…`;
}

// ─── Round-robin standings ─────────────────────────────────────────────────

interface PoolStanding {
	id: Id;
	name: string;
	wins: number;
	losses: number;
	draws: number;
	points: number;
}

function buildPoolStandings(
	matches: Match[],
	participants: Participant[],
): Map<Id, PoolStanding[]> {
	const byParticipant = new Map<Id, Participant>();
	for (const p of participants) byParticipant.set(p.id, p);

	const groups = new Map<Id, Map<Id, PoolStanding>>();

	for (const m of matches) {
		if (m.status !== Status.Completed) continue;
		const o1 = m.opponent1;
		const o2 = m.opponent2;
		if (!o1?.id || !o2?.id) continue;

		const groupId = m.group_id ?? 1;
		let pool = groups.get(groupId);
		if (!pool) {
			pool = new Map();
			groups.set(groupId, pool);
		}

		const ensure = (pid: Id): PoolStanding => {
			let row = pool!.get(pid);
			if (!row) {
				row = {
					id: pid,
					name: byParticipant.get(pid)?.name ?? `#${pid}`,
					wins: 0,
					losses: 0,
					draws: 0,
					points: 0,
				};
				pool!.set(pid, row);
			}
			return row;
		};

		const r1 = ensure(o1.id);
		const r2 = ensure(o2.id);
		if (o1.result === "win" || o2.result === "loss") {
			r1.wins++;
			r2.losses++;
			r1.points += 3;
		} else if (o2.result === "win" || o1.result === "loss") {
			r2.wins++;
			r1.losses++;
			r2.points += 3;
		} else {
			r1.draws++;
			r2.draws++;
			r1.points++;
			r2.points++;
		}
	}

	const out = new Map<Id, PoolStanding[]>();
	for (const [gid, pool] of groups) {
		const arr = [...pool.values()].sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			if (b.wins !== a.wins) return b.wins - a.wins;
			return a.losses - b.losses;
		});
		out.set(gid, arr);
	}
	return out;
}

// ─── Podium elimination ────────────────────────────────────────────────────

interface Podium {
	champion: Participant | null;
	runnerUp: Participant | null;
	semiFinalists: Participant[];
}

function buildEliminationPodium(
	stage: Stage,
	matches: Match[],
	participants: Participant[],
): Podium {
	const byId = new Map<Id, Participant>();
	for (const p of participants) byId.set(p.id, p);

	const completed = matches.filter((m) => m.status === Status.Completed);
	if (completed.length === 0)
		return { champion: null, runnerUp: null, semiFinalists: [] };

	let finalMatch: Match | null = null;
	let maxRound: number = -Infinity;
	for (const m of completed) {
		const rid = Number(m.round_id ?? 0);
		if (rid > maxRound) {
			maxRound = rid;
			finalMatch = m;
		}
	}

	let champion: Participant | null = null;
	let runnerUp: Participant | null = null;
	if (finalMatch) {
		const w =
			finalMatch.opponent1?.result === "win"
				? finalMatch.opponent1
				: finalMatch.opponent2?.result === "win"
					? finalMatch.opponent2
					: null;
		const l =
			finalMatch.opponent1?.result === "loss"
				? finalMatch.opponent1
				: finalMatch.opponent2?.result === "loss"
					? finalMatch.opponent2
					: null;
		if (w?.id) champion = byId.get(w.id) ?? null;
		if (l?.id) runnerUp = byId.get(l.id) ?? null;
	}

	const semiFinalists: Participant[] = [];
	if (finalMatch && stage.type !== "round_robin") {
		const targetRound = Number(finalMatch.round_id ?? 0) - 1;
		const seen = new Set<Id>();
		for (const m of completed) {
			if (Number(m.round_id ?? 0) !== targetRound) continue;
			const loser =
				m.opponent1?.result === "loss"
					? m.opponent1
					: m.opponent2?.result === "loss"
						? m.opponent2
						: null;
			if (loser?.id && !seen.has(loser.id)) {
				const p = byId.get(loser.id);
				if (p) {
					semiFinalists.push(p);
					seen.add(loser.id);
				}
			}
			if (semiFinalists.length >= 2) break;
		}
	}

	return { champion, runnerUp, semiFinalists };
}

// ─── JSX helpers (Satori-friendly, flex only) ──────────────────────────────

function MedalCard({
	rank,
	name,
	label,
	palette,
	champion,
}: {
	rank: 1 | 2 | 3;
	name: string;
	label: string;
	palette: OgPalette;
	champion?: boolean;
}) {
	const medalColor =
		rank === 1 ? palette.gold : rank === 2 ? palette.silver : palette.bronze;
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				flex: 1,
				background: `linear-gradient(180deg, ${medalColor}33 0%, ${medalColor}0a 100%)`,
				border: `1px solid ${medalColor}80`,
				borderRadius: 18,
				padding: champion ? 24 : 16,
				margin: "0 8px",
				height: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: champion ? 88 : 56,
					height: champion ? 88 : 56,
					borderRadius: 9999,
					background: `radial-gradient(circle, #ffffff 0%, ${medalColor} 60%, ${medalColor}99 100%)`,
					color: "#0c1730",
					fontFamily: "Inter Display",
					fontWeight: 900,
					fontSize: champion ? 36 : 22,
					boxShadow: `0 0 24px ${medalColor}80`,
				}}
			>
				{rank}
			</div>
			<div
				style={{
					display: "flex",
					marginTop: 14,
					color: palette.muted,
					fontFamily: "Inter",
					fontWeight: 700,
					fontSize: champion ? 13 : 11,
					textTransform: "uppercase",
					letterSpacing: 1.5,
				}}
			>
				{label}
			</div>
			<div
				style={{
					display: "flex",
					marginTop: 10,
					color: palette.onSurface,
					fontFamily: "Inter",
					fontWeight: champion ? 800 : 700,
					fontSize: champion ? 28 : 16,
					textAlign: "center",
				}}
			>
				{ellipsize(name, champion ? 24 : 18)}
			</div>
		</div>
	);
}

function PoolCard({
	groupId,
	standings,
	palette,
}: {
	groupId: Id;
	standings: PoolStanding[];
	palette: OgPalette;
}) {
	const top = standings.slice(0, 3);
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				flex: 1,
				margin: 8,
				padding: "14px 16px",
				background: palette.surface,
				border: `1px solid ${palette.outlineVariant}`,
				borderRadius: 16,
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 10,
				}}
			>
				<span
					style={{
						color: palette.onSurfaceVariant,
						fontFamily: "Inter",
						fontWeight: 700,
						fontSize: 13,
					}}
				>
					POULE {groupId}
				</span>
				<span
					style={{
						color: palette.muted,
						fontFamily: "Inter",
						fontWeight: 500,
						fontSize: 11,
					}}
				>
					V-D-N
				</span>
			</div>
			{top.length === 0 ? (
				<span
					style={{
						color: palette.muted,
						fontFamily: "Inter",
						fontWeight: 500,
						fontSize: 12,
					}}
				>
					(en attente)
				</span>
			) : (
				top.map((row, i) => {
					const rank = i + 1;
					const medalColor =
						rank === 1
							? palette.gold
							: rank === 2
								? palette.silver
								: palette.bronze;
					return (
						<div
							key={row.id}
							style={{
								display: "flex",
								alignItems: "center",
								marginTop: 6,
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									width: 22,
									height: 22,
									borderRadius: 9999,
									background: `${medalColor}eb`,
									color: "#0c1730",
									fontFamily: "Inter",
									fontWeight: 800,
									fontSize: 11,
									marginRight: 8,
								}}
							>
								{rank}
							</div>
							<span
								style={{
									flex: 1,
									color: palette.onSurface,
									fontFamily: "Inter",
									fontWeight: 600,
									fontSize: 14,
									overflow: "hidden",
								}}
							>
								{ellipsize(row.name, 18)}
							</span>
							<span
								style={{
									color: palette.onSurfaceVariant,
									fontFamily: "Inter",
									fontWeight: 700,
									fontSize: 13,
								}}
							>
								{row.wins}-{row.losses}
								{row.draws ? `-${row.draws}` : ""}
							</span>
						</div>
					);
				})
			)}
		</div>
	);
}

function EmptyState({
	message,
	palette,
}: {
	message: string;
	palette: OgPalette;
}) {
	return (
		<div
			style={{
				display: "flex",
				flex: 1,
				alignItems: "center",
				justifyContent: "center",
				background: palette.surface,
				border: `1px solid ${palette.outlineVariant}`,
				borderRadius: 18,
				color: palette.muted,
				fontFamily: "Inter",
				fontWeight: 600,
				fontSize: 22,
			}}
		>
			{message}
		</div>
	);
}

// ─── Card JSX ──────────────────────────────────────────────────────────────

function buildCardJsx(opts: RenderOptions): React.ReactElement {
	const theme: OgTheme = opts.theme ?? "dark";
	const palette = getPalette(theme);
	const stage = opts.data.stages[0];
	const stageType: StageType = stage?.type ?? "single_elimination";
	const live = isStageLive(opts.data.matches);
	const st = stateLabel(opts.source.state);

	const sub: string[] = [TYPE_LABEL[stageType] ?? "Tournoi", st.label];
	sub.push(`${opts.source.participantsCount} participants`);
	if (opts.fetchedAt) {
		try {
			const d = new Date(opts.fetchedAt);
			sub.push(
				d.toLocaleDateString("fr-FR", {
					day: "2-digit",
					month: "short",
					year: "numeric",
				}),
			);
		} catch {
			/* ignore */
		}
	}

	const bg =
		theme === "dark"
			? `linear-gradient(135deg, ${palette.background} 0%, ${palette.backgroundAccent} 55%, ${palette.background} 100%)`
			: `linear-gradient(180deg, ${palette.backgroundAccent} 0%, ${palette.background} 100%)`;

	let body: React.ReactElement;
	if (stageType === "round_robin") {
		const standings = buildPoolStandings(
			opts.data.matches,
			opts.data.participants,
		);
		const groupIds = [...standings.keys()].sort(
			(a, b) => Number(a) - Number(b),
		);
		if (groupIds.length === 0) {
			body = <EmptyState message="Aucun match termine" palette={palette} />;
		} else {
			const cols = groupIds.length >= 5 ? 3 : Math.min(3, groupIds.length);
			const rows: Id[][] = [];
			for (let i = 0; i < groupIds.length; i += cols) {
				rows.push(groupIds.slice(i, i + cols));
			}
			body = (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						width: "100%",
					}}
				>
					{rows.map((row, ri) => (
						<div
							key={ri}
							style={{
								display: "flex",
								flex: 1,
								width: "100%",
							}}
						>
							{row.map((gid) => (
								<PoolCard
									key={gid}
									groupId={gid}
									standings={standings.get(gid) ?? []}
									palette={palette}
								/>
							))}
						</div>
					))}
				</div>
			);
		}
	} else {
		const podium = buildEliminationPodium(
			stage ?? ({} as Stage),
			opts.data.matches,
			opts.data.participants,
		);
		if (
			!podium.champion &&
			!podium.runnerUp &&
			podium.semiFinalists.length === 0
		) {
			body = (
				<EmptyState message="Tournoi pas encore lance" palette={palette} />
			);
		} else {
			const lower: Array<{ rank: 2 | 3; name: string; label: string }> = [];
			if (podium.runnerUp) {
				lower.push({
					rank: 2,
					name: podium.runnerUp.name,
					label: "Finaliste",
				});
			}
			for (const sf of podium.semiFinalists) {
				lower.push({ rank: 3, name: sf.name, label: "Demi-finaliste" });
			}
			body = (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						width: "100%",
					}}
				>
					<div
						style={{
							display: "flex",
							flex: 1.2,
							width: "100%",
							justifyContent: "center",
						}}
					>
						<MedalCard
							rank={1}
							name={podium.champion?.name ?? "—"}
							label="Champion"
							palette={palette}
							champion
						/>
					</div>
					{lower.length > 0 ? (
						<div
							style={{
								display: "flex",
								flex: 1,
								width: "100%",
								marginTop: 16,
							}}
						>
							{lower.map((c, i) => (
								<MedalCard
									key={i}
									rank={c.rank}
									name={c.name}
									label={c.label}
									palette={palette}
								/>
							))}
						</div>
					) : null}
				</div>
			);
		}
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				background: bg,
				padding: "40px 56px",
				fontFamily: "Inter",
				color: palette.onSurface,
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					width: "100%",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						paddingRight: 32,
					}}
				>
					<span
						style={{
							display: "flex",
							color: palette.onSurface,
							fontFamily: "Inter",
							fontWeight: 800,
							fontSize: 48,
							lineHeight: 1.1,
						}}
					>
						{ellipsize(opts.source.name, 36)}
					</span>
					<span
						style={{
							display: "flex",
							marginTop: 16,
							color: palette.onSurfaceVariant,
							fontFamily: "Inter",
							fontWeight: 500,
							fontSize: 20,
						}}
					>
						{sub.join("  •  ")}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: 84,
							height: 84,
							borderRadius: 9999,
							background: `linear-gradient(180deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
							boxShadow: `0 0 24px ${palette.primary}99`,
							color: palette.onPrimary,
							fontFamily: "Inter Display",
							fontWeight: 900,
							fontSize: 30,
						}}
					>
						RPB
					</div>
					{live ? (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								marginTop: 8,
								padding: "4px 12px",
								borderRadius: 9999,
								background: palette.live,
								color: "#ffffff",
								fontFamily: "Inter",
								fontWeight: 800,
								fontSize: 12,
							}}
						>
							● LIVE
						</div>
					) : null}
				</div>
			</div>

			{/* Body */}
			<div
				style={{
					display: "flex",
					flex: 1,
					width: "100%",
					marginTop: 28,
					marginBottom: 16,
				}}
			>
				{body}
			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					width: "100%",
					color: palette.muted,
					fontFamily: "Inter",
					fontWeight: 500,
					fontSize: 16,
				}}
			>
				<span style={{ display: "flex" }}>
					challonge.com/{opts.source.idOrSlug}
				</span>
				<span style={{ display: "flex" }}>
					rpbey.fr/showcase/brackets/challonge?slug=
					{opts.source.idOrSlug}
				</span>
				<span
					style={{
						display: "flex",
						color: palette.primary,
						fontWeight: 800,
					}}
				>
					rpbey.fr
				</span>
			</div>
		</div>
	);
}

// ─── Fallback erreur ───────────────────────────────────────────────────────

export interface RenderErrorOptions {
	message: string;
	idOrSlug?: string;
	theme?: OgTheme;
	width?: number;
	height?: number;
}

async function imageResponseToBuffer(res: ImageResponse): Promise<Buffer> {
	const ab = await res.arrayBuffer();
	return Buffer.from(ab);
}

export async function renderTournamentError(
	opts: RenderErrorOptions,
): Promise<Buffer> {
	const width = opts.width ?? DEFAULT_WIDTH;
	const height = opts.height ?? DEFAULT_HEIGHT;
	const theme: OgTheme = opts.theme ?? "dark";
	const palette = getPalette(theme);
	const fonts = await loadInterFonts();

	const sub = opts.idOrSlug
		? `Slug "${opts.idOrSlug}" — ${opts.message}`
		: opts.message;

	const res = new ImageResponse(
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				background: `linear-gradient(135deg, ${palette.background} 0%, ${palette.backgroundAccent} 55%, ${palette.background} 100%)`,
				fontFamily: "Inter",
			}}
		>
			<span
				style={{
					display: "flex",
					color: palette.onSurface,
					fontFamily: "Inter",
					fontWeight: 800,
					fontSize: 56,
				}}
			>
				Tournoi introuvable
			</span>
			<span
				style={{
					display: "flex",
					marginTop: 16,
					color: palette.muted,
					fontFamily: "Inter",
					fontWeight: 500,
					fontSize: 22,
					maxWidth: width - 120,
					textAlign: "center",
				}}
			>
				{ellipsize(sub, 80)}
			</span>
			<span
				style={{
					display: "flex",
					marginTop: 60,
					color: palette.primary,
					fontFamily: "Inter",
					fontWeight: 700,
					fontSize: 18,
				}}
			>
				rpbey.fr
			</span>
		</div>,
		{
			width,
			height,
			fonts: fonts.length > 0 ? (fonts as never) : undefined,
		},
	);
	return imageResponseToBuffer(res);
}

// ─── Export principal ──────────────────────────────────────────────────────

/**
 * Rend la card OG en PNG via next/og (Satori).
 *
 * NOTE format webp/avif : Satori ne sait sortir que du PNG. Les requetes
 * `format=webp|avif` recoivent un PNG (le caller doit utiliser le mime
 * `image/png` pour la reponse — geree au niveau de la route).
 */
export async function renderTournamentCard(
	opts: RenderOptions,
): Promise<Buffer> {
	return renderTournamentCardEncoded({ ...opts, format: "png" });
}

export async function renderTournamentCardEncoded(
	opts: RenderOptions & { format: "png" | "webp" | "avif" },
): Promise<Buffer> {
	const width = opts.width ?? DEFAULT_WIDTH;
	const height = opts.height ?? DEFAULT_HEIGHT;
	const fonts = await loadInterFonts();

	const res = new ImageResponse(buildCardJsx(opts), {
		width,
		height,
		fonts: fonts.length > 0 ? (fonts as never) : undefined,
	});
	return imageResponseToBuffer(res);
}
