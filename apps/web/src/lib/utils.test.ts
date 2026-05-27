/// <reference lib="dom" />
import { describe, expect, test } from "bun:test";
import { cn, formatDate, formatDateShort, formatDateTime, truncate } from "./utils";

// Régression du chaos timestamp (auth=date-mode → Date, app=string-mode → string) :
// les helpers d'affichage DOIVENT rendre identique qu'on leur passe un Date ou
// une string ISO. C'est le pattern `new Date(x)` qui protège tout le rendu.
describe("date helpers — Date|string (régression timestamp mode)", () => {
  const iso = "2026-05-27T14:30:00.000Z";
  const dt = new Date(iso);
  test("formatDate identique Date vs string", () => {
    expect(formatDate(iso)).toBe(formatDate(dt));
  });
  test("formatDateShort identique Date vs string", () => {
    expect(formatDateShort(iso)).toBe(formatDateShort(dt));
  });
  test("formatDateTime identique Date vs string", () => {
    expect(formatDateTime(iso)).toBe(formatDateTime(dt));
  });
  test("formatDate produit du français lisible", () => {
    expect(formatDate("2026-12-25T00:00:00Z")).toMatch(/2026/);
  });
});

describe("cn / truncate", () => {
  test("cn merge conditionnel", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  test("truncate coupe avec ellipse", () => {
    expect(truncate("abcdefghij", 5)).toBe("ab...");
    expect(truncate("abc", 5)).toBe("abc");
  });
});

// Vérifie que happy-dom est bien préchargé (document global dispo).
test("happy-dom: document global disponible", () => {
  document.body.innerHTML = `<button>Beyblade</button>`;
  expect(document.querySelector("button")?.textContent).toBe("Beyblade");
});
