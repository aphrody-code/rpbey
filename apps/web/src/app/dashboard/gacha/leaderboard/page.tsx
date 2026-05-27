import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import { db, schema, count, desc, inArray } from "@/lib/db";
import { LeaderboardClient } from "./_components/LeaderboardClient";

export const metadata: Metadata = {
	title: "Classement | Gacha Dashboard",
	description: "Classement gacha : pièces, victoires, MMR et collection.",
};

export const revalidate = 60;

export default async function GachaLeaderboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/sign-in");
	}

	// Fetch top 100 profiles with user info + card counts
	const profiles = await db.query.profiles.findMany({
		orderBy: desc(schema.profiles.currency),
		limit: 100,
		columns: {
			userId: true,
			bladerName: true,
			currency: true,
			duelWins: true,
			duelRating: true,
		},
		with: {
			user: {
				columns: {
					name: true,
					image: true,
				},
			},
		},
	});

	// Count cards per user in one query
	const userIds = profiles.map((p) => p.userId);
	const cardCounts = userIds.length
		? await db
				.select({
					userId: schema.cardInventory.userId,
					value: count(),
				})
				.from(schema.cardInventory)
				.where(inArray(schema.cardInventory.userId, userIds))
				.groupBy(schema.cardInventory.userId)
		: [];
	const cardCountMap = new Map<string, number>(
		cardCounts.map((c) => [c.userId, c.value]),
	);

	const entries = profiles.map((p) => ({
		rank: 0, // computed client-side per tab
		userId: p.userId,
		name: p.bladerName ?? p.user.name,
		image: p.user.image,
		currency: p.currency,
		duelWins: p.duelWins,
		duelRating: p.duelRating,
		cardCount: cardCountMap.get(p.userId) ?? 0,
		isCurrentUser: p.userId === session.user.id,
	}));

	return (
		<Box>
			<Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
				Classement
			</Typography>
			<LeaderboardClient entries={entries} />
		</Box>
	);
}
