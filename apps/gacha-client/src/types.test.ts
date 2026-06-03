/**
 * Tests purs du contrat de raretés (`types.ts`) — aucune dépendance runtime
 * (pas de PixiJS, pas de DOM, pas de réseau). Ce sont les invariants métier qui
 * pilotent les FX premium et la normalisation des raretés serveur.
 */
import { describe, expect, test } from "bun:test";
import { isSrPlus, normalizeRarity, RARITY_ORDER, type Rarity } from "./types";

describe("RARITY_ORDER", () => {
  test("ordre faible → fort, 5 paliers, sans doublon", () => {
    expect(RARITY_ORDER).toEqual(["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"]);
    expect(new Set(RARITY_ORDER).size).toBe(RARITY_ORDER.length);
  });

  test("strictement croissant par index", () => {
    expect(RARITY_ORDER.indexOf("COMMON")).toBeLessThan(RARITY_ORDER.indexOf("RARE"));
    expect(RARITY_ORDER.indexOf("RARE")).toBeLessThan(RARITY_ORDER.indexOf("SUPER_RARE"));
    expect(RARITY_ORDER.indexOf("LEGENDARY")).toBeLessThan(RARITY_ORDER.indexOf("SECRET"));
  });
});

describe("normalizeRarity", () => {
  test("passe-plat sur les valeurs canoniques", () => {
    for (const r of RARITY_ORDER) {
      expect(normalizeRarity(r)).toBe(r);
    }
  });

  test("insensible à la casse", () => {
    expect(normalizeRarity("secret")).toBe("SECRET");
    expect(normalizeRarity("Legendary")).toBe("LEGENDARY");
    expect(normalizeRarity("super_rare")).toBe("SUPER_RARE");
  });

  test("EPIC (alias serveur) → SUPER_RARE", () => {
    expect(normalizeRarity("EPIC")).toBe("SUPER_RARE");
    expect(normalizeRarity("epic")).toBe("SUPER_RARE");
  });

  test("null / undefined / vide / inconnu → COMMON (fallback sûr)", () => {
    expect(normalizeRarity(null)).toBe("COMMON");
    expect(normalizeRarity(undefined)).toBe("COMMON");
    expect(normalizeRarity("")).toBe("COMMON");
    expect(normalizeRarity("MYTHIC")).toBe("COMMON");
    expect(normalizeRarity("???")).toBe("COMMON");
  });
});

describe("isSrPlus", () => {
  test("true pour SUPER_RARE et au-dessus", () => {
    expect(isSrPlus("SUPER_RARE")).toBe(true);
    expect(isSrPlus("LEGENDARY")).toBe(true);
    expect(isSrPlus("SECRET")).toBe(true);
  });

  test("false pour COMMON / RARE", () => {
    expect(isSrPlus("COMMON")).toBe(false);
    expect(isSrPlus("RARE")).toBe(false);
  });

  test("seuil cohérent : exactement les 3 raretés hautes déclenchent les FX premium", () => {
    const premium = RARITY_ORDER.filter((r: Rarity) => isSrPlus(r));
    expect(premium).toEqual(["SUPER_RARE", "LEGENDARY", "SECRET"]);
  });
});
