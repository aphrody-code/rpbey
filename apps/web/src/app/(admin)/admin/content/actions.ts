"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import {
  createContentBlock as createContentBlockDal,
  deleteContentBlock as deleteContentBlockDal,
  listContentBlocks,
  updateContentBlock as updateContentBlockDal,
} from "@/server/dal/cms";

export type ContentBlockInput = {
  slug: string;
  title: string;
  type: string;
  content: string;
};

export async function getContentBlocks() {
  return listContentBlocks();
}

export async function updateContentBlock(id: string, data: ContentBlockInput) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  await updateContentBlockDal(id, data);
  revalidatePath("/admin/content");
  revalidatePath("/"); // Revalidate potentially everything since content can be anywhere
}

export async function createContentBlock(data: ContentBlockInput) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  await createContentBlockDal(data);
  revalidatePath("/admin/content");
}

export async function deleteContentBlock(id: string) {
  if (!(await requireAdmin())) throw new Error("Non autorisé");
  await deleteContentBlockDal(id);
  revalidatePath("/admin/content");
}
