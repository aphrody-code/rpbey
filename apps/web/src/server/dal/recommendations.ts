import "server-only";
import { db, schema, count, isNotNull } from "@/lib/db";

/**
 * Data Access Layer — recommandations.
 * SEUL endroit (avec les autres modules `dal/`) autorisé à importer `@rpbey/db`.
 * Aucune dépendance UI : data brute, asynchrone.
 */

/** Stats d'usage des pièces dans les decks enregistrés (popularité méta). */
export async function getPartUsageStats() {
  const [bladeUsage, ratchetUsage, bitUsage] = await Promise.all([
    db
      .select({ id: schema.deckItems.bladeId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bladeId))
      .groupBy(schema.deckItems.bladeId),
    db
      .select({ id: schema.deckItems.ratchetId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.ratchetId))
      .groupBy(schema.deckItems.ratchetId),
    db
      .select({ id: schema.deckItems.bitId, count: count() })
      .from(schema.deckItems)
      .where(isNotNull(schema.deckItems.bitId))
      .groupBy(schema.deckItems.bitId),
  ]);
  return { bladeUsage, ratchetUsage, bitUsage };
}

/** Pièces + produits (avec relations beyblades) pour le matching/scoring. */
export async function getPartsAndProducts() {
  const [parts, products] = await Promise.all([
    db.query.parts.findMany(),
    db.query.products.findMany({
      with: {
        beyblades: {
          with: {
            part_bladeId: true,
            part_ratchetId: true,
            part_bitId: true,
          },
        },
      },
    }),
  ]);
  return { parts, products };
}
