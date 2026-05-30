import "server-only";

import { GoogleAuth } from "google-auth-library";

/**
 * Couche LLM du chat RAG (Vertex AI / Gemini) — branchée APRÈS le retrieval hybride pour
 * synthétiser une réponse en FRANÇAIS, texte naturel, à partir des seuls faits récupérés
 * dans le corpus (cf. `services/chat.ts`). Le corpus wiki est en anglais (Fandom) : le
 * modèle traduit + reformule, mais ne doit RIEN inventer hors du contexte fourni.
 *
 * Auth : service account ADC via `GOOGLE_APPLICATION_CREDENTIALS` (partagé avec aphrody).
 * Aucun nouveau SDK : `google-auth-library` (déjà présent) signe le token, l'appel passe
 * par l'API REST Vertex `generateContent`. Si la config manque ou l'appel échoue/dépasse
 * le délai, on renvoie `null` et l'appelant retombe sur la synthèse extractive déterministe.
 */

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION ?? process.env.GOOGLE_CLOUD_REGION ?? "us-central1";
const MODEL = process.env.RPBEY_CHAT_MODEL ?? "gemini-2.5-flash";
const TIMEOUT_MS = Number(process.env.RPBEY_CHAT_LLM_TIMEOUT_MS ?? "9000");

/** Le LLM est actif si un projet GCP + des credentials ADC sont configurés. */
export function isLlmEnabled(): boolean {
  if (process.env.RPBEY_CHAT_LLM === "0") return false;
  return Boolean(PROJECT) && Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

let auth: GoogleAuth | null = null;
// Token d'accès mis en cache (TTL ~1 h côté Google) pour éviter une signature par requête.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > nowMs()) return cachedToken.value;
  auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) return null;
  // google-auth-library ne renvoie pas l'expiry ici : on prend une marge prudente de 50 min.
  cachedToken = { value: token, expiresAt: nowMs() + 50 * 60_000 };
  return token;
}

// `Date.now()` isolé pour rester testable et lisible.
function nowMs(): number {
  return Date.now();
}

interface GenerateOptions {
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
}

interface VertexResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Génère une réponse texte via Gemini sur Vertex. Renvoie `null` (jamais une exception)
 * si le LLM est désactivé, indisponible, trop lent, ou répond vide — l'appelant doit
 * alors retomber sur sa synthèse extractive.
 */
export async function generate(opts: GenerateOptions): Promise<string | null> {
  if (!isLlmEnabled()) return null;
  let token: string | null;
  try {
    token = await accessToken();
  } catch (err) {
    console.warn("[chat/llm] token indisponible:", (err as Error).message);
    return null;
  }
  if (!token) return null;

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          topP: 0.95,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
          // gemini-2.5-flash est un modèle « thinking » : sans bride, le raisonnement
          // interne consomme le budget de sortie et TRONQUE la réponse visible. On le
          // coupe (budget 0) — le chat veut une réponse directe, pas de la réflexion.
          thinkingConfig: { thinkingBudget: 0 },
        },
        // Sécurité large : le contexte est du savoir Beyblade public, on ne veut pas de
        // blocage spurious sur des noms de personnages « méchants », « antagoniste »…
        safetySettings: [
          "HARM_CATEGORY_HARASSMENT",
          "HARM_CATEGORY_HATE_SPEECH",
          "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "HARM_CATEGORY_DANGEROUS_CONTENT",
        ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
      }),
    });
    if (!res.ok) {
      console.warn(`[chat/llm] Vertex ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as VertexResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
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
