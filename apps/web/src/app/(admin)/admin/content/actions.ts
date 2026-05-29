"use server";

import { revalidatePath } from "next/cache";
import { db, schema, asc, eq } from "@/lib/db";

export type ContentBlockInput = {
  slug: string;
  title: string;
  type: string;
  content: string;
};

export async function getContentBlocks() {
  return await db.query.contentBlocks.findMany({
    orderBy: asc(schema.contentBlocks.slug),
  });
}

export async function updateContentBlock(id: string, data: ContentBlockInput) {
  const { slug, title, type, content } = data;

  await db
    .update(schema.contentBlocks)
    .set({
      slug,
      title,
      type,
      content,
    })
    .where(eq(schema.contentBlocks.id, id));

  revalidatePath("/admin/content");
  revalidatePath("/"); // Revalidate potentially everything since content can be anywhere
}

export async function createContentBlock(data: ContentBlockInput) {
  const { slug, title, type, content } = data;

  await db.insert(schema.contentBlocks).values({
    slug,
    title,
    type,
    content,
  });

  revalidatePath("/admin/content");
}

export async function deleteContentBlock(id: string) {
  await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, id));

  revalidatePath("/admin/content");
}
