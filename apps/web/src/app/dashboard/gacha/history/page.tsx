import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import { db, schema, and, desc, eq } from "@/lib/db";
import type { TransactionType } from "@/lib/types";
import { HistoryClient } from "./_components/HistoryClient";

export const metadata: Metadata = {
	title: "Historique | Gacha Dashboard",
	description: "Historique de vos transactions de pièces gacha.",
};

const VALID_TYPES = new Set<string>([
	"DAILY_CLAIM",
	"GACHA_PULL",
	"MULTI_PULL",
	"ADMIN_GIVE",
	"ADMIN_TAKE",
	"TOURNAMENT_REWARD",
	"SELL_CARD",
	"STREAK_BONUS",
	"BADGE_REWARD",
	"DUEL_REWARD",
]);

interface PageProps {
	searchParams: Promise<{
		type?: string;
	}>;
}

export default async function GachaHistoryPage({ searchParams }: PageProps) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/sign-in");
	}

	const sp = await searchParams;
	const rawType = sp.type ?? "";
	const typeFilter: TransactionType | "" = VALID_TYPES.has(rawType)
		? (rawType as TransactionType)
		: "";

	const transactions = await db.query.currencyTransactions.findMany({
		where: and(
			eq(schema.currencyTransactions.userId, session.user.id),
			...(typeFilter ? [eq(schema.currencyTransactions.type, typeFilter)] : []),
		),
		orderBy: desc(schema.currencyTransactions.createdAt),
		limit: 100,
		columns: {
			id: true,
			amount: true,
			type: true,
			note: true,
			createdAt: true,
		},
	});

	return (
		<Box>
			<Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
				Historique des transactions
			</Typography>
			<HistoryClient transactions={transactions} typeFilter={typeFilter} />
		</Box>
	);
}
