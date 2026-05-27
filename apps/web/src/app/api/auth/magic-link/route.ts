import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, schema, and, eq, gt, inArray } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: magic link with token
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const token = searchParams.get("token");

	if (!token) {
		return NextResponse.json({ error: "Token manquant" }, { status: 400 });
	}

	const session = await db.query.sessions.findFirst({
		where: and(
			eq(schema.sessions.token, token),
			gt(schema.sessions.expiresAt, new Date().toISOString()),
		),
	});

	if (!session) {
		return NextResponse.json(
			{ error: "Token invalide ou expiré" },
			{ status: 401 },
		);
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

	if (!discordId || !pin) {
		return NextResponse.json(
			{ error: "Discord ID et PIN requis" },
			{ status: 400 },
		);
	}

	const expectedPin = process.env.ADMIN_PIN;
	if (!expectedPin || pin !== expectedPin) {
		return NextResponse.json({ error: "PIN incorrect" }, { status: 401 });
	}

	const user = await db.query.users.findFirst({
		where: and(
			eq(schema.users.discordId, discordId),
			inArray(schema.users.role, ["admin", "superadmin"]),
		),
	});

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
	const sessionId = Array.from(
		crypto.getRandomValues(new Uint8Array(16)),
		(b) => b.toString(16).padStart(2, "0"),
	).join("");

	await db.insert(schema.sessions).values({
		id: sessionId,
		token,
		userId: user.id,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
