/**
 * POST /api/auth/mobile/callback
 * Exchange Discord OAuth code for a session token (mobile app)
 */

import { type NextRequest, NextResponse } from "next/server";
import { db, schema, eq } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, redirectUri } = body as {
      code?: string;
      redirectUri?: string;
    };

    if (!code || !redirectUri) {
      return NextResponse.json({ error: "code and redirectUri required" }, { status: 400 });
    }

    // Exchange code for Discord token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Discord token exchange failed" }, { status: 400 });
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get Discord user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: "Failed to fetch Discord user" }, { status: 400 });
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      global_name: string | null;
    };

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(schema.users.discordId, discordUser.id),
    });

    const discordTag =
      discordUser.discriminator === "0"
        ? discordUser.username
        : `${discordUser.username}#${discordUser.discriminator}`;

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    if (!user) {
      const [created] = await db
        .insert(schema.users)
        .values({
          id: crypto.randomUUID(),
          email: `${discordUser.id}@discord.rpbey.fr`,
          name: discordUser.username,
          discordId: discordUser.id,
          discordTag,
          image: avatarUrl,
          globalName: discordUser.global_name,
          emailVerified: true,
        })
        .returning();
      user = created;
    } else {
      const [updated] = await db
        .update(schema.users)
        .set({
          discordTag,
          image: avatarUrl,
          globalName: discordUser.global_name,
        })
        .where(eq(schema.users.id, user.id))
        .returning();
      user = updated;
    }

    if (!user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }

    // Ensure profile exists
    await db
      .insert(schema.profiles)
      .values({ userId: user.id, bladerName: discordUser.username })
      .onConflictDoNothing({ target: schema.profiles.userId });

    // Create session token
    const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(schema.sessions).values({
      id: crypto.randomUUID(),
      token: sessionToken,
      userId: user.id,
      expiresAt: expiresAt,
      ipAddress: request.headers.get("x-forwarded-for") ?? "mobile",
      userAgent: request.headers.get("user-agent") ?? "RPB TCG Mobile",
    });

    return NextResponse.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
        discordTag: user.discordTag,
      },
    });
  } catch (error) {
    console.error("Mobile auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
