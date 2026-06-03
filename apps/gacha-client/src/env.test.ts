/**
 * Tests purs de la config build-time (`env.ts`). En contexte Bun `window` est
 * undefined → `IS_DISCORD === false`, donc `proxifyUrl` est l'identité (chemin
 * hors-Discord). On vérifie aussi la normalisation des bases (slash final retiré)
 * et les défauts prod sûrs. Aucune dépendance DOM/réseau.
 */
import { describe, expect, test } from "bun:test";
import { GACHA_REST_URL, GACHA_WS_URL, IS_DISCORD, proxifyUrl, WEB_BASE } from "./env";

describe("contexte Bun (pas de window)", () => {
  test("IS_DISCORD est false hors navigateur", () => {
    expect(typeof window).toBe("undefined");
    expect(IS_DISCORD).toBe(false);
  });
});

describe("bases d'URL — défauts prod + normalisation", () => {
  test("GACHA_WS_URL pointe vers le WSS prod par défaut", () => {
    expect(GACHA_WS_URL).toBe("wss://api.rpbey.fr/gacha");
  });

  test("GACHA_REST_URL / WEB_BASE sans slash final", () => {
    expect(GACHA_REST_URL.endsWith("/")).toBe(false);
    expect(WEB_BASE.endsWith("/")).toBe(false);
    expect(GACHA_REST_URL).toBe("https://api.rpbey.fr/gacha");
    expect(WEB_BASE).toBe("https://rpbey.fr");
  });
});

describe("proxifyUrl — hors Discord = identité", () => {
  test("renvoie l'URL absolue inchangée quel que soit le mapping", () => {
    const url = "https://api.rpbey.fr/gacha/api/gacha/pull";
    expect(proxifyUrl(url, "api")).toBe(url);
    expect(proxifyUrl("https://rpbey.fr/api/v1/anime/frames?notable=true", "web")).toBe(
      "https://rpbey.fr/api/v1/anime/frames?notable=true",
    );
  });

  test("ne touche pas une entrée non-URL hors Discord", () => {
    // Hors Discord, court-circuit avant tout parsing → renvoyé tel quel.
    expect(proxifyUrl("not a url", "api")).toBe("not a url");
  });

  test("préserve query string et chemin", () => {
    const wss = "wss://api.rpbey.fr/gacha";
    expect(proxifyUrl(wss, "api")).toBe(wss);
  });
});
