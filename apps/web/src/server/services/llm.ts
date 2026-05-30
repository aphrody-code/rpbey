import "server-only";

/**
 * Couche LLM du chat RAG — branchée APRÈS le retrieval hybride pour synthétiser une réponse
 * en FRANÇAIS, texte naturel, à partir des seuls faits récupérés (cf. `services/chat.ts`)
 * ET de l'historique de conversation (mémoire multi-tour).
 *
 * Backend = NOTRE PROPRE LLM auto-hébergé : `llama.cpp` (`llama-server`) en loopback,
 * API OpenAI-compatible `/v1/chat/completions`. Zéro service tiers, zéro coût par message,
 * privé. Modèle swappable côté serveur (systemd `rpbey-llm.service`).
 *
 * Le corpus wiki est en anglais (Fandom) : le modèle traduit + reformule, mais ne doit RIEN
 * inventer hors du contexte fourni. Si le serveur LLM est absent/lent/en erreur, on renvoie
 * `null` (jamais une exception) et l'appelant retombe sur la synthèse extractive déterministe.
 */

const LLM_URL = process.env.RPBEY_LLM_URL ?? "http://127.0.0.1:8080/v1/chat/completions";
const MODEL = process.env.RPBEY_LLM_MODEL ?? "rpbey-local";
const TIMEOUT_MS = Number(process.env.RPBEY_LLM_TIMEOUT_MS ?? "60000");

/** Le LLM est actif sauf désactivation explicite (`RPBEY_CHAT_LLM=0`). */
export function isLlmEnabled(): boolean {
  return process.env.RPBEY_CHAT_LLM !== "0";
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

interface CompletionResponse {
  choices?: { message?: { content?: string } }[];
}

function body(messages: ChatTurn[], opts: GenerateOptions, stream: boolean): string {
  return JSON.stringify({
    model: MODEL,
    messages,
    stream,
    temperature: opts.temperature ?? 0.35,
    max_tokens: opts.maxTokens ?? 768,
    // Bride l'invention sur les petits modèles : pénalise la répétition, top_p resserré.
    top_p: 0.9,
    repeat_penalty: 1.1,
  });
}

/**
 * Génère une réponse complète (non-stream). Renvoie `null` (jamais throw) si le LLM est
 * désactivé, indisponible, trop lent, ou répond vide — l'appelant retombe sur l'extractif.
 */
export async function generate(
  messages: ChatTurn[],
  opts: GenerateOptions = {},
): Promise<string | null> {
  if (!isLlmEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: body(messages, opts, false),
    });
    if (!res.ok) {
      console.warn(`[chat/llm] ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    const data = (await res.json()) as CompletionResponse;
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.warn("[chat/llm] appel échoué:", (err as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Génère en STREAMING (SSE OpenAI-compatible) : yield chaque fragment de texte dès qu'il
 * arrive. Indispensable sur CPU (~11 tok/s) pour que la réponse s'écrive en direct plutôt
 * que de figer plusieurs secondes. Si le LLM est indisponible, le générateur ne yield rien
 * (l'appelant détecte le vide et bascule sur l'extractif).
 */
export async function* generateStream(
  messages: ChatTurn[],
  opts: GenerateOptions = {},
): AsyncGenerator<string, void, unknown> {
  if (!isLlmEnabled()) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: body(messages, opts, true),
    });
    if (!res.ok || !res.body) {
      console.warn(`[chat/llm] stream ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Découpe par lignes SSE ; chaque event = `data: {json}` (ou `data: [DONE]`).
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // fragment JSON incomplet : ignoré (rare, llama-server émet des events entiers).
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.warn("[chat/llm] stream échoué:", (err as Error).message);
    }
  } finally {
    clearTimeout(timer);
  }
}
