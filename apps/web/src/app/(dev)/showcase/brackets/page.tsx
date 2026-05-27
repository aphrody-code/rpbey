"use client";

import { useState } from "react";

import GitHubIcon from "@mui/icons-material/GitHub";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { BracketsThemeSwitch, BracketsViewer } from "@/components/brackets";
import { useBracketsTheme } from "@/hooks/brackets";
import { mock, type MockKey } from "@/lib/brackets";

const TABS: { key: MockKey; label: string; description: string }[] = [
	{
		key: "roundRobin",
		label: "Round Robin",
		description:
			"4 equipes, 1 groupe, 3 rounds. Ranking table affichee a droite.",
	},
	{
		key: "singleElimination",
		label: "Single Elimination",
		description: "8 equipes, bracket simple, QF -> SF -> Finale.",
	},
	{
		key: "doubleElimination",
		label: "Double Elimination",
		description: "8 equipes, winner + loser bracket + grand final.",
	},
];

const REPOS = [
	{
		name: "@rose-griffon/challonge-core",
		url: "https://github.com/rpbey/brackets-model",
	},
	{
		name: "@rose-griffon/challonge-core",
		url: "https://github.com/rpbey/brackets-manager.js",
	},
	{
		name: "@rose-griffon/challonge-core",
		url: "https://github.com/rpbey/brackets-viewer.js",
	},
];

const SNIPPET = `import { BracketsViewer } from "@/components/brackets";
import { mock } from "@/lib/brackets";

export default function MyPage() {
	return <BracketsViewer data={mock.singleElimination} />;
}`;

export default function BracketsShowcasePage(): React.ReactElement {
	const [tab, setTab] = useState<MockKey>("roundRobin");
	const { theme, setTheme } = useBracketsTheme();
	const [showRanking, setShowRanking] = useState(true);
	const [highlight, setHighlight] = useState(true);
	const [originBefore, setOriginBefore] = useState(true);

	const active = TABS.find((t) => t.key === tab) ?? TABS[0];

	return (
		<Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
			<AppBar
				position="sticky"
				color="default"
				elevation={0}
				sx={{ borderBottom: 1, borderColor: "divider" }}
			>
				<Toolbar>
					<Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
						Brackets Showcase
					</Typography>
					<Chip
						label="@rose-griffon/challonge-core 2.0.0-rpbey.0"
						size="small"
						variant="outlined"
						sx={{ mr: 2 }}
					/>
					<BracketsThemeSwitch value={theme} onChange={setTheme} />
					{REPOS.slice(0, 1).map((r) => (
						<Tooltip key={r.url} title="Voir sur GitHub" arrow>
							<IconButton
								component="a"
								href={r.url}
								target="_blank"
								rel="noreferrer noopener"
							>
								<GitHubIcon />
							</IconButton>
						</Tooltip>
					))}
				</Toolbar>
			</AppBar>

			<Container maxWidth="xl" sx={{ py: 4 }}>
				<Stack spacing={3}>
					<Box>
						<Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
							Tournament brackets — Material Design 3
						</Typography>
						<Typography
							variant="body1"
							color="text.secondary"
							sx={{ maxWidth: 720 }}
						>
							Demonstration des 3 types de stages supportes par le fork rpbey du
							viewer brackets-viewer.js. UI refondue avec les tokens Material
							Design 3 (color, shape, elevation, motion, state layers).
						</Typography>
					</Box>

					<Tabs
						value={tab}
						onChange={(_e, v: MockKey): void => setTab(v)}
						aria-label="Type de stage"
						variant="scrollable"
						scrollButtons="auto"
					>
						{TABS.map((t) => (
							<Tab key={t.key} label={t.label} value={t.key} />
						))}
					</Tabs>

					<Box
						sx={{
							display: "grid",
							gap: 3,
							gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
						}}
					>
						<Card elevation={1} sx={{ borderRadius: 3 }}>
							<CardContent>
								<Typography variant="overline" color="text.secondary">
									{active?.label}
								</Typography>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{ mb: 2 }}
								>
									{active?.description}
								</Typography>
								<BracketsViewer
									data={mock[tab]}
									theme={theme}
									config={{
										showRankingTable: showRanking,
										highlightParticipantOnHover: highlight,
										participantOriginPlacement: originBefore
											? "before"
											: "after",
									}}
									sx={{ minHeight: 400 }}
								/>
							</CardContent>
						</Card>

						<Stack spacing={3}>
							<Card variant="outlined" sx={{ borderRadius: 3 }}>
								<CardContent>
									<Typography variant="subtitle2" gutterBottom>
										Configuration
									</Typography>
									<Stack spacing={1}>
										<FormControlLabel
											control={
												<Switch
													checked={showRanking}
													onChange={(e): void =>
														setShowRanking(e.target.checked)
													}
												/>
											}
											label="Ranking table (round-robin)"
										/>
										<FormControlLabel
											control={
												<Switch
													checked={highlight}
													onChange={(e): void => setHighlight(e.target.checked)}
												/>
											}
											label="Highlight participant on hover"
										/>
										<FormControlLabel
											control={
												<Switch
													checked={originBefore}
													onChange={(e): void =>
														setOriginBefore(e.target.checked)
													}
												/>
											}
											label={`Origin placement: ${originBefore ? "before" : "after"}`}
										/>
									</Stack>
								</CardContent>
							</Card>

							<Card variant="outlined" sx={{ borderRadius: 3 }}>
								<CardContent>
									<Typography variant="subtitle2" gutterBottom>
										Usage
									</Typography>
									<Box
										component="pre"
										sx={{
											m: 0,
											p: 2,
											borderRadius: 2,
											bgcolor: "grey.900",
											color: "grey.100",
											fontSize: 12,
											fontFamily: "var(--font-mono, monospace)",
											overflow: "auto",
										}}
									>
										<code>{SNIPPET}</code>
									</Box>
								</CardContent>
							</Card>

							<Card variant="outlined" sx={{ borderRadius: 3 }}>
								<CardContent>
									<Typography variant="subtitle2" gutterBottom>
										Forks rpbey
									</Typography>
									<Stack spacing={1}>
										{REPOS.map((r) => (
											<Stack
												key={r.url}
												direction="row"
												sx={{ alignItems: "center" }}
												spacing={1}
												component={Link}
												href={r.url}
												target="_blank"
												rel="noreferrer noopener"
												underline="hover"
												color="primary"
											>
												<GitHubIcon fontSize="small" />
												<Typography
													variant="body2"
													sx={{ fontFamily: "monospace" }}
												>
													{r.name}
												</Typography>
											</Stack>
										))}
									</Stack>
								</CardContent>
							</Card>
						</Stack>
					</Box>

					<Divider />

					<Typography variant="caption" color="text.secondary">
						Page de developpement — non indexee. Source :{" "}
						<code>src/app/(dev)/showcase/brackets/page.tsx</code>.
					</Typography>
				</Stack>
			</Container>
		</Box>
	);
}
