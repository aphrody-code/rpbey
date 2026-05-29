"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, schema, asc, eq } from "@/lib/db";

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
  return await db.query.staffMembers.findMany({
    orderBy: [asc(schema.staffMembers.role), asc(schema.staffMembers.displayIndex)],
  });
}

export async function createStaffMember(data: StaffMemberInput) {
  await checkAdmin();

  const [member] = await db.insert(schema.staffMembers).values(data).returning();

  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return member;
}

export async function updateStaffMember(id: string, data: Partial<StaffMemberInput>) {
  await checkAdmin();

  const [member] = await db
    .update(schema.staffMembers)
    .set(data)
    .where(eq(schema.staffMembers.id, id))
    .returning();

  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return member;
}

export async function deleteStaffMember(id: string) {
  await checkAdmin();

  await db.delete(schema.staffMembers).where(eq(schema.staffMembers.id, id));

  revalidatePath("/admin/staff");
  revalidatePath("/notre-equipe");
  return { success: true };
}

export async function syncStaffFromDiscord() {
  await checkAdmin();

  console.log("[SyncStaff] Triggering sync script...");

  try {
    const proc = Bun.spawn(["bun", "scripts/sync-staff-db.ts"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    console.log("[SyncStaff] Script output:", stdout);
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
