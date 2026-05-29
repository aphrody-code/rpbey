"use client";

export const REGION_LABEL: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  UK: "Royaume-Uni",
  EU: "Europe",
  US: "USA",
  JP: "Japon",
  INT: "International",
};

export const REGION_FLAG: Record<string, string> = {
  FR: "FR",
  BE: "BE",
  CH: "CH",
  UK: "UK",
  EU: "EU",
  US: "US",
  JP: "JP",
  INT: "INT",
};

export const SHOP_TYPE_LABEL: Record<string, string> = {
  specialist: "Specialist",
  marketplace: "Marketplace",
  retailer: "Retailer",
  official: "Official",
  import: "JP Import",
};

// Product type groups — English names per mission requirement
export const PRODUCT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "bey", label: "Bey" },
  { value: "starter", label: "Starter" },
  { value: "booster", label: "Booster" },
  { value: "deck", label: "Deck Set" },
  { value: "blade", label: "Blade" },
  { value: "ratchet", label: "Ratchet" },
  { value: "bit", label: "Bit" },
  { value: "stadium", label: "Stadium" },
  { value: "launcher", label: "Launcher" },
  { value: "string_launcher", label: "String Launcher" },
  { value: "accessory", label: "Accessory" },
] as const;

export const SORT_OPTIONS = [
  { value: "cheapest_asc", label: "Prix croissant" },
  { value: "cheapest_desc", label: "Prix decroissant" },
  { value: "savings_desc", label: "% economie (max)" },
  { value: "shops_desc", label: "Nb boutiques" },
  { value: "meta_desc", label: "Pertinence meta" },
  { value: "hype_desc", label: "Popularite / Hype" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];
export type ProductTypeOption = (typeof PRODUCT_TYPE_OPTIONS)[number]["value"];

// Tier display helpers
export const TIER_COLOR: Record<string, string> = {
  S: "#f87171",
  A: "#c084fc",
  B: "#60a5fa",
  C: "#9ca3af",
};
export const TIER_BG: Record<string, string> = {
  S: "rgba(239,68,68,0.15)",
  A: "rgba(168,85,247,0.15)",
  B: "rgba(59,130,246,0.15)",
  C: "rgba(255,255,255,0.08)",
};

export const MAX_COMPARE = 4;
