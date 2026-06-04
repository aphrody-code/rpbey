import "server-only";
import {
  db,
  schema,
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "@/lib/db";
import { type Part } from "@/lib/types";

/**
 * Data Access Layer — pièces (parts).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 */

type PartType = (typeof schema.partType.enumValues)[number];
type BeyTypeEnum = (typeof schema.beyType.enumValues)[number];

export interface PartsFilter {
  search?: string;
  type?: PartType | "ALL";
  systems?: string[];
  spin?: string;
  beyTypes?: string[];
  page?: number;
  pageSize?: number;
}

/** Catalogue public filtré + paginé (utilisé par le builder et `/api/v1/parts`). */
export async function listPublicParts(params: PartsFilter) {
  const { search, type, systems, spin, beyTypes, page = 1, pageSize = 24 } = params;
  const take = pageSize;
  const skip = (page - 1) * take;

  const conditions: SQL[] = [];

  // Masque les lignes placeholder en notation combo WBO (externalId === name) :
  // stats partielles, doublons d'images — clutter dans le builder. Conservées en DB
  // pour que les decks sauvegardés les résolvent encore.
  conditions.push(sql`${schema.parts.externalId} <> ${schema.parts.name}`);

  if (type && type !== "ALL") conditions.push(eq(schema.parts.type, type));
  if (systems && systems.length > 0) conditions.push(inArray(schema.parts.system, systems));
  if (spin && spin !== "ALL") conditions.push(eq(schema.parts.spinDirection, spin));
  if (beyTypes && beyTypes.length > 0) {
    conditions.push(inArray(schema.parts.beyType, beyTypes as BeyTypeEnum[]));
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
  return { parts, total, totalPages: Math.ceil(total / take) };
}

/** Résout des externalIds → lignes Part (décodeur de share-link du builder). */
export async function getPartsByExternalIds(externalIds: string[]) {
  const unique = [...new Set(externalIds.filter(Boolean))];
  if (unique.length === 0) return [];
  return db.query.parts.findMany({
    where: inArray(schema.parts.externalId, unique),
  });
}

export async function getPartById(id: string) {
  return db.query.parts.findFirst({ where: eq(schema.parts.id, id) });
}

/** Pièce aléatoire (hors placeholders combo). */
export async function getRandomPart() {
  return db.query.parts.findFirst({
    where: sql`${schema.parts.externalId} <> ${schema.parts.name}`,
    orderBy: sql`random()`,
  });
}

type BeyTypeVal = (typeof schema.beyType.enumValues)[number];

/** Liste limit/offset (route legacy `/api/parts`) — tri type puis nom, sans filtre placeholder. */
export async function listPartsByOffset(params: {
  type?: PartType | null;
  beyType?: BeyTypeVal | null;
  search?: string | null;
  limit: number;
  offset: number;
}) {
  const { type, beyType, search, limit, offset } = params;
  const conditions: SQL[] = [];
  if (type && schema.partType.enumValues.includes(type)) {
    conditions.push(eq(schema.parts.type, type));
  }
  if (beyType && schema.beyType.enumValues.includes(beyType)) {
    conditions.push(eq(schema.parts.beyType, beyType));
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
      limit,
      offset,
      orderBy: [asc(schema.parts.type), asc(schema.parts.name)],
    }),
    db.select({ value: count() }).from(schema.parts).where(where),
  ]);
  return { parts, total: totalRows[0]?.value ?? 0 };
}

/** Pièce aléatoire d'un type donné (route legacy `/api/parts/random`). */
export async function getRandomPartByType(type: PartType) {
  const [countRow] = await db
    .select({ value: count() })
    .from(schema.parts)
    .where(eq(schema.parts.type, type));
  const total = countRow?.value ?? 0;
  if (total === 0) return null;
  const skip = Math.floor(Math.random() * total);
  return db.query.parts.findFirst({
    where: eq(schema.parts.type, type),
    offset: skip,
  });
}

/** Résolution par id OU externalId (route legacy `/api/parts/[id]`). */
export async function getPartByIdOrExternalId(id: string) {
  return db.query.parts.findFirst({
    where: or(eq(schema.parts.id, id), eq(schema.parts.externalId, id)),
  });
}

/** Colonnes nécessaires à l'enrichissement de la méta (stats + image). */
export async function getPartsForMeta() {
  return db.query.parts.findMany({
    columns: {
      name: true,
      attack: true,
      defense: true,
      stamina: true,
      burst: true,
      dash: true,
      imageUrl: true,
    },
  });
}

// ─── Admin CRUD (back-office /parts) ────────────────────────────────────────

/** Statistiques agrégées du catalogue (back-office). */
export async function getPartsStats() {
  const [totalRows, byTypeRows, bySystemRows, byBeyTypeRows, missingRows, recentRows] =
    await Promise.all([
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
      db.select({ value: count() }).from(schema.parts).where(isNull(schema.parts.imageUrl)),
      db
        .select({ value: count() })
        .from(schema.parts)
        .where(
          gte(schema.parts.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
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

/** Catalogue admin filtré + paginé (inclut les placeholders combo). */
export async function listAdminParts(
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
  if (filters?.beyType) conditions.push(eq(schema.parts.beyType, filters.beyType as BeyTypeEnum));
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

/** Insère ou met à jour une pièce (back-office). */
export async function upsertPart(data: Partial<Part>) {
  // Précondition d'insertion : `name`/`type` sont NOT NULL en base. La narrowe ici
  // (en plus de la garde de l'action) pour satisfaire le typage Drizzle des colonnes
  // requises ; même comportement observable que l'ancienne garde inline de l'action.
  if (!data.name || !data.type) throw new Error("Name and Type are required");

  const generatedId = `${data.type}-${data.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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
    await db.update(schema.parts).set(partData).where(eq(schema.parts.id, data.id));
  } else {
    await db.insert(schema.parts).values({ ...partData, externalId, system: data.system || "BX" });
  }
}

/** Supprime une pièce par id. */
export async function deletePart(id: string) {
  await db.delete(schema.parts).where(eq(schema.parts.id, id));
}

/** Import en masse (upsert par externalId). */
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
      data.externalId || `${data.type}-${data.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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
        await db.update(schema.parts).set(partData).where(eq(schema.parts.id, existing.id));
        updated++;
      } else {
        await db.insert(schema.parts).values({ ...partData, externalId });
        created++;
      }
    } catch (err) {
      errors.push(`Erreur sur "${data.name}": ${String(err)}`);
    }
  }

  return { created, updated, errors };
}

/** Duplique une pièce existante (suffixe « (copie) »). */
export async function duplicatePart(id: string) {
  const original = await db.query.parts.findFirst({
    where: eq(schema.parts.id, id),
  });
  if (!original) throw new Error("Part not found");
  const newName = `${original.name} (copie)`;
  const externalId = `${original.type}-${newName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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
}

// ─── Beyblades (back-office /parts) ─────────────────────────────────────────

/** Liste les beyblades (avec parts liées + produit) pour le back-office. */
export async function listBeyblades(search?: string) {
  const where = search
    ? or(ilike(schema.beyblades.name, `%${search}%`), ilike(schema.beyblades.code, `%${search}%`))
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

/** Insère ou met à jour un beyblade en recalculant ses stats agrégées. */
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
    (parseInt(a ?? "0", 10) || 0) + (parseInt(b ?? "0", 10) || 0) + (parseInt(c ?? "0", 10) || 0);

  const beyData = {
    code: data.code,
    name: data.name,
    nameEn: data.nameEn,
    nameFr: data.nameFr,
    bladeId: data.bladeId,
    ratchetId: data.ratchetId,
    bitId: data.bitId,
    beyType: (data.beyType as "ATTACK" | "DEFENSE" | "STAMINA" | "BALANCE") ?? blade.beyType,
    imageUrl: data.imageUrl,
    totalAttack: sum(blade.attack, ratchet.attack, bit.attack),
    totalDefense: sum(blade.defense, ratchet.defense, bit.defense),
    totalStamina: sum(blade.stamina, ratchet.stamina, bit.stamina),
    totalBurst: sum(blade.burst, ratchet.burst, bit.burst),
    totalDash: sum(blade.dash, ratchet.dash, bit.dash),
    totalWeight: (blade.weight ?? 0) + (ratchet.weight ?? 0) + (bit.weight ?? 0),
  };

  if (data.id) {
    await db.update(schema.beyblades).set(beyData).where(eq(schema.beyblades.id, data.id));
  } else {
    await db.insert(schema.beyblades).values(beyData);
  }
}

/** Supprime un beyblade par id. */
export async function deleteBeyblade(id: string) {
  await db.delete(schema.beyblades).where(eq(schema.beyblades.id, id));
}

// ─── Products (back-office /parts) ──────────────────────────────────────────

/** Liste les produits (avec beyblades liés) pour le back-office. */
export async function listProducts(search?: string) {
  const where = search
    ? or(ilike(schema.products.name, `%${search}%`), ilike(schema.products.code, `%${search}%`))
    : undefined;

  return db.query.products.findMany({
    where,
    with: { beyblades: true },
    orderBy: asc(schema.products.name),
    limit: 200,
  });
}
