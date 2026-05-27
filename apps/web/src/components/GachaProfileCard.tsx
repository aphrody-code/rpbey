"use client";

import {
	AutoAwesome,
	Casino,
	EmojiEvents,
	LocalFireDepartment,
	Toll,
	TrendingUp,
} from "@mui/icons-material";
import {
	Avatar,
	Box,
	Card,
	CardContent,
	Chip,
	Divider,
	Grid,
	Stack,
	Tooltip,
	Typography,
} from "@mui/material";

interface ProfileShape {
	id: string;
	userId: string;
	bladerName: string | null;
	currency: number;
	dailyStreak: number;
	lastDaily: Date | string | null;
	pityCount: number;
	wins: number;
	losses: number;
	tournamentWins: number;
	duelRating: number;
	duelWins: number;
	duelLosses: number;
	cardCount: number;
	user: {
		name: string | null;
		image: string | null;
	};
}

interface StatItemProps {
	label: string;
	value: string | number;
	icon: React.ReactNode;
	color?: string;
}

function StatItem({
	label,
	value,
	icon,
	color = "text.secondary",
}: StatItemProps) {
	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 0.5,
				p: 1.5,
				borderRadius: 2,
				bgcolor: "background.default",
				border: "1px solid",
				borderColor: "divider",
				minWidth: 80,
			}}
		>
			<Box sx={{ color }}>{icon}</Box>
			<Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
				{value}
			</Typography>
			<Typography
				variant="caption"
				sx={{ color: "text.secondary", textAlign: "center" }}
			>
				{label}
			</Typography>
		</Box>
	);
}

export function GachaProfileCard({ profile }: { profile: ProfileShape }) {
	const lastDailyStr = profile.lastDaily
		? new Date(profile.lastDaily).toLocaleDateString("fr-FR", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "Jamais";

	const winRate =
		profile.wins + profile.losses > 0
			? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
			: 0;

	return (
		<Card
			elevation={0}
			sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}
		>
			<CardContent sx={{ p: 3 }}>
				{/* Header */}
				<Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
					<Avatar
						src={profile.user.image ?? undefined}
						alt={profile.user.name ?? "Utilisateur"}
						sx={{ width: 56, height: 56, borderRadius: 2 }}
					/>
					<Box sx={{ flexGrow: 1, minWidth: 0 }}>
						<Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
							{profile.bladerName ?? profile.user.name ?? "Blader"}
						</Typography>
						<Chip
							label={`MMR ${profile.duelRating}`}
							size="small"
							sx={{
								bgcolor: "primary.main",
								color: "primary.contrastText",
								fontWeight: 600,
							}}
						/>
					</Box>
				</Stack>

				<Divider sx={{ mb: 3 }} />

				{/* Stats grid */}
				<Grid container spacing={1.5}>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Pièces"
							value={profile.currency.toLocaleString("fr-FR")}
							icon={<Toll />}
							color="#fbbf24"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Série quotidienne"
							value={profile.dailyStreak}
							icon={<LocalFireDepartment />}
							color="#f97316"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Compteur pity"
							value={`${profile.pityCount}/3`}
							icon={<AutoAwesome />}
							color="#a855f7"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Cartes possédées"
							value={profile.cardCount}
							icon={<Casino />}
							color="#3b82f6"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="MMR Duel"
							value={profile.duelRating}
							icon={<TrendingUp />}
							color="#ec4899"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Victoires duel"
							value={profile.duelWins}
							icon={<EmojiEvents />}
							color="#22c55e"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Défaites duel"
							value={profile.duelLosses}
							icon={<EmojiEvents sx={{ transform: "scaleY(-1)" }} />}
							color="#ef4444"
						/>
					</Grid>
					<Grid size={{ xs: 6, sm: 4, md: 3 }}>
						<StatItem
							label="Winrate tournoi"
							value={`${winRate}%`}
							icon={<EmojiEvents />}
							color="#fbbf24"
						/>
					</Grid>
				</Grid>

				<Divider sx={{ my: 2 }} />

				<Tooltip title={lastDailyStr}>
					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						Dernier daily : {lastDailyStr}
					</Typography>
				</Tooltip>
			</CardContent>
		</Card>
	);
}
