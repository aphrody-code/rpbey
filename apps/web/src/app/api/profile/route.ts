import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, eq } from "@/lib/db";

export async function GET() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const profileRow = await db.query.profiles.findFirst({
			where: eq(schema.profiles.userId, session.user.id),
			with: {
				user: {
					with: {
						tournamentParticipants: {
							with: {
								tournament: true,
							},
						},
					},
				},
			},
		});

		if (!profileRow) {
			return NextResponse.json({ error: "Profile not found" }, { status: 404 });
		}

		// Remap relation field names to Prisma-style
		const profile = {
			...profileRow,
			user: {
				...profileRow.user,
				tournaments: profileRow.user.tournamentParticipants,
			},
		};

		return NextResponse.json(profile);
	} catch (error) {
		console.error("Error fetching profile:", error);
		return NextResponse.json(
			{ error: "Failed to fetch profile" },
			{ status: 500 },
		);
	}
}

export async function PATCH(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			bladerName,
			favoriteType,
			experience,
			bio,
			challongeUsername,
			deckBoxImage,
			image, // Add image (avatar)
		} = body;

		// Update User first if image is provided
		if (image) {
			await db
				.update(schema.users)
				.set({ image })
				.where(eq(schema.users.id, session.user.id));
		}

		const [profile] = await db
			.insert(schema.profiles)
			.values({
				userId: session.user.id,
				bladerName: bladerName ?? session.user.name,
				favoriteType,
				experience,
				bio,
				challongeUsername,
				deckBoxImage,
			})
			.onConflictDoUpdate({
				target: schema.profiles.userId,
				set: {
					bladerName,
					favoriteType,
					experience,
					bio,
					challongeUsername,
					deckBoxImage,
				},
			})
			.returning();

		return NextResponse.json(profile);
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json(
			{ error: "Failed to update profile" },
			{ status: 500 },
		);
	}
}
