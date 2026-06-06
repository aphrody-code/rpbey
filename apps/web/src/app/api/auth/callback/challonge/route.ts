import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

const CHALLONGE_OAUTH_STATE_COOKIE = "challonge_oauth_state";
import { auth } from "@/lib/auth";
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

  // (a) La liaison de compte se fait TOUJOURS sur la session réelle, jamais sur
  // l'userId que le client a encodé dans `state` (sinon confused-deputy / CSRF).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    console.warn("Challonge OAuth callback: no session");
    return new NextResponse("Unauthorized: Please sign in first", {
      status: 401,
    });
  }
  const userId = session.user.id;

  let returnTo: string;
  let stateNonce: string | undefined;

  try {
    const state = JSON.parse(atob(stateBase64));
    stateNonce = typeof state.nonce === "string" ? state.nonce : undefined;
    returnTo = state.returnTo || "/admin/settings";
  } catch (err) {
    console.error("Challonge OAuth: Invalid state format", err);
    return new NextResponse("Invalid request: Invalid state", { status: 400 });
  }

  // (b)+(c) Le cookie httpOnly posé à l'init doit exister et son nonce doit
  // correspondre à celui encodé dans `state` (preuve que ce navigateur a initié le flux).
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(CHALLONGE_OAUTH_STATE_COOKIE)?.value;
  let cookieNonce: string | undefined;
  try {
    cookieNonce = stateCookie ? JSON.parse(stateCookie).nonce : undefined;
  } catch {
    cookieNonce = undefined;
  }
  if (!cookieNonce || !stateNonce || cookieNonce !== stateNonce) {
    console.warn("Challonge OAuth callback: state nonce mismatch");
    return new NextResponse("Invalid request: state mismatch", { status: 400 });
  }
  // (e) Cookie à usage unique.
  cookieStore.delete(CHALLONGE_OAUTH_STATE_COOKIE);

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
