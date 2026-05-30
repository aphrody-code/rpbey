/**
 * Authentification. Deux chemins :
 *
 *  - DANS Discord (Activity) : flux Embedded App SDK.
 *      ready() → authorize() (récupère un `code`) → POST /discord_token
 *      → { token (JWT Colyseus), gacha_token (Bearer), gacha_user_id }
 *      → authenticate() côté SDK avec l'access_token Discord.
 *
 *  - HORS Discord (navigateur, dev/QA) : on POST `/discord_token` avec
 *      `code: "mock_code"` → le serveur minte une session anonyme de test.
 *
 * Aucun secret en dur : seul le CLIENT_ID public (Application ID) est utilisé,
 * lu via `import.meta.env` (VITE_DISCORD_CLIENT_ID).
 */
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { DISCORD_CLIENT_ID, GACHA_REST_URL, IS_DISCORD, proxifyUrl } from "../env";
import type { DiscordTokenResponse } from "../types";

export interface Session {
  jwt: string; // token Colyseus
  bearer: string; // gacha_token (REST économie)
  userId: string;
  name: string;
  channelId?: string;
  viaDiscord: boolean;
}

async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const url = proxifyUrl(`${GACHA_REST_URL}/discord_token`, "api");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`/discord_token ${res.status} ${txt}`);
  }
  return (await res.json()) as DiscordTokenResponse;
}

/** Flux Discord Embedded App SDK complet. */
async function authViaDiscord(): Promise<Session> {
  if (!DISCORD_CLIENT_ID) {
    throw new Error("VITE_DISCORD_CLIENT_ID manquant — impossible d'auth dans Discord");
  }
  const sdk = new DiscordSDK(DISCORD_CLIENT_ID);
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "rpc.activities.write"],
  });

  const tok = await exchangeCode(code);

  // Authentifie la session SDK avec l'access_token Discord renvoyé.
  await sdk.commands.authenticate({ access_token: tok.access_token });

  return {
    jwt: tok.token,
    bearer: tok.gacha_token,
    userId: tok.gacha_user_id,
    name: tok.user.global_name || tok.user.username || "Blader",
    channelId: sdk.channelId ?? undefined,
    viaDiscord: true,
  };
}

/** Fallback navigateur : session mock anonyme. */
async function authMock(): Promise<Session> {
  const tok = await exchangeCode("mock_code");
  return {
    jwt: tok.token,
    bearer: tok.gacha_token,
    userId: tok.gacha_user_id,
    name: tok.user.global_name || tok.user.username || "MockBlader",
    viaDiscord: false,
  };
}

export async function authenticate(): Promise<Session> {
  return IS_DISCORD ? authViaDiscord() : authMock();
}
