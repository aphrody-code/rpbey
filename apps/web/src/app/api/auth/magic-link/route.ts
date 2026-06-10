import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSession,
  findAdminUserByDiscordId,
  findValidSessionByToken,
} from "@/server/dal/auth";

/** Comparaison à temps constant (Web API, pas de node:crypto). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i]! ^ eb[i]!;
  return diff === 0;
}

// Rate-limit anti brute-force du PIN admin : 5 tentatives / 15 min par IP réelle.
const PIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const PIN_MAX = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000;
function pinRateLimited(ip: string): boolean {
  const now = Date.now();
  const e = PIN_ATTEMPTS.get(ip);
  if (!e || now > e.resetAt) {
    PIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + PIN_WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > PIN_MAX;
}

// GET: magic link with token
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  const session = await findValidSessionByToken(token);

  if (!session) {
    return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set("rpb-auth.session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL("/admin", request.url));
}

// POST: admin quick login with Discord ID + PIN
export async function POST(request: Request) {
  const body = await request.json();
  const { discordId, pin } = body as { discordId?: string; pin?: string };

  const ip =
    request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "0.0.0.0";
  if (pinRateLimited(ip)) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard" }, { status: 429 });
  }

  if (!discordId || !pin) {
    return NextResponse.json({ error: "Discord ID et PIN requis" }, { status: 400 });
  }

  const expectedPin = process.env.ADMIN_PIN;
  if (!expectedPin || !timingSafeEqualStr(pin, expectedPin)) {
    return NextResponse.json({ error: "PIN incorrect" }, { status: 401 });
  }

  const user = await findAdminUserByDiscordId(discordId);

  if (!user) {
    return NextResponse.json(
      { error: "Aucun compte admin trouvé avec ce Discord ID" },
      { status: 404 },
    );
  }

  // Create session
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

  await createSession({
    id: sessionId,
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ipAddress: request.headers.get("x-forwarded-for") || "0.0.0.0",
    userAgent: request.headers.get("user-agent") || "Admin Quick Login",
  });

  const cookieStore = await cookies();
  cookieStore.set("rpb-auth.session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ success: true, name: user.name });
}
