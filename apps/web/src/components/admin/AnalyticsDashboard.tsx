"use client";

import {
	BarChart as BarChartIcon,
	CalendarMonth,
	Circle,
	Insights,
	Language,
	Visibility,
} from "@mui/icons-material";
import {
	Box,
	Card,
	CardContent,
	CardHeader,
	Chip,
	Grid,
	LinearProgress,
	List,
	ListItem,
	ListItemText,
	Stack,
	Typography,
} from "@mui/material";
import {
	type AnalyticsSummary,
	useAnalyticsStream,
} from "@/hooks/useAnalyticsStream";

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const s = Math.floor(diff / 1000);
	if (s < 60) return `il y a ${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `il y a ${m}min`;
	const h = Math.floor(m / 60);
	if (h < 24) return `il y a ${h}h`;
	return new Date(iso).toLocaleDateString("fr-FR");
}

const EVENT_LABELS: Record<string, string> = {
	pageview: "Page vue",
	tournament_register: "Inscription tournoi",
	profile_claim: "Liaison profil",
	gacha_pull: "Tirage gacha",
	deck_create: "Création deck",
};

function StatCard({
	label,
	value,
	change,
	icon: Icon,
	color,
}: {
	label: string;
	value: string;
	change?: string;
	icon: typeof Visibility;
	color: string;
}) {
	return (
		<Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: "100%" }}>
			<CardContent sx={{ p: 3 }}>
				<Stack
					direction="row"
					sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
				>
					<Box>
						<Typography
							variant="body2"
							sx={{ color: "text.secondary", fontWeight: "bold" }}
						>
							{label}
						</Typography>
						<Typography variant="h4" sx={{ fontWeight: "bold" }}>
							{value}
						</Typography>
						{change ? (
							<Typography
								variant="caption"
								sx={{ color: "text.secondary", fontWeight: "bold" }}
							>
								{change}
							</Typography>
						) : null}
					</Box>
					<Icon sx={{ color, opacity: 0.8 }} />
				</Stack>
			</CardContent>
		</Card>
	);
}

export function AnalyticsDashboard({ initial }: { initial: AnalyticsSummary }) {
	const { data, live } = useAnalyticsStream(initial);

	const maxPageViews = Math.max(1, ...data.topPages.map((p) => p.views));
	const maxRef = Math.max(1, ...data.topReferrers.map((r) => r.count));

	return (
		<Box sx={{ py: 4 }}>
			<Stack
				direction="row"
				sx={{ justifyContent: "space-between", alignItems: "center", mb: 4 }}
			>
				<Box>
					<Typography variant="h4" gutterBottom sx={{ fontWeight: "bold" }}>
						Analytics temps réel
					</Typography>
					<Typography variant="body1" sx={{ color: "text.secondary" }}>
						Trafic en direct, pages vues et événements métier
					</Typography>
				</Box>
				<Chip
					icon={
						<Circle
							sx={{
								fontSize: "0.7rem !important",
								color: live ? "success.main" : "warning.main",
							}}
						/>
					}
					label={live ? "Direct (SSE)" : "Polling"}
					variant="outlined"
					sx={{
						fontWeight: 600,
						borderColor: live
							? "color-mix(in srgb, var(--rpb-secondary) 40%, transparent)"
							: "divider",
					}}
				/>
			</Stack>

			<Grid container spacing={3} sx={{ mb: 4 }}>
				<Grid size={{ xs: 12, sm: 6, lg: 3 }}>
					<StatCard
						label="Visiteurs en direct"
						value={data.liveVisitors.toLocaleString("fr-FR")}
						change="5 dernières minutes"
						icon={Insights}
						color="var(--rpb-secondary)"
					/>
				</Grid>
				<Grid size={{ xs: 12, sm: 6, lg: 3 }}>
					<StatCard
						label="Pages vues (aujourd'hui)"
						value={data.pageviewsToday.toLocaleString("fr-FR")}
						icon={Visibility}
						color="#3b82f6"
					/>
				</Grid>
				<Grid size={{ xs: 12, sm: 6, lg: 3 }}>
					<StatCard
						label="Pages vues (7 jours)"
						value={data.pageviews7d.toLocaleString("fr-FR")}
						icon={CalendarMonth}
						color="var(--rpb-primary)"
					/>
				</Grid>
				<Grid size={{ xs: 12, sm: 6, lg: 3 }}>
					<StatCard
						label="Événements (aujourd'hui)"
						value={data.eventsToday.toLocaleString("fr-FR")}
						icon={BarChartIcon}
						color="#10b981"
					/>
				</Grid>
			</Grid>

			<Grid container spacing={3}>
				<Grid size={{ xs: 12, lg: 6 }}>
					<Card variant="outlined" sx={{ height: "100%" }}>
						<CardHeader
							title={
								<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
									<Visibility fontSize="small" />
									<Typography variant="h6">Top pages (7j)</Typography>
								</Stack>
							}
						/>
						<CardContent>
							{data.topPages.length === 0 ? (
								<Typography variant="body2" sx={{ color: "text.secondary" }}>
									Aucune donnée pour l'instant.
								</Typography>
							) : (
								<Stack spacing={2}>
									{data.topPages.map((p) => (
										<Box key={p.path}>
											<Stack
												direction="row"
												sx={{ justifyContent: "space-between", mb: 0.5 }}
											>
												<Typography
													variant="body2"
													noWrap
													sx={{ fontWeight: 600, maxWidth: "75%" }}
												>
													{p.path}
												</Typography>
												<Typography
													variant="body2"
													sx={{ color: "text.secondary", fontWeight: 700 }}
												>
													{p.views.toLocaleString("fr-FR")}
												</Typography>
											</Stack>
											<LinearProgress
												variant="determinate"
												value={(p.views / maxPageViews) * 100}
												sx={{
													height: 6,
													borderRadius: 3,
													bgcolor:
														"color-mix(in srgb, var(--rpb-secondary) 12%, transparent)",
													"& .MuiLinearProgress-bar": {
														bgcolor: "var(--rpb-secondary)",
													},
												}}
											/>
										</Box>
									))}
								</Stack>
							)}
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, lg: 6 }}>
					<Card variant="outlined" sx={{ height: "100%" }}>
						<CardHeader
							title={
								<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
									<Language fontSize="small" />
									<Typography variant="h6">Top referrers (7j)</Typography>
								</Stack>
							}
						/>
						<CardContent>
							{data.topReferrers.length === 0 ? (
								<Typography variant="body2" sx={{ color: "text.secondary" }}>
									Aucun referrer externe pour l'instant.
								</Typography>
							) : (
								<Stack spacing={2}>
									{data.topReferrers.map((r) => (
										<Box key={r.referrer}>
											<Stack
												direction="row"
												sx={{ justifyContent: "space-between", mb: 0.5 }}
											>
												<Typography
													variant="body2"
													noWrap
													sx={{ fontWeight: 600, maxWidth: "75%" }}
												>
													{r.referrer}
												</Typography>
												<Typography
													variant="body2"
													sx={{ color: "text.secondary", fontWeight: 700 }}
												>
													{r.count.toLocaleString("fr-FR")}
												</Typography>
											</Stack>
											<LinearProgress
												variant="determinate"
												value={(r.count / maxRef) * 100}
												sx={{
													height: 6,
													borderRadius: 3,
													bgcolor:
														"color-mix(in srgb, var(--rpb-primary) 12%, transparent)",
													"& .MuiLinearProgress-bar": {
														bgcolor: "var(--rpb-primary)",
													},
												}}
											/>
										</Box>
									))}
								</Stack>
							)}
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12 }}>
					<Card variant="outlined">
						<CardHeader
							title={
								<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
									<Insights fontSize="small" />
									<Typography variant="h6">Événements récents</Typography>
								</Stack>
							}
						/>
						<CardContent>
							{data.recentEvents.length === 0 ? (
								<Typography variant="body2" sx={{ color: "text.secondary" }}>
									Aucun événement récent.
								</Typography>
							) : (
								<List dense disablePadding>
									{data.recentEvents.map((e, i) => (
										<ListItem
											key={e.id}
											divider={i !== data.recentEvents.length - 1}
											secondaryAction={
												<Typography
													variant="caption"
													sx={{ color: "text.secondary" }}
												>
													{timeAgo(e.createdAt)}
												</Typography>
											}
										>
											<ListItemText
												primary={
													<Stack
														direction="row"
														spacing={1}
														sx={{ alignItems: "center" }}
													>
														<Chip
															size="small"
															label={EVENT_LABELS[e.type] ?? e.type}
															sx={{
																fontWeight: 600,
																bgcolor:
																	e.type === "pageview"
																		? "color-mix(in srgb, var(--rpb-secondary) 15%, transparent)"
																		: "color-mix(in srgb, var(--rpb-primary) 15%, transparent)",
															}}
														/>
														<Typography variant="body2" noWrap>
															{e.path ?? "-"}
														</Typography>
													</Stack>
												}
												secondary={e.userId ? `user: ${e.userId}` : "anonyme"}
											/>
										</ListItem>
									))}
								</List>
							)}
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Box>
	);
}
