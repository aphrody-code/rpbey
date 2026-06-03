import { describe, expect, test } from "bun:test";

import * as types from "../src/index";

// `@rpbey/types` est volontairement TYPES-ONLY : `src/index.ts` ne contient
// QUE des `export type` (modèles Drizzle Infer{Select,Insert}Model + unions
// d'enums + types de relations). Tous ces exports sont effacés à la compilation
// — il n'existe AUCUNE valeur runtime à tester.
//
// Ce test garantit deux invariants réels :
//   1. le module se charge sans throw (pas d'effet de bord, pas d'import qui
//      tirerait postgres.js — l'import est `import type` côté source) ;
//   2. la surface runtime est bien VIDE (0 export de valeur), ce qui prouve
//      qu'aucune valeur n'a fuité par erreur dans un package destiné aux types.

describe("@rpbey/types (types-only)", () => {
  test("le module se charge sans lever d'exception", () => {
    expect(types).toBeDefined();
  });

  test("la surface runtime est vide (aucun export de valeur)", () => {
    expect(Object.keys(types)).toHaveLength(0);
  });
});
