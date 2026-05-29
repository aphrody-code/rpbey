import { NextResponse } from "next/server";
import { getChallongeService } from "@/lib/challonge";
import { upsertChallongeAccount, upsertChallongeProfile } from "@/server/dal/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateBase64 = searchParams.get("state");

  if (!code || !stateBase64) {
    console.error("Challonge OAuth: Missing code or state");
    return new NextResponse("Invalid request: Missing code or state", {
      status: 400,
    });
  }

  let userId: string;
  let returnTo: string;

  try {
    const state = JSON.parse(atob(stateBase64));
    userId = state.userId;
    returnTo = state.returnTo || "/admin/settings";
  } catch (err) {
    console.error("Challonge OAuth: Invalid state format", err);
    return new NextResponse("Invalid request: Invalid state", { status: 400 });
  }

  try {
    const challonge = getChallongeService();
    const tokenData = await challonge.exchangeCodeForToken(code);
    const challongeUser = await challonge.getCurrentUser(tokenData.access_token);

    const expiresAtDate = new Date(Date.now() + tokenData.expires_in * 1000);

    // Store in Account table for API access
    await upsertChallongeAccount({
      userId,
      accountId: challongeUser.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiresAt: expiresAtDate,
    });

    // Update or Create Profile with verified username
    await upsertChallongeProfile(userId, challongeUser.username);

    // Redirect back with success
    const separator = returnTo.includes("?") ? "&" : "?";
    const redirectUrl = new URL(
      `${returnTo}${separator}challonge=success`,
      process.env.NEXT_PUBLIC_APP_URL || "https://rpbey.fr",
    );

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("❌ Challonge OAuth callback failed:", error);
    const redirectUrl = new URL(
      "/admin/settings?challonge=error",
      process.env.NEXT_PUBLIC_APP_URL || "https://rpbey.fr",
    );
    return NextResponse.redirect(redirectUrl.toString());
  }
}
