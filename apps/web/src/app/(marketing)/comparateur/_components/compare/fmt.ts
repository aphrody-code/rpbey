"use client";

export const fmtEur = (v: number | null | undefined): string => {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
};

export const fmtNative = (v: number | null | undefined, currency: string): string => {
  if (v == null) return "—";
  const cur = currency === "?" ? "EUR" : currency;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: cur === "JPY" ? 0 : 2,
  }).format(v);
};

export const savingPct = (
  cheapestEur: number | null,
  offers: { priceEur: number | null }[],
): number => {
  const prices = offers.map((o) => o.priceEur).filter((n): n is number => n != null);
  if (prices.length < 2 || cheapestEur == null) return 0;
  const hi = Math.max(...prices);
  return hi > cheapestEur ? Math.round((1 - cheapestEur / hi) * 100) : 0;
};

export const normalizeText = (str: string): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
};

/** Match a product type from title/code heuristics */
export function inferProductType(title: string, code: string | null): string {
  const t = title.toLowerCase();
  const c = (code ?? "").toLowerCase();
  if (c.startsWith("bx-") || c.startsWith("ux-")) {
    if (t.includes("starter")) return "starter";
    if (t.includes("booster")) return "booster";
    if (t.includes("deck")) return "deck";
    if (t.includes("stadium") || t.includes("arena")) return "stadium";
    if (t.includes("launcher") && t.includes("string")) return "string_launcher";
    if (t.includes("launcher")) return "launcher";
    if (t.includes("accessory") || t.includes("accessoire")) return "accessory";
    return "bey";
  }
  if (t.includes("blade")) return "blade";
  if (t.includes("ratchet")) return "ratchet";
  if (t.includes("bit")) return "bit";
  if (t.includes("stadium") || t.includes("arena")) return "stadium";
  if (t.includes("string launcher")) return "string_launcher";
  if (t.includes("launcher")) return "launcher";
  if (t.includes("starter")) return "starter";
  if (t.includes("booster")) return "booster";
  if (t.includes("deck")) return "deck";
  if (t.includes("accessory") || t.includes("accessoire")) return "accessory";
  return "bey";
}
