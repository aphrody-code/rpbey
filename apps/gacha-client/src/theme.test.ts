/**
 * Tests purs du thème par rareté (`theme.ts`). Garantit les invariants visuels :
 * progression monotone des étoiles/intensité, complétude de la table, palette de
 * marque figée. Aucune dépendance runtime.
 */
import { describe, expect, test } from "bun:test";
import { BRAND, RARITY_THEME, rarityTheme } from "./theme";
import { RARITY_ORDER } from "./types";

describe("RARITY_THEME — complétude", () => {
  test("une entrée par rareté du contrat, et rien d'autre", () => {
    expect(Object.keys(RARITY_THEME).sort()).toEqual([...RARITY_ORDER].sort());
  });

  test("chaque entrée a color/accent/stars/label/intensity bien typés", () => {
    for (const r of RARITY_ORDER) {
      const t = RARITY_THEME[r];
      expect(typeof t.color).toBe("number");
      expect(typeof t.accent).toBe("number");
      expect(Number.isInteger(t.stars)).toBe(true);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.intensity).toBeGreaterThanOrEqual(0);
      expect(t.intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe("rarityTheme — lookup", () => {
  test("retourne l'objet exact de la table", () => {
    expect(rarityTheme("SECRET")).toBe(RARITY_THEME.SECRET);
    expect(rarityTheme("COMMON").label).toBe("Commune");
    expect(rarityTheme("LEGENDARY").label).toBe("Légendaire");
  });
});

describe("progression monotone le long de RARITY_ORDER", () => {
  test("étoiles strictement croissantes (1 → 5)", () => {
    const stars = RARITY_ORDER.map((r) => RARITY_THEME[r].stars);
    expect(stars).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < stars.length; i++) {
      expect(stars[i]).toBeGreaterThan(stars[i - 1]);
    }
  });

  test("intensité non décroissante, bornée [0..1], COMMON le plus bas, SECRET = 1", () => {
    const inten = RARITY_ORDER.map((r) => RARITY_THEME[r].intensity);
    for (let i = 1; i < inten.length; i++) {
      expect(inten[i]).toBeGreaterThanOrEqual(inten[i - 1]);
    }
    expect(RARITY_THEME.COMMON.intensity).toBe(Math.min(...inten));
    expect(RARITY_THEME.SECRET.intensity).toBe(1);
  });
});

describe("BRAND — palette aurore figée", () => {
  test("couleurs de marque exactes (régression visuelle)", () => {
    expect(BRAND.red).toBe(0xe23b5a);
    expect(BRAND.blue).toBe(0x3b6ee2);
    expect(BRAND.gold).toBe(0xffcf5c);
  });

  test("toutes les valeurs tiennent sur 24 bits (RGB hex valide)", () => {
    for (const v of Object.values(BRAND)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffff);
    }
  });
});
