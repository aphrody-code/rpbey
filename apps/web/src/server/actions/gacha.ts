"use server";

import { headers } from "next/headers";
import { type Part, type PartType } from "@/lib/types";
import { auth } from "@/lib/auth";
import {
  claimDailyTx,
  executePartPullTx,
  getPartInventory,
  getPartsForLine,
  getProfileCurrency,
} from "@/server/dal/gacha";
import { trackEvent } from "@/server/actions/analytics";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductLine = "BX" | "UX" | "CX";

type Rarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";

interface PulledPart {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  rarity: Rarity;
  system: string | null;
  weight: number | null;
}

interface PullResult {
  success: boolean;
  parts?: PulledPart[];
  message?: string;
  newBalance?: number;
}

interface DailyResult {
  success: boolean;
  message?: string;
  amount?: number;
  streak?: number;
  newBalance?: number;
}

interface InventoryItem {
  partId: string;
  count: number;
  part: {
    id: string;
    name: string;
    type: PartType;
    imageUrl: string | null;
    system: string | null;
    weight: number | null;
    beyType: string | null;
  };
  rarity: Rarity;
}

interface CurrencyResult {
  success: boolean;
  balance?: number;
  message?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SINGLE_PULL_COST = 100;
const MULTI_PULL_COST = 450; // 10% discount on 5x
const MULTI_PULL_COUNT = 5;
const DAILY_BASE_AMOUNT = 50;
const DAILY_STREAK_BONUS = 10;
const DAILY_MAX_BONUS = 100;
const DAILY_RESET_HOURS = 48; // Streak resets after 48h without claiming

// Rarity distribution weights (must sum to 100)
const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: "COMMON", weight: 60 },
  { rarity: "RARE", weight: 25 },
  { rarity: "SUPER_RARE", weight: 10 },
  { rarity: "LEGENDARY", weight: 4 },
  { rarity: "SECRET", weight: 1 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseStat(val: string | number | null | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = String(val).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

/**
 * Compute a combined score from stats for rarity fallback.
 * Returns a 0-100 percentile-like score based on total stats.
 */
function computeStatScore(part: Part): number {
  const atk = parseStat(part.attack);
  const def = parseStat(part.defense);
  const sta = parseStat(part.stamina);
  const brs = parseStat(part.burst);
  const dsh = parseStat(part.dash);
  // Total of all combat stats, weighted — higher total = stronger part
  return atk + def + sta + brs * 0.5 + dsh * 0.5;
}

/**
 * Determine a part's rarity based on weight, stats, and special attributes.
 * Uses a multi-factor approach: weight when available, stats as fallback.
 */
function determinePartRarity(part: Part): Rarity {
  const statScore = computeStatScore(part);

  if (part.type === "BLADE" || part.type === "OVER_BLADE") {
    const w = part.weight ?? 0;
    if (w > 0) {
      // Weight-based rarity (primary)
      if (w >= 45) return "SECRET";
      if (w >= 39) return "LEGENDARY";
      if (w >= 35) return "SUPER_RARE";
      if (w >= 30) return "RARE";
      return "COMMON";
    }
    // Stat-based fallback for blades without weight
    if (statScore >= 200) return "LEGENDARY";
    if (statScore >= 150) return "SUPER_RARE";
    if (statScore >= 100) return "RARE";
    return "COMMON";
  }

  if (part.type === "RATCHET") {
    const w = part.weight ?? 0;
    const protrusions = part.protrusions ?? 0;
    // Ratchet name encodes protrusion count: "9-80" → 9 protrusions
    const nameProtrusions = parseInt(part.name.split("-")[0] ?? "0", 10) || 0;
    const effectiveProtrusions = protrusions || nameProtrusions;

    if (w > 0) {
      if (w >= 8) return "LEGENDARY";
      if (w >= 7.2) return "SUPER_RARE";
      if (w >= 6.5) return "RARE";
      return "COMMON";
    }
    // Protrusion-based fallback
    if (effectiveProtrusions >= 9) return "LEGENDARY";
    if (effectiveProtrusions >= 7) return "SUPER_RARE";
    if (effectiveProtrusions >= 4) return "RARE";
    // Stat-based last resort
    if (statScore >= 150) return "SUPER_RARE";
    if (statScore >= 100) return "RARE";
    return "COMMON";
  }

  if (part.type === "BIT") {
    const tip = (part.tipType ?? "").toLowerCase();
    const name = part.name.toLowerCase();
    const specialTips = ["gear", "trans", "rubber", "metal", "gyro"];
    const isSpecial = specialTips.some((t) => tip.includes(t) || name.includes(t));
    const w = part.weight ?? 0;

    if (isSpecial && w >= 4) return "SECRET";
    if (isSpecial) return "SUPER_RARE";
    if (w >= 4) return "LEGENDARY";
    if (w >= 3) return "RARE";
    // Stat-based fallback
    if (statScore >= 200) return "LEGENDARY";
    if (statScore >= 150) return "SUPER_RARE";
    if (statScore >= 100) return "RARE";
    return "COMMON";
  }

  if (part.type === "LOCK_CHIP") {
    const w = part.weight ?? 0;
    if (w >= 5) return "LEGENDARY";
    return "RARE";
  }

  if (part.type === "ASSIST_BLADE") {
    const w = part.weight ?? 0;
    if (w >= 7 || statScore >= 200) return "LEGENDARY";
    if (w >= 6 || statScore >= 170) return "SUPER_RARE";
    if (w >= 5 || statScore >= 140) return "RARE";
    return "COMMON";
  }

  // Fallback for any unknown type
  if (statScore >= 200) return "SUPER_RARE";
  if (statScore >= 100) return "RARE";
  return "COMMON";
}

/**
 * Roll a rarity tier based on weighted distribution.
 */
function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const tier of RARITY_WEIGHTS) {
    cumulative += tier.weight;
    if (roll < cumulative) return tier.rarity;
  }
  return "COMMON";
}

/**
 * Select a random part from the pool matching the target rarity.
 * Falls back to nearest available rarity if no parts match exactly.
 */
function selectPartByRarity(parts: Part[], targetRarity: Rarity): Part {
  // Group parts by their derived rarity
  const byRarity = new Map<Rarity, Part[]>();
  for (const part of parts) {
    const r = determinePartRarity(part);
    if (!byRarity.has(r)) byRarity.set(r, []);
    byRarity.get(r)?.push(part);
  }

  // Try exact match first
  const exact = byRarity.get(targetRarity);
  if (exact && exact.length > 0) {
    return exact[Math.floor(Math.random() * exact.length)]!;
  }

  // Fallback: try lower rarities, then higher
  const rarityOrder: Rarity[] = ["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"];
  const targetIdx = rarityOrder.indexOf(targetRarity);

  // Search downward first
  for (let i = targetIdx - 1; i >= 0; i--) {
    const fallback = byRarity.get(rarityOrder[i]!);
    if (fallback && fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)]!;
    }
  }

  // Search upward
  for (let i = targetIdx + 1; i < rarityOrder.length; i++) {
    const fallback = byRarity.get(rarityOrder[i]!);
    if (fallback && fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)]!;
    }
  }

  // Ultimate fallback: random from entire pool
  return parts[Math.floor(Math.random() * parts.length)]!;
}

/**
 * Execute the pull logic: select random parts, deduct currency, add to inventory.
 */
async function executePull(
  userId: string,
  line: ProductLine,
  count: number,
  cost: number,
  guaranteeEpicPlus: boolean,
): Promise<PullResult> {
  // Fetch all parts matching the product line system
  const availableParts = (await getPartsForLine(line)) as Part[];

  if (availableParts.length === 0) {
    return {
      success: false,
      message: `Aucune pièce disponible pour la ligne ${line}.`,
    };
  }

  // Roll rarities and select parts
  const selectedParts: { part: Part; rarity: Rarity }[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity();
    const part = selectPartByRarity(availableParts, rarity);
    selectedParts.push({ part, rarity: determinePartRarity(part) });
  }

  // Guarantee at least 1 EPIC+ for multi-pull
  if (guaranteeEpicPlus) {
    const hasEpicPlus = selectedParts.some((p) =>
      ["SUPER_RARE", "LEGENDARY", "SECRET"].includes(p.rarity),
    );
    if (!hasEpicPlus) {
      // Replace the last pull with a guaranteed EPIC+
      const guaranteedRarities: Rarity[] = ["SUPER_RARE", "LEGENDARY", "SECRET"];
      const guaranteedRarity =
        guaranteedRarities[Math.floor(Math.random() * guaranteedRarities.length)]!;
      const part = selectPartByRarity(availableParts, guaranteedRarity);
      selectedParts[selectedParts.length - 1] = {
        part,
        rarity: determinePartRarity(part),
      };
    }
  }

  // Execute transaction via DAL: deduct currency + add inventory + log
  const newBalance = await executePartPullTx({
    userId,
    partIds: selectedParts.map(({ part }) => part.id),
    cost,
    type: count > 1 ? "MULTI_PULL" : "GACHA_PULL",
    note: `${count > 1 ? "Multi" : "Single"} pull - Ligne ${line}`,
  });

  return {
    success: true,
    parts: selectedParts.map(({ part, rarity }) => ({
      id: part.id,
      name: part.name,
      type: part.type,
      imageUrl: part.imageUrl,
      rarity,
      system: part.system,
      weight: part.weight,
    })),
    newBalance,
  };
}

// ─── Public Actions ──────────────────────────────────────────────────────────

/**
 * Single pull: costs 100 currency, returns 1 random part from the given line.
 */
export async function pullBooster(line: ProductLine): Promise<PullResult> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, message: "Non connecté." };
  }

  try {
    const result = await executePull(user.id, line, 1, SINGLE_PULL_COST, false);
    void trackEvent({
      type: "gacha_pull",
      path: "/builder",
      meta: { line, count: 1, userId: user.id },
    });
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_PROFILE") {
        return {
          success: false,
          message: "Profil introuvable. Créez votre profil blader d'abord.",
        };
      }
      if (error.message === "INSUFFICIENT_FUNDS") {
        return {
          success: false,
          message: `Solde insuffisant. Il faut ${SINGLE_PULL_COST} BeyCoins pour un tirage.`,
        };
      }
    }
    console.error("Error in pullBooster:", error);
    return { success: false, message: "Une erreur est survenue." };
  }
}

/**
 * Multi pull (5x): costs 450 currency (10% discount), guaranteed 1 EPIC+ minimum.
 */
export async function pullMulti(line: ProductLine): Promise<PullResult> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, message: "Non connecté." };
  }

  try {
    const result = await executePull(user.id, line, MULTI_PULL_COUNT, MULTI_PULL_COST, true);
    void trackEvent({
      type: "gacha_pull",
      path: "/builder",
      meta: { line, count: MULTI_PULL_COUNT, userId: user.id },
    });
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_PROFILE") {
        return {
          success: false,
          message: "Profil introuvable. Créez votre profil blader d'abord.",
        };
      }
      if (error.message === "INSUFFICIENT_FUNDS") {
        return {
          success: false,
          message: `Solde insuffisant. Il faut ${MULTI_PULL_COST} BeyCoins pour un multi-tirage (x5).`,
        };
      }
    }
    console.error("Error in pullMulti:", error);
    return { success: false, message: "Une erreur est survenue." };
  }
}

/**
 * Claim daily currency reward with streak bonus.
 * Base: 50 BeyCoins + 10 per day of streak (max +100 bonus).
 * Streak resets if 48h+ since last claim.
 */
export async function claimDaily(): Promise<DailyResult> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, message: "Non connecté." };
  }

  try {
    const result = await claimDailyTx({
      userId: user.id,
      baseAmount: DAILY_BASE_AMOUNT,
      streakBonus: DAILY_STREAK_BONUS,
      maxBonus: DAILY_MAX_BONUS,
      resetHours: DAILY_RESET_HOURS,
    });

    return {
      success: true,
      amount: result.amount,
      streak: result.streak,
      newBalance: result.newBalance,
      message: `+${result.amount} BeyCoins ! Série de ${result.streak} jour${result.streak > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_PROFILE") {
        return {
          success: false,
          message: "Profil introuvable. Créez votre profil blader d'abord.",
        };
      }
      if (error.message === "ALREADY_CLAIMED") {
        return {
          success: false,
          message: "Tu as déjà récupéré ta récompense quotidienne aujourd'hui ! Reviens demain.",
        };
      }
    }
    console.error("Error in claimDaily:", error);
    return { success: false, message: "Une erreur est survenue." };
  }
}

/**
 * Get the user's collected parts inventory with counts and rarity.
 */
export async function getInventory(): Promise<InventoryItem[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const inventory = await getPartInventory(user.id);

  return inventory.map((item) => ({
    partId: item.partId,
    count: item.count,
    part: {
      id: item.part.id,
      name: item.part.name,
      type: item.part.type as PartType,
      imageUrl: item.part.imageUrl,
      system: item.part.system,
      weight: item.part.weight,
      beyType: item.part.beyType,
    },
    rarity: determinePartRarity(item.part as Part),
  }));
}

/**
 * Get the user's current currency balance.
 */
export async function getUserCurrency(): Promise<CurrencyResult> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, message: "Non connecté." };
  }

  const profile = await getProfileCurrency(user.id);

  if (!profile) {
    return {
      success: false,
      message: "Profil introuvable. Créez votre profil blader d'abord.",
    };
  }

  return { success: true, balance: profile.currency };
}
