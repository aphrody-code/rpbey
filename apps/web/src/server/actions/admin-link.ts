"use server";

import { revalidatePath } from "next/cache";
import { db, schema, or, like, isNotNull, asc, desc, eq } from "@/lib/db";

export async function getUnlinkedParticipants() {
	// On récupère les tournois BTS 1, 2 et 3
	const rows = await db.query.tournaments.findMany({
		where: or(
			like(schema.tournaments.challongeUrl, "%B_TS1%"),
			like(schema.tournaments.challongeUrl, "%B_TS2%"),
			like(schema.tournaments.challongeUrl, "%B_TS3%"),
		),
		with: {
			tournamentParticipants: {
				with: {
					user: {
						with: { profiles: true },
					},
				},
				orderBy: asc(schema.tournamentParticipants.finalPlacement),
			},
		},
		orderBy: desc(schema.tournaments.date),
	});

	return rows.map((t) => ({
		...t,
		participants: t.tournamentParticipants.map((p) => ({
			...p,
			user: p.user ? { ...p.user, profile: p.user.profiles[0] ?? null } : null,
		})),
	}));
}

export async function getAllRealUsers() {
	// Récupère les utilisateurs qui ont un ID Discord (donc "réels")
	const users = await db.query.users.findMany({
		where: isNotNull(schema.users.discordId),
		columns: {
			id: true,
			name: true,
			discordTag: true,
			discordId: true,
			image: true,
		},
		with: {
			profiles: { columns: { bladerName: true } },
		},
		orderBy: asc(schema.users.name),
	});

	return users.map((u) => ({
		id: u.id,
		name: u.name,
		discordTag: u.discordTag,
		discordId: u.discordId,
		image: u.image,
		profile: u.profiles[0] ?? null,
	}));
}

export async function mergeUserAccounts(
	placeholderUserId: string,
	realUserId: string,
) {
	if (placeholderUserId === realUserId) throw new Error("Même utilisateur");

	try {
		return await db.transaction(async (tx) => {
			// 1. Mettre à jour les participations aux tournois
			await tx
				.update(schema.tournamentParticipants)
				.set({ userId: realUserId })
				.where(eq(schema.tournamentParticipants.userId, placeholderUserId));

			// 2. Mettre à jour les matchs (Player 1)
			await tx
				.update(schema.tournamentMatches)
				.set({ player1Id: realUserId })
				.where(eq(schema.tournamentMatches.player1Id, placeholderUserId));

			// 3. Mettre à jour les matchs (Player 2)
			await tx
				.update(schema.tournamentMatches)
				.set({ player2Id: realUserId })
				.where(eq(schema.tournamentMatches.player2Id, placeholderUserId));

			// 4. Mettre à jour les matchs (Winner)
			await tx
				.update(schema.tournamentMatches)
				.set({ winnerId: realUserId })
				.where(eq(schema.tournamentMatches.winnerId, placeholderUserId));

			// 5. Mettre à jour les Decks
			await tx
				.update(schema.decks)
				.set({ userId: realUserId })
				.where(eq(schema.decks.userId, placeholderUserId));

			// 6. Supprimer l'utilisateur placeholder
			// On vérifie d'abord qu'il n'a plus de dépendances critiques
			await tx
				.delete(schema.users)
				.where(eq(schema.users.id, placeholderUserId));

			revalidatePath("/admin/link");
			return { success: true };
		});
	} catch (error) {
		console.error("Merge Error:", error);
		throw new Error("Erreur lors de la fusion des comptes");
	}
}
