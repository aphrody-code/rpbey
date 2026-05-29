"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserRole,
} from "@/server/dal/infra";

export async function getUsers(page = 1, pageSize = 10, search = "") {
  return listAdminUsers(page, pageSize, search);
}

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    role?: string;
    banned?: boolean;
    banReason?: string;
  },
) {
  await requireAdmin();

  const validRoles = ["user", "moderator", "staff", "admin"];
  if (data.role && !validRoles.includes(data.role)) {
    throw new Error("Rôle invalide");
  }

  await updateAdminUser(id, data);
  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: string) {
  await requireAdmin();
  await updateAdminUserRole(id, role);
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await deleteAdminUser(id);
  revalidatePath("/admin/users");
}
