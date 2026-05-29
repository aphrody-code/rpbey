import "server-only";
import { db, schema, and, asc, desc, eq, inArray, ne } from "@/lib/db";

/**
 * Data Access Layer — decks / combos.
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine (decks, deck_items,
 * + résolution de pièces pour la carte combo). UI-agnostic.
 *
 * Invariant timestamp : `decks.createdAt`/`updatedAt` = mode:"string" (ISO) — aucun
 * wrapping `Date` nécessaire à l'écriture (le défaut SQL `now()` s'en charge) ni à la
 * lecture (déjà ISO). Pas de timestamp sur `deck_items`.
 */

// Eager-load des pièces de chaque item, triées par position (slots du deck).
const DECK_ITEMS_WITH = {
  with: {
    beyblade: true,
    part_bladeId: true,
    part_overBladeId: true,
    part_ratchetId: true,
    part_bitId: true,
    part_lockChipId: true,
    part_assistBladeId: true,
  },
  orderBy: asc(schema.deckItems.position),
} as const;

// Remap des noms de relations Drizzle (`part_bladeId`, `beyblade`) → noms Prisma-style
// (`blade`, `bey`) attendus par tous les consommateurs (front builder, cartes, stats).
function remapDeckItem(it: Record<string, unknown>) {
  const {
    beyblade,
    part_bladeId,
    part_overBladeId,
    part_ratchetId,
    part_bitId,
    part_lockChipId,
    part_assistBladeId,
    ...rest
  } = it;
  return {
    ...rest,
    bey: beyblade ?? null,
    blade: part_bladeId ?? null,
    overBlade: part_overBladeId ?? null,
    ratchet: part_ratchetId ?? null,
    bit: part_bitId ?? null,
    lockChip: part_lockChipId ?? null,
    assistBlade: part_assistBladeId ?? null,
  };
}

function remapDeck<T extends { deckItems: Record<string, unknown>[] }>(deck: T) {
  const { deckItems, ...rest } = deck;
  return { ...rest, items: deckItems.map(remapDeckItem) };
}

export type RemappedDeck = ReturnType<typeof remapDeck>;

/** Slot de bey accepté en écriture (création / mise à jour d'un deck). */
export interface DeckBeyInput {
  position: number;
  nickname?: string;
  bladeId: string;
  overBladeId?: string;
  ratchetId: string;
  bitId: string;
  lockChipId?: string;
  assistBladeId?: string;
}

/** Résultat d'une validation de slots de deck. `ok:false` → message + 400. */
export type DeckValidation = { ok: true } | { ok: false; error: string };

/**
 * Valide la composition d'un deck (exactement 3 beys, unicité des pièces, existence et
 * type correct de chaque pièce). Logique pure côté DB (lookup des pièces).
 */
export async function validateDeckBeys(beys: DeckBeyInput[]): Promise<DeckValidation> {
  if (beys.length !== 3) {
    return { ok: false, error: "Invalid deck: exactly 3 beys required" };
  }

  const standardPartIds = beys.flatMap((b) => [b.bladeId, b.ratchetId, b.bitId]);
  if (new Set(standardPartIds).size !== standardPartIds.length) {
    return {
      ok: false,
      error: "Invalid deck: each standard part can only be used once",
    };
  }

  const allPartIds = [...standardPartIds];
  for (const bey of beys) {
    if (bey.overBladeId) allPartIds.push(bey.overBladeId);
    if (bey.lockChipId) allPartIds.push(bey.lockChipId);
    if (bey.assistBladeId) allPartIds.push(bey.assistBladeId);
  }

  const overBladeIds = beys.map((b) => b.overBladeId).filter(Boolean) as string[];
  if (new Set(overBladeIds).size !== overBladeIds.length) {
    return { ok: false, error: "Duplicate Over Blades in deck" };
  }

  const assistBladeIds = beys.map((b) => b.assistBladeId).filter(Boolean) as string[];
  if (new Set(assistBladeIds).size !== assistBladeIds.length) {
    return {
      ok: false,
      error: "Invalid deck: each Assist Blade can only be used once",
    };
  }

  const parts = await db.query.parts.findMany({
    where: inArray(schema.parts.id, allPartIds),
  });
  const partMap = new Map(parts.map((p) => [p.id, p]));

  for (const bey of beys) {
    const blade = partMap.get(bey.bladeId);
    if (!blade || (blade.type !== "BLADE" && blade.type !== "OVER_BLADE")) {
      return { ok: false, error: `Invalid blade ID: ${bey.bladeId}` };
    }
    if (bey.overBladeId) {
      const overBlade = partMap.get(bey.overBladeId);
      if (!overBlade || overBlade.type !== "OVER_BLADE") {
        return {
          ok: false,
          error: `Invalid over blade ID: ${bey.overBladeId}`,
        };
      }
    }
    const ratchet = partMap.get(bey.ratchetId);
    if (!ratchet || ratchet.type !== "RATCHET") {
      return { ok: false, error: `Invalid ratchet ID: ${bey.ratchetId}` };
    }
    const bit = partMap.get(bey.bitId);
    if (!bit || bit.type !== "BIT") {
      return { ok: false, error: `Invalid bit ID: ${bey.bitId}` };
    }
    if (bey.lockChipId) {
      const lockChip = partMap.get(bey.lockChipId);
      if (!lockChip || lockChip.type !== "LOCK_CHIP") {
        return { ok: false, error: `Invalid lock chip ID: ${bey.lockChipId}` };
      }
    }
    if (bey.assistBladeId) {
      const assistBlade = partMap.get(bey.assistBladeId);
      if (!assistBlade || assistBlade.type !== "ASSIST_BLADE") {
        return {
          ok: false,
          error: `Invalid assist blade ID: ${bey.assistBladeId}`,
        };
      }
    }
  }

  return { ok: true };
}

function deckItemValues(deckId: string, beys: DeckBeyInput[]) {
  return beys.map((bey) => ({
    deckId,
    position: bey.position,
    bladeId: bey.bladeId,
    overBladeId: bey.overBladeId || null,
    ratchetId: bey.ratchetId,
    bitId: bey.bitId,
    lockChipId: bey.lockChipId || null,
    assistBladeId: bey.assistBladeId || null,
  }));
}

/**
 * Liste les decks d'un utilisateur. Si `onlyActive`, ne renvoie que le deck actif
 * (vue publique d'un profil tiers). Remappé Prisma-style.
 */
export async function listUserDecks(userId: string, onlyActive = false): Promise<RemappedDeck[]> {
  const conditions = [eq(schema.decks.userId, userId)];
  if (onlyActive) conditions.push(eq(schema.decks.isActive, true));

  const decks = await db.query.decks.findMany({
    where: and(...conditions),
    with: { deckItems: DECK_ITEMS_WITH },
    orderBy: [desc(schema.decks.isActive), desc(schema.decks.updatedAt)],
  });
  return decks.map(remapDeck);
}

/** Un deck d'un utilisateur (vérification de propriété via `userId`). */
export async function getUserDeck(id: string, userId: string): Promise<RemappedDeck | null> {
  const deck = await db.query.decks.findFirst({
    where: and(eq(schema.decks.id, id), eq(schema.decks.userId, userId)),
    with: { deckItems: DECK_ITEMS_WITH },
  });
  return deck ? remapDeck(deck) : null;
}

/** Existe-t-il un deck `id` appartenant à `userId` ? (garde de propriété légère). */
export async function deckBelongsToUser(id: string, userId: string): Promise<boolean> {
  const deck = await db.query.decks.findFirst({
    where: and(eq(schema.decks.id, id), eq(schema.decks.userId, userId)),
    columns: { id: true },
  });
  return Boolean(deck);
}

/** Deck par id, remappé (lecture publique partageable — pas de garde de propriété). */
export async function getDeckById(id: string): Promise<RemappedDeck | null> {
  const deck = await db.query.decks.findFirst({
    where: eq(schema.decks.id, id),
    with: { deckItems: DECK_ITEMS_WITH },
  });
  return deck ? remapDeck(deck) : null;
}

/** Deck pour la carte image : nom du propriétaire + slots (blade/ratchet/bit). */
export async function getDeckForCard(id: string) {
  const deckRow = await db.query.decks.findFirst({
    where: eq(schema.decks.id, id),
    with: {
      user: { columns: { name: true } },
      deckItems: {
        with: { part_bladeId: true, part_ratchetId: true, part_bitId: true },
        orderBy: asc(schema.deckItems.position),
      },
    },
  });
  if (!deckRow) return null;
  return {
    ...deckRow,
    items: deckRow.deckItems.map((it) => ({
      ...it,
      blade: it.part_bladeId,
      ratchet: it.part_ratchetId,
      bit: it.part_bitId,
    })),
  };
}

/** Résout un combo brut (blade/ratchet/bit par id) — carte combo publique. */
export async function getComboParts(bladeId: string, ratchetId: string, bitId: string) {
  const [blade, ratchet, bit] = await Promise.all([
    db.query.parts.findFirst({ where: eq(schema.parts.id, bladeId) }),
    db.query.parts.findFirst({ where: eq(schema.parts.id, ratchetId) }),
    db.query.parts.findFirst({ where: eq(schema.parts.id, bitId) }),
  ]);
  return { blade: blade ?? null, ratchet: ratchet ?? null, bit: bit ?? null };
}

/** Client de transaction Drizzle (paramètre du callback `db.transaction`). */
type DeckTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Désactive tous les decks actifs d'un user (optionnellement sauf `exceptId`). */
async function deactivateUserDecks(tx: DeckTx, userId: string, exceptId?: string): Promise<void> {
  const conditions = [eq(schema.decks.userId, userId), eq(schema.decks.isActive, true)];
  if (exceptId) conditions.push(ne(schema.decks.id, exceptId));
  await tx
    .update(schema.decks)
    .set({ isActive: false })
    .where(and(...conditions));
}

/** Crée un deck + ses 3 items et renvoie le deck remappé. */
export async function createDeck(params: {
  userId: string;
  name: string;
  isActive: boolean;
  beys: DeckBeyInput[];
}): Promise<RemappedDeck> {
  const { userId, name, isActive, beys } = params;
  const createdId = await db.transaction(async (tx) => {
    if (isActive) await deactivateUserDecks(tx, userId);
    const [created] = await tx.insert(schema.decks).values({ name, isActive, userId }).returning();
    await tx.insert(schema.deckItems).values(deckItemValues(created!.id, beys));
    return created!.id;
  });
  return (await getDeckById(createdId))!;
}

/** Met à jour un deck (nom / actif / items) et renvoie la version remappée. */
export async function updateDeck(params: {
  id: string;
  userId: string;
  name?: string;
  isActive?: boolean;
  beys?: DeckBeyInput[];
}): Promise<RemappedDeck> {
  const { id, userId, name, isActive, beys } = params;
  await db.transaction(async (tx) => {
    if (isActive) await deactivateUserDecks(tx, userId, id);
    const setData: { name?: string; isActive?: boolean } = {};
    if (name) setData.name = name;
    if (isActive !== undefined) setData.isActive = isActive;
    if (Object.keys(setData).length > 0) {
      await tx.update(schema.decks).set(setData).where(eq(schema.decks.id, id));
    }
    if (beys) {
      await tx.delete(schema.deckItems).where(eq(schema.deckItems.deckId, id));
      await tx.insert(schema.deckItems).values(deckItemValues(id, beys));
    }
  });
  return (await getDeckById(id))!;
}

/** Active un deck (et désactive les autres du même user). */
export async function activateDeck(id: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deactivateUserDecks(tx, userId);
    await tx.update(schema.decks).set({ isActive: true }).where(eq(schema.decks.id, id));
  });
}

/** Supprime un deck (cascade items en DB). */
export async function deleteDeck(id: string): Promise<void> {
  await db.delete(schema.decks).where(eq(schema.decks.id, id));
}
