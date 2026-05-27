import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
		}

		const body = await request.json();
		const { episodeId, progressTime, duration } = body;

		if (!episodeId || progressTime == null) {
			return NextResponse.json(
				{ error: "episodeId et progressTime requis" },
				{ status: 400 },
			);
		}

		const isCompleted = duration > 0 && progressTime / duration > 0.9;

		const [progress] = await db
			.insert(schema.animeWatchProgress)
			.values({
				userId: session.user.id,
				episodeId,
				progressTime: Math.floor(progressTime),
				status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
				completedAt: isCompleted ? new Date().toISOString() : null,
			})
			.onConflictDoUpdate({
				target: [
					schema.animeWatchProgress.userId,
					schema.animeWatchProgress.episodeId,
				],
				set: {
					progressTime: Math.floor(progressTime),
					status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
					completedAt: isCompleted ? new Date().toISOString() : null,
				},
			})
			.returning();

		return NextResponse.json(progress);
	} catch (error) {
		console.error("Error updating watch progress:", error);
		return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
	}
}
