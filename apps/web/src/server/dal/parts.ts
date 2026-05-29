import "server-only";
import { db, schema, and, asc, count, eq, ilike, inArray, ne, or, sql, type SQL } from "@/lib/db";

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
  conditions.push(ne(schema.parts.externalId, schema.parts.name));

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
    where: ne(schema.parts.externalId, schema.parts.name),
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
