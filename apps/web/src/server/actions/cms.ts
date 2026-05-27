"use server";

import { revalidatePath } from "next/cache";
import { db, schema, eq } from "@/lib/db";

export async function getContent(slug: string) {
	const block = await db.query.contentBlocks.findFirst({
		where: eq(schema.contentBlocks.slug, slug),
	});
	return block ?? null;
}

export async function upsertContent(
	slug: string,
	content: string,
	title?: string,
) {
	await db
		.insert(schema.contentBlocks)
		.values({ slug, content, title, type: "markdown" })
		.onConflictDoUpdate({
			target: schema.contentBlocks.slug,
			set: { content, title, type: "markdown" },
		});
	revalidatePath("/");
	revalidatePath(`/${slug}`);
	return { success: true };
}
