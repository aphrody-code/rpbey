import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findUserBySessionToken } from "@/server/dal/gacha";

/**
 * Get authenticated user from session or Bearer token.
 * Mobile app sends: Authorization: Bearer <session-token>
 */
export async function getApiUser() {
  const hdrs = await headers();

  // Try Bearer token auth first (mobile)
  const authHeader = hdrs.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = await findUserBySessionToken(token);
    if (user) return user;
  }

  // Fall back to cookie-based auth (web)
  const session = await auth.api.getSession({ headers: hdrs });
  return session?.user ?? null;
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export function serverError(error: unknown) {
  console.error("API Error:", error);
  return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
}

// ─── Gacha Logic ─────────────────────────────────────────────────────────────

const RARITY_WEIGHTS = [
  { rarity: "COMMON" as const, weight: 60 },
  { rarity: "RARE" as const, weight: 25 },
  { rarity: "SUPER_RARE" as const, weight: 10 },
  { rarity: "LEGENDARY" as const, weight: 4 },
  { rarity: "SECRET" as const, weight: 1 },
];

type CardRarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";

export function rollCardRarity(): CardRarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const tier of RARITY_WEIGHTS) {
    cumulative += tier.weight;
    if (roll < cumulative) return tier.rarity;
  }
  return "COMMON";
}

export const SINGLE_PULL_COST = 100;
export const MULTI_PULL_COST = 450;
export const MULTI_PULL_COUNT = 5;
export const PITY_THRESHOLD = 3;
export const DAILY_BASE_AMOUNT = 50;
export const DAILY_STREAK_BONUS = 10;
export const DAILY_MAX_BONUS = 100;
export const DAILY_RESET_HOURS = 48;
