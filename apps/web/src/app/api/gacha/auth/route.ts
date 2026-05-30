import jwt from "jsonwebtoken";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mintGachaWebSession } from "@/server/dal/gacha-auth";

/**
 * GET /api/gacha/auth — « proxy login rpbey » pour le client Discord Activity gacha
 * lancé DANS UN NAVIGATEUR (play.rpbey.fr, hors Discord). Le joueur joue avec son
 * VRAI compte rpbey : on lit sa session better-auth (cookie same-site `rpb-auth`,
 * envoyé en cross-origin par `credentials: "include"` car play.rpbey.fr et rpbey.fr
 * partagent le site rpbey.fr → SameSite=Lax l'autorise), puis on minte :
 *   - un Bearer de session gacha (table `sessions` partagée) consommé par le REST éco ;
 *   - un JWT Colyseus HS256 signé avec `BETTER_AUTH_SECRET` (= secret JWT du serveur
 *     gacha, cf. apps/gacha-server/src/index.ts) → accepté tel quel par `GachaRoom.onAuth`.
 *
 * Pas connecté → 401 (le client invite à se connecter sur rpbey.fr). Aucun mode invité :
 * seules les origines Discord/play légitimes reçoivent les en-têtes CORS+credentials.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [/^https:\/\/play\.rpbey\.fr$/, /^https:\/\/[a-z0-9-]+\.discordsays\.com$/];

function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
  if (!ok || !origin) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(req.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(req: NextRequest) {
  const ch = corsHeaders(req.headers.get("origin"));

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { error: "Connecte-toi sur rpbey.fr pour jouer." },
      { status: 401, headers: ch },
    );
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Configuration serveur incomplète." },
      { status: 500, headers: ch },
    );
  }

  const u = session.user as {
    id: string;
    name?: string | null;
    username?: string | null;
    image?: string | null;
  };
  const name = u.name || u.username || "Blader";

  const bearer = await mintGachaWebSession(u.id);
  // @colyseus/auth signe via jsonwebtoken HS256 ({userId,name}) → on réplique à l'identique.
  const token = jwt.sign({ userId: u.id, name }, secret, { algorithm: "HS256" });

  return NextResponse.json(
    {
      access_token: "rpbey-web",
      token,
      gacha_token: bearer,
      gacha_user_id: u.id,
      user: { id: u.id, username: u.username || name, global_name: name },
    },
    { headers: ch },
  );
}
