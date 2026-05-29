"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, schema, count, desc, eq, ilike, inArray, or } from "@/lib/db";

export async function getUsers(page = 1, pageSize = 10, search = "") {
  const skip = (page - 1) * pageSize;

  const where = search
    ? or(ilike(schema.users.name, `%${search}%`), ilike(schema.users.email, `%${search}%`))
    : undefined;

  const [users, totalRows] = await Promise.all([
    db.query.users.findMany({
      where,
      offset: skip,
      limit: pageSize,
      orderBy: desc(schema.users.createdAt),
    }),
    db.select({ value: count() }).from(schema.users).where(where),
  ]);

  const total = totalRows[0]?.value ?? 0;

  // Tournament participation counts (Prisma _count.tournaments)
  const userIds = users.map((u) => u.id);
  const countByUser = new Map<string, number>();
  if (userIds.length > 0) {
    const rows = await db
      .select({
        userId: schema.tournamentParticipants.userId,
        value: count(),
      })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.userId, userIds))
      .groupBy(schema.tournamentParticipants.userId);
    for (const r of rows) {
      if (r.userId) countByUser.set(r.userId, r.value);
    }
  }

  const usersWithCount = users.map((u) => ({
    ...u,
    _count: { tournaments: countByUser.get(u.id) ?? 0 },
  }));

  return { users: usersWithCount, total };
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

  await db
    .update(schema.users)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.banned !== undefined && { banned: data.banned }),
      ...(data.banReason !== undefined && { banReason: data.banReason }),
      ...(!data.banned && { banReason: null, banExpires: null }),
    })
    .where(eq(schema.users.id, id));
  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: string) {
  await requireAdmin();
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, id));
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/admin/users");
}
