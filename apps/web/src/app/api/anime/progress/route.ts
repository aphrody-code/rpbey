import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveWatchProgress } from "@/server/dal/anime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      return NextResponse.json({ error: "episodeId et progressTime requis" }, { status: 400 });
    }

    const progress = await saveWatchProgress(
      session.user.id,
      episodeId,
      progressTime,
      duration ?? 0,
    );

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Error updating watch progress:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
