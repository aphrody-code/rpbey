"use server";

import { db, schema, isNotNull, inArray, count, desc } from "@/lib/db";

export async function getMetaStats() {
	// 1. Récupérer l'usage des pièces dans les DeckItems
	const [bladeUsage, ratchetUsage, bitUsage, assistUsage] = await Promise.all([
		db
			.select({ id: schema.deckItems.bladeId, count: count() })
			.from(schema.deckItems)
			.where(isNotNull(schema.deckItems.bladeId))
			.groupBy(schema.deckItems.bladeId)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ id: schema.deckItems.ratchetId, count: count() })
			.from(schema.deckItems)
			.where(isNotNull(schema.deckItems.ratchetId))
			.groupBy(schema.deckItems.ratchetId)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ id: schema.deckItems.bitId, count: count() })
			.from(schema.deckItems)
			.where(isNotNull(schema.deckItems.bitId))
			.groupBy(schema.deckItems.bitId)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ id: schema.deckItems.assistBladeId, count: count() })
			.from(schema.deckItems)
			.where(isNotNull(schema.deckItems.assistBladeId))
			.groupBy(schema.deckItems.assistBladeId)
			.orderBy(desc(count()))
			.limit(10),
	]);

	// 2. Récupérer les détails des pièces pour avoir les noms
	const allPartIds = [
		...bladeUsage.map((u) => u.id!),
		...ratchetUsage.map((u) => u.id!),
		...bitUsage.map((u) => u.id!),
		...assistUsage.map((u) => u.id!),
	];

	const parts = allPartIds.length
		? await db
				.select({
					id: schema.parts.id,
					name: schema.parts.name,
					type: schema.parts.type,
					imageUrl: schema.parts.imageUrl,
				})
				.from(schema.parts)
				.where(inArray(schema.parts.id, allPartIds))
		: [];

	const partMap = new Map(parts.map((p) => [p.id, p]));

	return {
		blades: bladeUsage.map((u) => ({
			...partMap.get(u.id!),
			count: u.count,
		})),
		ratchets: ratchetUsage.map((u) => ({
			...partMap.get(u.id!),
			count: u.count,
		})),
		bits: bitUsage.map((u) => ({
			...partMap.get(u.id!),
			count: u.count,
		})),
		assists: assistUsage.map((u) => ({
			...partMap.get(u.id!),
			count: u.count,
		})),
	};
}
