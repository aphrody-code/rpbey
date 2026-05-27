"use server";

import {
	db,
	schema,
	and,
	or,
	eq,
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

	if (type && type !== "ALL") {
		if (type === "BLADE") {
			conditions.push(inArray(schema.parts.type, ["BLADE", "OVER_BLADE"]));
		} else {
			conditions.push(eq(schema.parts.type, type));
		}
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
