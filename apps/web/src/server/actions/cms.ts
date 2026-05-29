"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { getContentBlock, upsertContentBlock } from "@/server/dal/cms";

export async function getContent(slug: string) {
  return getContentBlock(slug);
}

export async function upsertContent(slug: string, content: string, title?: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  await upsertContentBlock(slug, content, title);
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  return { success: true };
}
