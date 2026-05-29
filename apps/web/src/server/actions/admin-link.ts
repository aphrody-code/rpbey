"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import {
  getAllRealUsers as getAllRealUsersDal,
  getUnlinkedParticipants as getUnlinkedParticipantsDal,
  mergeUserAccounts as mergeUserAccountsDal,
} from "@/server/dal/cms";

export async function getUnlinkedParticipants() {
  return getUnlinkedParticipantsDal();
}

export async function getAllRealUsers() {
  return getAllRealUsersDal();
}

export async function mergeUserAccounts(placeholderUserId: string, realUserId: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  if (placeholderUserId === realUserId) throw new Error("Même utilisateur");

  try {
    await mergeUserAccountsDal(placeholderUserId, realUserId);
    revalidatePath("/admin/link");
    return { success: true };
  } catch (error) {
    console.error("Merge Error:", error);
    throw new Error("Erreur lors de la fusion des comptes");
  }
}
