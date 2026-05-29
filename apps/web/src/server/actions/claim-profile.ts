"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getClaimableStub, mergeStubIntoUser } from "@/server/dal/users";
import { trackEvent } from "@/server/actions/analytics";

export async function claimProfile(stubUserId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, message: "Vous devez être connecté." };
  }

  const realUser = session.user;

  try {
    // 1. Verify Stub Exists and is actually a stub
    const stubUser = await getClaimableStub(stubUserId);

    if (!stubUser?.username?.startsWith("bts2_")) {
      return {
        success: false,
        message: "Ce profil n'est pas éligible à la liaison.",
      };
    }

    // 2. Perform Merge (participations + matchs P1/P2/vainqueur, puis suppression du stub)
    await mergeStubIntoUser(stubUserId, realUser.id);

    revalidatePath("/rankings");
    void trackEvent({
      type: "profile_claim",
      path: "/rankings",
      meta: { stubUserId, userId: realUser.id },
    });
    return {
      success: true,
      message: "Profil lié avec succès ! Les points seront mis à jour prochainement.",
    };
  } catch (error) {
    console.error("Claim Error:", error);
    return {
      success: false,
      message: "Une erreur est survenue lors de la liaison.",
    };
  }
}
