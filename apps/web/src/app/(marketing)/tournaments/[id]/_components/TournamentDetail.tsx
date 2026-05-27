"use client";

import {
	GridView as PoolsIcon,
	Leaderboard,
	EmojiEvents as Trophy,
} from "@mui/icons-material";
import { Box, Grid, Paper, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";
import {
	ChallongeBracket,
	TournamentBracketDb,
} from "@/components/tournaments";
import { MirrorReact } from "@/components/challonge/MirrorReact";
import { useThemeMode } from "@/components/theme/ThemeRegistry";
import { AboutSection } from "./AboutSection";
import { LiveStations } from "./LiveStations";
import { PoolsPanel } from "./PoolsPanel";
import { StandingsPanel } from "./StandingsPanel";
import { TournamentHeader } from "./TournamentHeader";
import { TournamentSidebar } from "./TournamentSidebar";
import type {
	InitialLiveData,
	LiveData,
	LogEntry,
	Standing,
	Station,
	TournamentData,
} from "./types";
import { useLiveTournament } from "./useLiveTournament";

export type { TournamentData } from "./types";

interface Props {
	tournament: TournamentData;
	formattedDate: string;
	initialLiveData: InitialLiveData;
	mirrorHtml?: string;
	mirrorData?: any;
}

const LIVE_STATUSES = new Set(["UNDERWAY", "CHECKIN"]);

const BTS_FALLBACK_POSTERS: Array<[RegExp, string, boolean]> = [
	[/#4/, "/tournaments/BTS4_poster.webp", false],
	[/#3|cm-bts3-auto-imported/, "/tournaments/BTS3_poster.webp", true],
	[/#2/, "/tournaments/BTS2.webp", false],
	[/#1/, "/tournaments/B_TS1.svg", false],
];

function resolvePoster(t: TournamentData): {
	url: string;
	unoptimized: boolean;
} {
	if (t.posterUrl) return { url: t.posterUrl, unoptimized: false };
	for (const [re, url, unoptimized] of BTS_FALLBACK_POSTERS) {
		if (re.test(t.name) || re.test(t.id)) return { url, unoptimized };
	}
	return { url: "/logo.webp", unoptimized: false };
}

export default function TournamentDetail({
	tournament,
	formattedDate,
	initialLiveData,
	mirrorHtml,
	mirrorData,
}: Props) {
	const { mode, setTheme } = useThemeMode();
	const [activeTab, setActiveTab] = useState(0);

	// Auto-switch theme for Stardust category
	useEffect(() => {
		const catName = tournament.category?.name?.toUpperCase() ?? "";
		if (catName.includes("STARDUST") && mode !== "blue") setTheme("blue");
	}, [tournament.category?.name, mode, setTheme]);

	const isLive = LIVE_STATUSES.has(tournament.status);
	const isBTS = tournament.name.toLowerCase().includes("bey-tamashii");
	const { url: posterUrl, unoptimized: unoptimizedPoster } =
		resolvePoster(tournament);

	const { liveData } = useLiveTournament(
		tournament.id,
		initialLiveData as LiveData,
		isLive,
	);

	const standings = (liveData.standings ?? []) as Standing[];
	const stations = (liveData.stations ?? []) as Station[];
	const activityLog = (liveData.activityLog ?? []) as LogEntry[];

	const liveCounters = isLive
		? {
				completed: activityLog.filter((e) => (e.type ?? "").includes("match"))
					.length,
				total: standings.length > 0 ? standings.length : 0,
			}
		: null;

	return (
		<Box
			sx={{ width: "100%", py: { xs: 2, md: 4 }, px: { xs: 2, md: 4, lg: 6 } }}
		>
			<TournamentHeader
				name={tournament.name}
				status={tournament.status}
				isBTS={isBTS}
				isLive={isLive}
				liveCounters={liveCounters}
			/>

			<Grid container spacing={{ xs: 3, md: 5 }}>
				<Grid size={{ xs: 12, lg: 4, xl: 3 }} sx={{ order: { xs: 1, lg: 2 } }}>
					<TournamentSidebar
						tournament={tournament}
						formattedDate={formattedDate}
						isBTS={isBTS}
						posterUrl={posterUrl}
						unoptimizedPoster={unoptimizedPoster}
					/>
				</Grid>

				<Grid size={{ xs: 12, lg: 8, xl: 9 }} sx={{ order: { xs: 2, lg: 1 } }}>
					{isLive && <LiveStations stations={stations} />}

					<AboutSection
						tournament={tournament}
						isBTS={isBTS}
					/>

					<Paper
						id="tournament-view"
						elevation={0}
						sx={{
							borderRadius: 8,
							border: "1px solid",
							borderColor: "divider",
							overflow: "hidden",
							boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
						}}
					>
						<Tabs
							value={activeTab}
							onChange={(_, v) => setActiveTab(v)}
							variant="fullWidth"
							sx={{
								bgcolor: "rgba(0,0,0,0.03)",
								borderBottom: "1px solid",
								borderColor: "divider",
								position: "sticky",
								top: 0,
								zIndex: 2,
								backdropFilter: "blur(8px)",
								"& .MuiTab-root": {
									fontWeight: 900,
									minHeight: 60,
									fontSize: "0.85rem",
								},
							}}
						>
							<Tab
								icon={<Trophy sx={{ fontSize: 20 }} />}
								iconPosition="start"
								label="TABLEAU"
							/>
							<Tab
								icon={<PoolsIcon sx={{ fontSize: 20 }} />}
								iconPosition="start"
								label="POULES"
							/>
							<Tab
								icon={<Leaderboard sx={{ fontSize: 20 }} />}
								iconPosition="start"
								label="CLASSEMENT"
							/>
						</Tabs>
						<Box sx={{ p: { xs: 1.5, md: 4 } }}>
							{activeTab === 0 && (
								mirrorHtml ? (
									<MirrorReact 
										html={mirrorHtml} 
										tournamentData={mirrorData} 
										baseUrl={tournament.challongeUrl?.split('/module')[0] ?? "https://challonge.com"} 
									/>
								) : (
									<TournamentBracketDb
										tournamentId={tournament.id}
										challongeUrl={tournament.challongeUrl}
									/>
								)
							)}
							{activeTab === 1 && <PoolsPanel tournamentId={tournament.id} />}
							{activeTab === 2 && <StandingsPanel standings={standings} />}
						</Box>
					</Paper>
				</Grid>
			</Grid>
		</Box>
	);
}
