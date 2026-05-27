"use server";

import { revalidatePath } from "next/cache";
import { type Part, type PartType } from "@/lib/types";
import {
	db,
	schema,
	and,
	asc,
	count,
	eq,
	gte,
	ilike,
	isNotNull,
	isNull,
	or,
	type SQL,
} from "@/lib/db";

export async function getPartsStats() {
	const [
		totalRows,
		byTypeRows,
		bySystemRows,
		byBeyTypeRows,
		missingRows,
		recentRows,
	] = await Promise.all([
		db.select({ value: count() }).from(schema.parts),
		db
			.select({ type: schema.parts.type, value: count() })
			.from(schema.parts)
			.groupBy(schema.parts.type),
		db
			.select({ system: schema.parts.system, value: count() })
			.from(schema.parts)
			.where(isNotNull(schema.parts.system))
			.groupBy(schema.parts.system),
		db
			.select({ beyType: schema.parts.beyType, value: count() })
			.from(schema.parts)
			.where(isNotNull(schema.parts.beyType))
			.groupBy(schema.parts.beyType),
		db
			.select({ value: count() })
			.from(schema.parts)
			.where(isNull(schema.parts.imageUrl)),
		db
			.select({ value: count() })
			.from(schema.parts)
			.where(
				gte(
					schema.parts.updatedAt,
					new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
				),
			),
	]);

	return {
		total: totalRows[0]?.value ?? 0,
		byType: byTypeRows.map((t) => ({ type: t.type, count: t.value })),
		bySystem: bySystemRows.map((s) => ({
			system: s.system ?? "N/A",
			count: s.value,
		})),
		byBeyType: byBeyTypeRows.map((b) => ({
			beyType: b.beyType ?? "N/A",
			count: b.value,
		})),
		missingImage: missingRows[0]?.value ?? 0,
		recentlyUpdated: recentRows[0]?.value ?? 0,
	};
}

export async function getParts(
	search?: string,
	page = 1,
	filters?: {
		type?: PartType;
		system?: string;
		beyType?: string;
		missingImage?: boolean;
	},
) {
	const take = 100;
	const skip = (page - 1) * take;

	const conditions: SQL[] = [];

	if (search) {
		const orCond = or(
			ilike(schema.parts.name, `%${search}%`),
			ilike(schema.parts.externalId, `%${search}%`),
			ilike(schema.parts.nameJp, `%${search}%`),
		);
		if (orCond) conditions.push(orCond);
	}

	if (filters?.type) conditions.push(eq(schema.parts.type, filters.type));
	if (filters?.system) conditions.push(eq(schema.parts.system, filters.system));
	if (filters?.beyType)
		conditions.push(
			eq(
				schema.parts.beyType,
				filters.beyType as (typeof schema.beyType.enumValues)[number],
			),
		);
	if (filters?.missingImage) conditions.push(isNull(schema.parts.imageUrl));

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

	return { parts, total, totalPages: Math.ceil(total / take) };
}

export async function upsertPart(data: Partial<Part>) {
	if (!data.name || !data.type) throw new Error("Name and Type are required");

	const generatedId = `${data.type}-${data.name}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-");

	const externalId = data.externalId || generatedId;

	const partData = {
		name: data.name,
		nameJp: data.nameJp,
		type: data.type,
		externalId: data.externalId,
		weight: data.weight,
		system: data.system,
		spinDirection: data.spinDirection,
		imageUrl: data.imageUrl,
		modelUrl: data.modelUrl,
		textureUrl: data.textureUrl,
		beyType: data.beyType,
		attack: data.attack,
		defense: data.defense,
		stamina: data.stamina,
		dash: data.dash,
		burst: data.burst,
		height: data.height,
		protrusions: data.protrusions,
		gearRatio: data.gearRatio,
		shaftWidth: data.shaftWidth,
		tipType: data.tipType,
		rarity: data.rarity,
		releaseDate: data.releaseDate,
	};

	if (data.id) {
		await db
			.update(schema.parts)
			.set(partData)
			.where(eq(schema.parts.id, data.id));
	} else {
		await db
			.insert(schema.parts)
			.values({ ...partData, externalId, system: data.system || "BX" });
	}

	revalidatePath("/parts");
	return { success: true };
}

export async function deletePart(id: string) {
	await db.delete(schema.parts).where(eq(schema.parts.id, id));
	revalidatePath("/parts");
}

export async function bulkImportParts(
	partsData: Partial<Part>[],
): Promise<{ created: number; updated: number; errors: string[] }> {
	let created = 0;
	let updated = 0;
	const errors: string[] = [];

	for (const data of partsData) {
		if (!data.name || !data.type) {
			errors.push(`Ignoré: nom ou type manquant (${data.name ?? "sans nom"})`);
			continue;
		}

		const externalId =
			data.externalId ||
			`${data.type}-${data.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

		try {
			const existing = await db.query.parts.findFirst({
				where: eq(schema.parts.externalId, externalId),
			});

			const partData = {
				name: data.name,
				nameJp: data.nameJp ?? null,
				type: data.type,
				weight: data.weight ?? null,
				system: data.system ?? "BX",
				spinDirection: data.spinDirection ?? null,
				imageUrl: data.imageUrl ?? null,
				beyType: data.beyType ?? null,
				attack: data.attack ?? null,
				defense: data.defense ?? null,
				stamina: data.stamina ?? null,
				dash: data.dash ?? null,
				burst: data.burst ?? null,
				height: data.height ?? null,
				protrusions: data.protrusions ?? null,
				gearRatio: data.gearRatio ?? null,
				shaftWidth: data.shaftWidth ?? null,
				tipType: data.tipType ?? null,
				rarity: data.rarity ?? null,
			};

			if (existing) {
				await db
					.update(schema.parts)
					.set(partData)
					.where(eq(schema.parts.id, existing.id));
				updated++;
			} else {
				await db.insert(schema.parts).values({ ...partData, externalId });
				created++;
			}
		} catch (err) {
			errors.push(`Erreur sur "${data.name}": ${String(err)}`);
		}
	}

	revalidatePath("/parts");
	return { created, updated, errors };
}

export async function duplicatePart(id: string) {
	const original = await db.query.parts.findFirst({
		where: eq(schema.parts.id, id),
	});
	if (!original) throw new Error("Part not found");
	const newName = `${original.name} (copie)`;
	const externalId = `${original.type}-${newName}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-");

	await db.insert(schema.parts).values({
		externalId,
		name: newName,
		nameJp: original.nameJp,
		type: original.type,
		weight: original.weight,
		system: original.system,
		spinDirection: original.spinDirection,
		imageUrl: original.imageUrl,
		beyType: original.beyType,
		attack: original.attack,
		defense: original.defense,
		stamina: original.stamina,
		dash: original.dash,
		burst: original.burst,
		height: original.height,
		protrusions: original.protrusions,
		gearRatio: original.gearRatio,
		shaftWidth: original.shaftWidth,
		tipType: original.tipType,
		rarity: original.rarity,
	});

	revalidatePath("/parts");
	return { success: true };
}

// Beyblades management
export async function getBeyblades(search?: string) {
	const where = search
		? or(
				ilike(schema.beyblades.name, `%${search}%`),
				ilike(schema.beyblades.code, `%${search}%`),
			)
		: undefined;

	const rows = await db.query.beyblades.findMany({
		where,
		with: {
			part_bladeId: true,
			part_ratchetId: true,
			part_bitId: true,
			product: true,
		},
		orderBy: asc(schema.beyblades.name),
		limit: 200,
	});

	return rows.map((b) => ({
		...b,
		blade: b.part_bladeId,
		ratchet: b.part_ratchetId,
		bit: b.part_bitId,
	}));
}

export async function upsertBeyblade(data: {
	id?: string;
	code: string;
	name: string;
	nameEn?: string;
	nameFr?: string;
	bladeId: string;
	ratchetId: string;
	bitId: string;
	beyType?: string;
	imageUrl?: string;
}) {
	// Calculate aggregated stats
	const [blade, ratchet, bit] = await Promise.all([
		db.query.parts.findFirst({ where: eq(schema.parts.id, data.bladeId) }),
		db.query.parts.findFirst({ where: eq(schema.parts.id, data.ratchetId) }),
		db.query.parts.findFirst({ where: eq(schema.parts.id, data.bitId) }),
	]);
	if (!blade || !ratchet || !bit) throw new Error("Part not found");

	const sum = (a?: string | null, b?: string | null, c?: string | null) =>
		(parseInt(a ?? "0", 10) || 0) +
		(parseInt(b ?? "0", 10) || 0) +
		(parseInt(c ?? "0", 10) || 0);

	const beyData = {
		code: data.code,
		name: data.name,
		nameEn: data.nameEn,
		nameFr: data.nameFr,
		bladeId: data.bladeId,
		ratchetId: data.ratchetId,
		bitId: data.bitId,
		beyType:
			(data.beyType as "ATTACK" | "DEFENSE" | "STAMINA" | "BALANCE") ??
			blade.beyType,
		imageUrl: data.imageUrl,
		totalAttack: sum(blade.attack, ratchet.attack, bit.attack),
		totalDefense: sum(blade.defense, ratchet.defense, bit.defense),
		totalStamina: sum(blade.stamina, ratchet.stamina, bit.stamina),
		totalBurst: sum(blade.burst, ratchet.burst, bit.burst),
		totalDash: sum(blade.dash, ratchet.dash, bit.dash),
		totalWeight:
			(blade.weight ?? 0) + (ratchet.weight ?? 0) + (bit.weight ?? 0),
	};

	if (data.id) {
		await db
			.update(schema.beyblades)
			.set(beyData)
			.where(eq(schema.beyblades.id, data.id));
	} else {
		await db.insert(schema.beyblades).values(beyData);
	}

	revalidatePath("/parts");
	return { success: true };
}

export async function deleteBeyblade(id: string) {
	await db.delete(schema.beyblades).where(eq(schema.beyblades.id, id));
	revalidatePath("/parts");
}

// Products management
export async function getProducts(search?: string) {
	const where = search
		? or(
				ilike(schema.products.name, `%${search}%`),
				ilike(schema.products.code, `%${search}%`),
			)
		: undefined;

	return db.query.products.findMany({
		where,
		with: { beyblades: true },
		orderBy: asc(schema.products.name),
		limit: 200,
	});
}
