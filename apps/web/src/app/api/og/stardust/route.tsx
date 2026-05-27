/**
 * Open Graph image for /tournaments/stardust (1200x630 PNG).
 *
 * Rendu via `next/og` ImageResponse (Satori). Donnees lues live depuis Prisma:
 * - Nombre de tournois finis (category LIKE STARDUST + status IN COMPLETE/ARCHIVED)
 * - Nombre de bladers uniques (stardust_bladers count)
 * - Champion en titre (stardust_rankings WHERE rank=1)
 * - Podium (rank 1/2/3)
 *
 * L'image est mise en cache 1h cote CDN/edge (s-maxage=3600, SWR 24h).
 */

import { ImageResponse } from "next/og";
import { loadGoogleSansFonts } from "@/lib/og/fonts";
import { db, schema, and, asc, count, eq, ilike, inArray } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;
const ACCENT = "#60A5FA";
const BG_TOP = "#0c1730";
const BG_BOTTOM = "#1e3a5f";

interface PodiumEntry {
	rank: number;
	name: string;
	score: number;
}

async function loadStats() {
	const [tournamentCountRows, bladerCountRows, podium] = await Promise.all([
		db
			.select({ value: count() })
			.from(schema.tournaments)
			.innerJoin(
				schema.tournamentCategories,
				eq(schema.tournaments.categoryId, schema.tournamentCategories.id),
			)
			.where(
				and(
					ilike(schema.tournamentCategories.name, "%STARDUST%"),
					inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED"]),
				),
			),
		db.select({ value: count() }).from(schema.stardustBladers),
		db.query.stardustRankings.findMany({
			orderBy: asc(schema.stardustRankings.rank),
			limit: 3,
			columns: { rank: true, playerName: true, score: true },
		}),
	]);

	const tournamentCount = tournamentCountRows[0]?.value ?? 0;
	const bladerCount = bladerCountRows[0]?.value ?? 0;

	return {
		tournamentCount,
		bladerCount,
		podium: podium.map<PodiumEntry>((p) => ({
			rank: p.rank,
			name: p.playerName,
			score: p.score,
		})),
	};
}

function fmt(n: number): string {
	return n.toLocaleString("fr-FR");
}

function ellipsize(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export async function GET() {
	try {
		const fonts = await loadGoogleSansFonts();
		const stats = await loadStats();
		const champion = stats.podium[0] ?? null;
		const others = stats.podium.slice(1);

		const tournamentLabel = stats.tournamentCount <= 1 ? "tournoi" : "tournois";
		const playerLabel = stats.bladerCount <= 1 ? "blader" : "bladers";

		return new ImageResponse(
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					background: `radial-gradient(circle at 50% 0%, ${BG_BOTTOM} 0%, ${BG_TOP} 55%, #040810 100%)`,
					fontFamily: "GoogleSans",
					color: "#ffffff",
					padding: 70,
					position: "relative",
				}}
			>
				{/* Eyebrow */}
				<span
					style={{
						display: "flex",
						color: ACCENT,
						fontWeight: 900,
						fontSize: 22,
						letterSpacing: 2,
					}}
				>
					RPB NORD · SAISON 1
				</span>

				{/* Titre principal */}
				<span
					style={{
						display: "flex",
						marginTop: 24,
						color: "#ffffff",
						fontWeight: 900,
						fontSize: 84,
						lineHeight: 1,
						textShadow: `0 0 32px rgba(96, 165, 250, 0.45)`,
					}}
				>
					STARDUST SÉRIES
				</span>

				{/* Sous-titre stats */}
				<span
					style={{
						display: "flex",
						marginTop: 24,
						color: "rgba(226, 232, 240, 0.78)",
						fontWeight: 600,
						fontSize: 30,
					}}
				>
					{fmt(stats.tournamentCount)} {tournamentLabel} ·{" "}
					{fmt(stats.bladerCount)} {playerLabel}
				</span>

				{/* Bandeau champion */}
				{champion ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginTop: 36,
							padding: "20px 32px",
							background: "rgba(96, 165, 250, 0.10)",
							border: "1.5px solid rgba(96, 165, 250, 0.35)",
							borderRadius: 9999,
							width: "100%",
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
							}}
						>
							<span
								style={{
									display: "flex",
									color: ACCENT,
									fontWeight: 900,
									fontSize: 28,
								}}
							>
								CHAMPION
							</span>
							<span
								style={{
									display: "flex",
									marginTop: 4,
									color: "#ffffff",
									fontWeight: 900,
									fontSize: 40,
								}}
							>
								{ellipsize(champion.name, 22)}
							</span>
						</div>
						<span
							style={{
								display: "flex",
								color: ACCENT,
								fontWeight: 900,
								fontSize: 46,
							}}
						>
							{fmt(champion.score)} pts
						</span>
					</div>
				) : null}

				{/* Podium 2/3 */}
				{others.length > 0 ? (
					<div
						style={{
							display: "flex",
							marginTop: 24,
							gap: 30,
							justifyContent: "center",
						}}
					>
						{others.map((entry) => {
							const rankColor = entry.rank === 2 ? "#cbd5e1" : "#cd7f32";
							return (
								<div
									key={entry.rank}
									style={{
										display: "flex",
										alignItems: "center",
										padding: "16px 22px",
										background: "rgba(255, 255, 255, 0.05)",
										border: "1px solid rgba(96, 165, 250, 0.25)",
										borderRadius: 14,
										width: 380,
									}}
								>
									<span
										style={{
											display: "flex",
											color: rankColor,
											fontWeight: 900,
											fontSize: 36,
											marginRight: 18,
										}}
									>
										#{entry.rank}
									</span>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											flex: 1,
										}}
									>
										<span
											style={{
												display: "flex",
												color: "#ffffff",
												fontWeight: 700,
												fontSize: 24,
											}}
										>
											{ellipsize(entry.name, 16)}
										</span>
										<span
											style={{
												display: "flex",
												color: "rgba(226, 232, 240, 0.75)",
												fontWeight: 600,
												fontSize: 18,
											}}
										>
											{fmt(entry.score)} pts
										</span>
									</div>
								</div>
							);
						})}
					</div>
				) : null}

				{/* Footer */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						position: "absolute",
						bottom: 32,
						left: 70,
						right: 70,
					}}
				>
					<span
						style={{
							display: "flex",
							color: "rgba(226, 232, 240, 0.45)",
							fontWeight: 700,
							fontSize: 20,
						}}
					>
						rpbey.fr/tournaments/stardust
					</span>
					<span
						style={{
							display: "flex",
							color: ACCENT,
							fontWeight: 700,
							fontSize: 20,
						}}
					>
						RPB OFFICIAL
					</span>
				</div>
			</div>,
			{
				width: WIDTH,
				height: HEIGHT,
				fonts: fonts.length > 0 ? (fonts as never) : undefined,
				headers: {
					"Cache-Control":
						"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
					"Content-Disposition": 'inline; filename="stardust-og.png"',
				},
			},
		);
	} catch (error) {
		console.error("Error generating stardust OG image:", error);
		return new Response(
			JSON.stringify({ error: "Failed to generate OG image" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
