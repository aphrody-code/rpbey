"use server";

import {
	db,
	schema,
	and,
	or,
	eq,
	ne,
	inArray,
	ilike,
	asc,
	count,
	type SQL,
} from "@/lib/db";

type PartType = (typeof schema.partType.enumValues)[number];

export async function getPublicParts(params: {
	search?: string;
	type?: PartType | "ALL";
	systems?: string[];
	spin?: string;
	beyTypes?: string[];
	page?: number;
	pageSize?: number;
}) {
	const {
		search,
		type,
		systems,
		spin,
		beyTypes,
		page = 1,
		pageSize = 24,
	} = params;
	const take = pageSize;
	const skip = (page - 1) * take;

	const conditions: SQL[] = [];

	// Hide WBO combo-notation placeholder rows (e.g. "Ar", "Bl", single-letter
	// bits "M"/"R"/"D") from the public catalog. They use their shorthand code as
	// both externalId AND name, carry only partial/placeholder stats, all bucket
	// as BALANCE, and reuse real parts' images — pure clutter & duplicates in the
	// builder. They stay in the DB so existing saved decks still resolve them.
	const realName = ne(schema.parts.externalId, schema.parts.name);
	if (realName) conditions.push(realName);

	if (type && type !== "ALL") {
		// Each builder step maps to exactly one part type. OVER_BLADE has its own
		// dedicated tab/step in CX mode, so it must NOT be merged into BLADE —
		// otherwise over-blades surface in the base "Lames" tab as dead cards that
		// the reducer silently rejects (part.type mismatch).
		conditions.push(eq(schema.parts.type, type));
	}

	if (systems && systems.length > 0) {
		conditions.push(inArray(schema.parts.system, systems));
	}

	if (spin && spin !== "ALL") {
		conditions.push(eq(schema.parts.spinDirection, spin));
	}

	if (beyTypes && beyTypes.length > 0) {
		conditions.push(
			inArray(
				schema.parts.beyType,
				beyTypes as (typeof schema.beyType.enumValues)[number][],
			),
		);
	}

	if (search) {
		const orCond = or(
			ilike(schema.parts.name, `%${search}%`),
			ilike(schema.parts.externalId, `%${search}%`),
		);
		if (orCond) conditions.push(orCond);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [parts, totalRows] = await Promise.all([
		db.query.parts.findMany({
			where,
			limit: take,
			offset: skip,
			orderBy: asc(schema.parts.name),
		}),
		db.select({ value: count() }).from(schema.parts).where(where),
	]);

	const total = totalRows[0]?.value ?? 0;

	return {
		parts,
		total,
		totalPages: Math.ceil(total / take),
	};
}

/**
 * Resolve a list of part externalIds back to full Part rows.
 * Used by the builder's share-link decoder, which only stores externalIds in
 * the URL hash. Returns a Map-like keyed by externalId for O(1) lookup client-side.
 */
export async function getPartsByExternalIds(externalIds: string[]) {
	const unique = [...new Set(externalIds.filter(Boolean))];
	if (unique.length === 0) return [];
	return db.query.parts.findMany({
		where: inArray(schema.parts.externalId, unique),
	});
}
