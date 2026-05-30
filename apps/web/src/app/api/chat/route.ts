import { type NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/server/services/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat — chat RAG Beyblade (ZÉRO LLM). Body `{ message: string }`.
 * Retrieval hybride sur le corpus unifié + synthèse extractive (cf. `services/chat.ts`).
 * Réponse `{ ok, data: ChatAnswer }`. Self-contained (validation inline, pas de contrat
 * partagé) pour rester découplé des autres évolutions d'API.
 */
export async function POST(req: NextRequest) {
  let message = "";
  try {
    const body = (await req.json()) as { message?: unknown };
    if (typeof body.message === "string") message = body.message.trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Corps JSON invalide" } },
      { status: 400 },
    );
  }

  if (message.length < 2) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Message trop court" } },
      { status: 400 },
    );
  }
  if (message.length > 400) message = message.slice(0, 400);

  try {
    const data = await answerQuestion(message);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[api/chat] erreur:", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Le savoir vacille, réessaie." } },
      { status: 500 },
    );
  }
}
