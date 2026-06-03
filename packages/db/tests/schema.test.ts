import { describe, expect, test } from "bun:test";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable, PgEnumColumn } from "drizzle-orm/pg-core";

// On importe UNIQUEMENT `./src/schema` (et pas `./src/index`, qui tire `./client`
// → un pool postgres.js). Les définitions de tables/enums Drizzle sont des objets
// purs construits à l'évaluation du module : aucune connexion n'est ouverte.
import * as schema from "../src/schema";

// === Enums pgEnum : valeurs littérales figées ===

describe("pgEnum definitions", () => {
  test("beyType expose les 4 catégories canoniques", () => {
    expect(schema.beyType.enumValues).toEqual(["ATTACK", "DEFENSE", "STAMINA", "BALANCE"]);
  });

  test("animeGeneration couvre les 4 générations", () => {
    expect(schema.animeGeneration.enumValues).toEqual(["ORIGINAL", "METAL", "BURST", "X"]);
  });

  test("productLine == BX/UX/CX", () => {
    expect(schema.productLine.enumValues).toEqual(["BX", "UX", "CX"]);
  });

  test("watchStatus == NOT_STARTED/IN_PROGRESS/COMPLETED", () => {
    expect(schema.watchStatus.enumValues).toEqual(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
  });
});

// === Tables pgTable : noms SQL + présence de colonnes ===

describe("pgTable identities", () => {
  test("les tables coeur exposent leur nom SQL attendu", () => {
    expect(getTableName(schema.users)).toBe("users");
    expect(getTableName(schema.parts)).toBe("parts");
    expect(getTableName(schema.beyblades)).toBe("beyblades");
  });

  test("toutes les exports pgTable sont bien des PgTable Drizzle", () => {
    const tables = Object.values(schema).filter((v) => is(v, PgTable));
    expect(tables.length).toBeGreaterThan(20);
    for (const t of tables) {
      expect(typeof getTableName(t as PgTable)).toBe("string");
      expect(getTableName(t as PgTable).length).toBeGreaterThan(0);
    }
  });
});

describe("column presence & constraints", () => {
  test("users a les colonnes d'identité attendues", () => {
    const cols = getTableColumns(schema.users);
    for (const name of ["id", "name", "email", "discordId", "role", "createdAt"]) {
      expect(cols[name]).toBeDefined();
    }
  });

  test("users.email est NOT NULL", () => {
    expect(getTableColumns(schema.users).email!.notNull).toBe(true);
  });

  test("la colonne role référence l'énum (PgEnumColumn) avec les bonnes valeurs", () => {
    const roleCol = getTableColumns(schema.parts).type;
    // parts.type est une colonne d'énum partType
    expect(is(roleCol, PgEnumColumn)).toBe(true);
    expect((roleCol as PgEnumColumn).enumValues).toEqual(schema.partType.enumValues);
  });

  test("beyblades référence blade/ratchet/bit (composition Beyblade X)", () => {
    const cols = getTableColumns(schema.beyblades);
    for (const name of ["bladeId", "ratchetId", "bitId"]) {
      expect(cols[name]).toBeDefined();
    }
  });
});
