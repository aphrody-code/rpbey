"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createStaffMember as createStaffMemberDal,
  deleteStaffMember as deleteStaffMemberDal,
  listStaffMembers,
  updateStaffMember as updateStaffMemberDal,
} from "@/server/dal/cms";

export type StaffMemberInput = {
  name: string;
  role: string;
  teamId: string;
  imageUrl?: string;
  discordId?: string;
  displayIndex?: number;
  isActive?: boolean;
};

async function checkAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  if (!session || (userRole !== "admin" && userRole !== "superadmin")) {
    throw new Error("Non autorisé");
  }
  return session;
}

export async function getStaffMembers() {
  await checkAdmin();
  return listStaffMembers();
}

export async function createStaffMember(data: StaffMemberInput) {
  await checkAdmin();
  const member = await createStaffMemberDal(data);
  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return member;
}

export async function updateStaffMember(id: string, data: Partial<StaffMemberInput>) {
  await checkAdmin();
  const member = await updateStaffMemberDal(id, data);
  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return member;
}

export async function deleteStaffMember(id: string) {
  await checkAdmin();
  await deleteStaffMemberDal(id);
  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return { success: true };
}

export async function syncStaffFromDiscord() {
  await checkAdmin();

  console.warn("[SyncStaff] Triggering sync script...");

  try {
    // Chemin ABSOLU + cwd repo : le serveur prod tourne depuis `.next/standalone`,
    // donc un chemin relatif ne résoudrait ni le script ni `@rpbey/db`. Le token
    // Discord (DISCORD_TOKEN/GUILD_ID) est hérité de l'environnement du service web.
    const repoRoot = process.env.RPBEY_REPO_ROOT || "/home/ubuntu/rpbey";
    const proc = Bun.spawn(["bun", `${repoRoot}/scripts/sync-staff-db.ts`], {
      cwd: repoRoot,
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    console.warn("[SyncStaff] Script output:", stdout);
    if (stderr) console.error("[SyncStaff] Script stderr:", stderr);
    if (exitCode !== 0) throw new Error(`Script failed with exit code ${exitCode}`);

    const addedMatch = stdout.match(/Added: (\d+)/);
    const updatedMatch = stdout.match(/Updated: (\d+)/);

    revalidatePath("/admin/staff");
    revalidatePath("/notre-equipe");

    return {
      added: addedMatch?.[1] ? parseInt(addedMatch[1], 10) : 0,
      updated: updatedMatch?.[1] ? parseInt(updatedMatch[1], 10) : 0,
      success: true,
    };
  } catch (error) {
    console.error("[SyncStaff] Execution failed:", error);
    throw new Error("Failed to run sync script");
  }
}
