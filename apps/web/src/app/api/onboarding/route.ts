/**
 *  GET  /api/onboarding → statut d'onboarding de l'utilisateur connecté
 *  POST /api/onboarding → finalise l'onboarding (profil + username + onboardedAt)
 */
import { OnboardingInputSchema } from "@rpbey/api-contract";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeOnboarding, getOnboardingStatus, UsernameTakenError } from "@/server/dal/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getOnboardingStatus(session.user.id);
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => ({}));
  const parsed = OnboardingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const profile = await completeOnboarding(session.user.id, parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    if (e instanceof UsernameTakenError) {
      return NextResponse.json(
        { error: "Ce nom d'utilisateur est déjà pris.", code: "username_taken" },
        { status: 409 },
      );
    }
    console.error("[api/onboarding]", e);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
