import { type NextRequest } from "next/server";
import { type ChatTurn, prepareTurn } from "@/server/services/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat — chat RAG Beyblade avec MÉMOIRE conversationnelle + STREAMING.
 * Body `{ message: string, history?: {role,content}[] }`.
 *
 * Réponse = flux SSE (`text/event-stream`), une ligne `data: {json}` par événement :
 *   { type:"meta",  intent, found, sources, followups }   (1×, en tête)
 *   { type:"delta", text }                                 (N×, le texte qui s'écrit)
 *   { type:"done" }                                        (1×, fin)
 * Le retrieval + la construction des messages se font dans `prepareTurn` ; la génération
 * est streamée depuis NOTRE LLM local (cf. `services/llm.ts`). Si le LLM lâche, on envoie
 * le brouillon extractif déterministe en un seul `delta` (jamais d'écran vide).
 */
export async function POST(req: NextRequest) {
  let message = "";
  let history: ChatTurn[] = [];
  try {
    const b = (await req.json()) as { message?: unknown; history?: unknown };
    if (typeof b.message === "string") message = b.message.trim();
    if (Array.isArray(b.history)) history = sanitizeHistory(b.history);
  } catch {
    return sseError("Corps JSON invalide");
  }
  if (message.length < 2) return sseError("Message trop court");
  if (message.length > 400) message = message.slice(0, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const p = await prepareTurn(message, history);
        send({
          type: "meta",
          intent: p.intent,
          found: p.found,
          sources: p.sources,
          followups: p.followups,
        });

        if (p.fixed != null) {
          send({ type: "delta", text: p.fixed });
        } else {
          send({ type: "delta", text: p.draft ?? "Le savoir vacille, réessaie." });
        }
        send({ type: "done" });
      } catch (err) {
        console.error("[api/chat] erreur:", err);
        send({ type: "delta", text: "Le savoir vacille un instant. Réessaie." });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Borne et nettoie l'historique reçu du client (mémoire) : rôles valides, tailles capées. */
function sanitizeHistory(raw: unknown[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of raw.slice(-16)) {
    if (!t || typeof t !== "object") continue;
    const r = (t as { role?: unknown }).role;
    const c = (t as { content?: unknown }).content;
    if ((r === "user" || r === "assistant") && typeof c === "string" && c.trim()) {
      out.push({ role: r, content: c.slice(0, 1200) });
    }
  }
  return out;
}

/** Réponse SSE d'erreur (le client parse le même format que le flux normal). */
function sseError(msg: string): Response {
  const body = `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`;
  return new Response(body, {
    status: 400,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
