"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, schema, eq } from "@/lib/db";
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
    const stubUser = await db.query.users.findFirst({
      where: eq(schema.users.id, stubUserId),
    });

    if (!stubUser?.username?.startsWith("bts2_")) {
      return {
        success: false,
        message: "Ce profil n'est pas éligible à la liaison.",
      };
    }

    // 2. Perform Merge
    await db.transaction(async (tx) => {
      // Move Participations
      await tx
        .update(schema.tournamentParticipants)
        .set({ userId: realUser.id })
        .where(eq(schema.tournamentParticipants.userId, stubUserId));

      // Move Match History (P1, P2, Winner)
      await tx
        .update(schema.tournamentMatches)
        .set({ player1Id: realUser.id })
        .where(eq(schema.tournamentMatches.player1Id, stubUserId));
      await tx
        .update(schema.tournamentMatches)
        .set({ player2Id: realUser.id })
        .where(eq(schema.tournamentMatches.player2Id, stubUserId));
      await tx
        .update(schema.tournamentMatches)
        .set({ winnerId: realUser.id })
        .where(eq(schema.tournamentMatches.winnerId, stubUserId));

      // Update real user profile stats if they are empty or just add them?
      // Actually, we should trigger a recalculation properly, but for now we can just sum them
      // For safety, let's just delete the stub profile and trigger a recalculation later or let the nightly job do it.
      // Or better: Update the real user's profile with the points immediately to reflect changes.

      // Delete Stub
      await tx.delete(schema.profiles).where(eq(schema.profiles.userId, stubUserId));
      await tx.delete(schema.users).where(eq(schema.users.id, stubUserId));
    });

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
