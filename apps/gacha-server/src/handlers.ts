/**
 * Handlers des endpoints gacha. Chaque fonction reçoit l'utilisateur résolu +
 * le body/query, renvoie l'objet JSON exact attendu par le client
 * (apps/bot/src/lib/gacha-api.ts), ou lève une ApiError.
 */
import { db, schema } from "@rpbey/db";
import { and, asc, desc, eq, ilike, lt, sql } from "drizzle-orm";
import type { AuthUser } from "./auth";
import {
  BADGES,
  DAILY_BASE,
  DAILY_COOLDOWN_H,
  DEBT_INTEREST,
  FUSION_DUPES_REQUIRED,
  GIFT_COOLDOWN_H,
  MULTI_PULL_COST,
  MULTI_PULL_COUNT,
  PITY_THRESHOLD,
  PULL_COST,
  RARITY_ORDER,
  RATES,
  SELL_PRICE,
  SR_PLUS,
  STREAK_MILESTONES,
  STREAK_RESET_H,
  type Rarity,
} from "./config";
import { cardDto, rollRarity, type CardRow } from "./game";
import { ApiError } from "./http";

const {
  gachaCards,
  gachaDrops,
  cardInventory,
  cardWishlists,
  profiles,
  currencyTransactions,
  users,
} = schema;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CARD_COLS = {
  id: gachaCards.id,
  name: gachaCards.name,
  nameJp: gachaCards.nameJp,
  series: gachaCards.series,
  description: gachaCards.description,
  rarity: gachaCards.rarity,
  element: gachaCards.element,
  att: gachaCards.att,
  def: gachaCards.def,
  end: gachaCards.end,
  equilibre: gachaCards.equilibre,
  beyblade: gachaCards.beyblade,
  imageUrl: gachaCards.imageUrl,
  specialMove: gachaCards.specialMove,
  isActive: gachaCards.isActive,
  dropId: gachaCards.dropId,
} as const;

const now = () => new Date().toISOString();
const H = 3_600_000;

function isRarity(s: string): s is Rarity {
  return (RARITY_ORDER as string[]).includes(s);
}

interface ProfileRow {
  id: string;
  userId: string;
  currency: number;
  pityCount: number;
  dailyStreak: number;
  lastDaily: string | null;
  lastGiftSent: string | null;
  duelWins: number;
  duelRating: number;
}

const PROFILE_COLS = {
  id: profiles.id,
  userId: profiles.userId,
  currency: profiles.currency,
  pityCount: profiles.pityCount,
  dailyStreak: profiles.dailyStreak,
  lastDaily: profiles.lastDaily,
  lastGiftSent: profiles.lastGiftSent,
  duelWins: profiles.duelWins,
  duelRating: profiles.duelRating,
} as const;

async function ensureProfile(userId: string): Promise<ProfileRow> {
  const found = await db
    .select(PROFILE_COLS)
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (found[0]) return found[0];
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
  const again = await db
    .select(PROFILE_COLS)
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!again[0]) throw new ApiError("NO_PROFILE", "Profil introuvable", 500);
  return again[0];
}

/** Carte active aléatoire de la rareté demandée, fallback raretés inférieures puis n'importe laquelle. */
async function pickCard(rarity: Rarity): Promise<CardRow | null> {
  const idx = RARITY_ORDER.indexOf(rarity);
  const tryOrder = [rarity, ...RARITY_ORDER.slice(0, idx).reverse()];
  for (const r of tryOrder) {
    const rows = await db
      .select(CARD_COLS)
      .from(gachaCards)
      .where(and(eq(gachaCards.isActive, true), eq(gachaCards.rarity, r)))
      .orderBy(sql`random()`)
      .limit(1);
    if (rows[0]) return rows[0];
  }
  const any = await db
    .select(CARD_COLS)
    .from(gachaCards)
    .where(eq(gachaCards.isActive, true))
    .orderBy(sql`random()`)
    .limit(1);
  return any[0] ?? null;
}

async function uniqueCardCount(userId: string): Promise<number> {
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cardInventory)
    .where(eq(cardInventory.userId, userId));
  return r[0]?.n ?? 0;
}

async function wishlistedCardIds(profileId: string): Promise<Set<string>> {
  const rows = await db
    .select({ cardId: cardWishlists.cardId })
    .from(cardWishlists)
    .where(eq(cardWishlists.profileId, profileId));
  return new Set(rows.map((r) => r.cardId));
}

/** Crédite/débite la monnaie + journalise, dans une transaction donnée. */
async function moveCurrency(tx: Tx, userId: string, delta: number, type: string, note: string) {
  await tx
    .update(profiles)
    .set({ currency: sql`${profiles.currency} + ${delta}`, updatedAt: now() })
    .where(eq(profiles.userId, userId));
  await tx
    .insert(currencyTransactions)
    .values({ userId, amount: delta, type: type as never, note });
}

/** Ajoute une carte à l'inventaire (count+1), renvoie true si c'était un doublon. */
async function addCard(tx: Tx, userId: string, cardId: string): Promise<boolean> {
  const existing = await tx
    .select({ count: cardInventory.count })
    .from(cardInventory)
    .where(and(eq(cardInventory.userId, userId), eq(cardInventory.cardId, cardId)))
    .limit(1);
  if (existing[0]) {
    await tx
      .update(cardInventory)
      .set({ count: sql`${cardInventory.count} + 1` })
      .where(and(eq(cardInventory.userId, userId), eq(cardInventory.cardId, cardId)));
    return true;
  }
  await tx.insert(cardInventory).values({ userId, cardId, count: 1, obtainedAt: now() });
  return false;
}

/** Résout un tirage (rareté + carte) en respectant la pity. Renvoie aussi la pity mise à jour. */
async function resolvePull(
  pityBefore: number,
): Promise<{ rarity: Rarity | null; card: CardRow | null; pityAfter: number }> {
  let rolled = rollRarity();
  let pityAfter: number;
  if (rolled !== "MISS" && SR_PLUS.includes(rolled)) {
    pityAfter = 0;
  } else if (pityBefore + 1 >= PITY_THRESHOLD) {
    rolled = "SUPER_RARE"; // garantie pity
    pityAfter = 0;
  } else {
    pityAfter = pityBefore + 1;
  }
  if (rolled === "MISS") return { rarity: null, card: null, pityAfter };
  const card = await pickCard(rolled);
  return { rarity: card ? (card.rarity as Rarity) : null, card, pityAfter };
}

// ─── Handlers ──────────────────────────────────────────────────────────────

export async function pull(user: AuthUser) {
  const prof = await ensureProfile(user.id);
  if (prof.currency < PULL_COST)
    throw new ApiError("INSUFFICIENT_FUNDS", `Solde insuffisant (${PULL_COST} 🪙 requis)`, 400);

  const { rarity, card, pityAfter } = await resolvePull(prof.pityCount);
  const wished = card ? await wishlistedCardIds(prof.id) : new Set<string>();

  const result = await db.transaction(async (tx) => {
    await moveCurrency(tx, user.id, -PULL_COST, "GACHA_PULL", `Tirage simple`);
    await tx.update(profiles).set({ pityCount: pityAfter }).where(eq(profiles.userId, user.id));
    let isDuplicate = false;
    if (card) isDuplicate = await addCard(tx, user.id, card.id);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return { newBalance: bal[0]?.c ?? 0, isDuplicate };
  });

  const unique = await uniqueCardCount(user.id);
  const badge = BADGES.find((b) => b.count === unique);

  return {
    ok: true,
    result: {
      rarity,
      card: card ? cardDto(card) : null,
      isDuplicate: result.isDuplicate,
      isWished: card ? wished.has(card.id) : false,
      newBalance: result.newBalance,
      pityCount: pityAfter,
      badgeUnlocked: badge ? { name: badge.name, emoji: badge.emoji, reward: badge.reward } : null,
    },
  };
}

export async function pullMulti(user: AuthUser) {
  const prof = await ensureProfile(user.id);
  if (prof.currency < MULTI_PULL_COST)
    throw new ApiError(
      "INSUFFICIENT_FUNDS",
      `Solde insuffisant (${MULTI_PULL_COST} 🪙 requis)`,
      400,
    );

  // Tire 10 fois ; garantit au moins 1 SR+ (force le dernier si besoin).
  const draws: { rarity: Rarity | null; card: CardRow | null }[] = [];
  for (let i = 0; i < MULTI_PULL_COUNT; i++) {
    const r = await resolvePull(0); // pity neutralisée pendant le multi (reset après)
    draws.push({ rarity: r.rarity, card: r.card });
  }
  if (!draws.some((d) => d.rarity && SR_PLUS.includes(d.rarity as Rarity))) {
    const card = await pickCard("SUPER_RARE");
    draws[MULTI_PULL_COUNT - 1] = {
      rarity: card ? (card.rarity as Rarity) : "SUPER_RARE",
      card,
    };
  }

  const wished = await wishlistedCardIds(prof.id);
  const results = await db.transaction(async (tx) => {
    await moveCurrency(
      tx,
      user.id,
      -MULTI_PULL_COST,
      "MULTI_PULL",
      `Multi-tirage ×${MULTI_PULL_COUNT}`,
    );
    await tx.update(profiles).set({ pityCount: 0 }).where(eq(profiles.userId, user.id));
    const out = [];
    for (const d of draws) {
      let isDuplicate = false;
      if (d.card) isDuplicate = await addCard(tx, user.id, d.card.id);
      out.push({
        rarity: d.rarity,
        card: d.card ? cardDto(d.card) : null,
        isDuplicate,
        isWished: d.card ? wished.has(d.card.id) : false,
        newBalance: 0,
        pityCount: 0,
      });
    }
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return { out, newBalance: bal[0]?.c ?? 0 };
  });

  for (const r of results.out) r.newBalance = results.newBalance;
  const hitsCount = results.out.filter((r) => r.card).length;
  return {
    ok: true,
    result: {
      results: results.out,
      newBalance: results.newBalance,
      hitsCount,
      missCount: MULTI_PULL_COUNT - hitsCount,
    },
  };
}

export async function daily(user: AuthUser) {
  const prof = await ensureProfile(user.id);
  const nowMs = Date.now();
  const lastMs = prof.lastDaily ? new Date(prof.lastDaily).getTime() : null;
  if (lastMs && nowMs - lastMs < DAILY_COOLDOWN_H * H) {
    const retryInMs = DAILY_COOLDOWN_H * H - (nowMs - lastMs);
    throw new ApiError("ALREADY_CLAIMED", "Récompense quotidienne déjà réclamée", 429, retryInMs);
  }
  const hoursSince = lastMs ? (nowMs - lastMs) / H : Infinity;
  const streakBroken = lastMs !== null && hoursSince > STREAK_RESET_H;
  const streakAfter = lastMs && !streakBroken ? prof.dailyStreak + 1 : 1;
  const milestone = STREAK_MILESTONES.find((m) => m.days === streakAfter);
  const streakBonus = milestone?.bonus ?? 0;
  const tier = STREAK_MILESTONES.filter((m) => m.days <= streakAfter).length;
  const interestPaid = prof.currency < 0 ? Math.round(Math.abs(prof.currency) * DEBT_INTEREST) : 0;
  const gain = DAILY_BASE + streakBonus;

  const newBalance = await db.transaction(async (tx) => {
    await moveCurrency(tx, user.id, gain, "DAILY_CLAIM", `Daily j${streakAfter}`);
    if (interestPaid > 0)
      await moveCurrency(tx, user.id, -interestPaid, "ADMIN_TAKE", "Intérêts dette");
    await tx
      .update(profiles)
      .set({ lastDaily: now(), dailyStreak: streakAfter })
      .where(eq(profiles.userId, user.id));
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return bal[0]?.c ?? 0;
  });

  return {
    ok: true,
    result: {
      amount: DAILY_BASE,
      streakBonus,
      totalGain: gain - interestPaid,
      tier,
      streakAfter,
      newBalance,
      message: streakBroken ? "Série réinitialisée — nouveau départ !" : `Jour ${streakAfter} 🔥`,
      streakBonusLabel: milestone?.label,
      interestPaid: interestPaid || undefined,
      streakBroken: streakBroken || undefined,
    },
  };
}

export async function balance(user: AuthUser) {
  const p = await ensureProfile(user.id);
  return {
    currency: p.currency,
    dailyStreak: p.dailyStreak,
    lastDaily: p.lastDaily,
    pityCount: p.pityCount,
    userId: user.id,
  };
}

export async function inventoryPage(user: AuthUser, q: URLSearchParams) {
  const rarity = q.get("rarity") ?? undefined;
  const cursor = q.get("cursor") ?? undefined;
  const limit = Math.min(50, Math.max(1, Number(q.get("limit") ?? "20") || 20));

  const conds = [eq(cardInventory.userId, user.id)];
  if (rarity && isRarity(rarity)) conds.push(eq(gachaCards.rarity, rarity));
  if (cursor) conds.push(lt(cardInventory.obtainedAt, cursor));

  const rows = await db
    .select({
      cardId: cardInventory.cardId,
      count: cardInventory.count,
      obtainedAt: cardInventory.obtainedAt,
      card: CARD_COLS,
    })
    .from(cardInventory)
    .innerJoin(gachaCards, eq(cardInventory.cardId, gachaCards.id))
    .where(and(...conds))
    .orderBy(desc(cardInventory.obtainedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const totalRes = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cardInventory)
    .where(eq(cardInventory.userId, user.id));

  return {
    ok: true,
    page: {
      items: page.map((r) => ({
        cardId: r.cardId,
        count: r.count,
        card: cardDto(r.card),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.obtainedAt ?? null) : null,
      total: totalRes[0]?.n ?? 0,
    },
  };
}

export async function sell(user: AuthUser, body: Record<string, unknown>) {
  const cardId = String(body.cardId ?? "");
  if (!cardId) throw new ApiError("BAD_REQUEST", "cardId requis", 400);
  const rows = await db
    .select({
      count: cardInventory.count,
      rarity: gachaCards.rarity,
      name: gachaCards.name,
    })
    .from(cardInventory)
    .innerJoin(gachaCards, eq(cardInventory.cardId, gachaCards.id))
    .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.count < 2)
    throw new ApiError("NO_DUPLICATE", "Aucun doublon à vendre pour cette carte", 400);
  const price = SELL_PRICE[(isRarity(row.rarity) ? row.rarity : "COMMON") as Rarity];

  const newBalance = await db.transaction(async (tx) => {
    await tx
      .update(cardInventory)
      .set({ count: sql`${cardInventory.count} - 1` })
      .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)));
    await moveCurrency(tx, user.id, price, "SELL_CARD", `Vente ${row.name}`);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return bal[0]?.c ?? 0;
  });

  return {
    ok: true,
    result: {
      pricePaid: price,
      newBalance,
      cardName: row.name,
      rarity: row.rarity,
    },
  };
}

export async function sellAll(user: AuthUser) {
  const rows = await db
    .select({
      cardId: cardInventory.cardId,
      count: cardInventory.count,
      rarity: gachaCards.rarity,
      name: gachaCards.name,
    })
    .from(cardInventory)
    .innerJoin(gachaCards, eq(cardInventory.cardId, gachaCards.id))
    .where(and(eq(cardInventory.userId, user.id)));
  const dupes = rows.filter((r) => r.count >= 2);
  if (dupes.length === 0) throw new ApiError("NO_DUPLICATE", "Aucun doublon à vendre", 400);

  const sold: {
    name: string;
    rarity: string;
    count: number;
    earned: number;
  }[] = [];
  let totalEarned = 0;
  const newBalance = await db.transaction(async (tx) => {
    for (const r of dupes) {
      const extra = r.count - 1;
      const unit = SELL_PRICE[(isRarity(r.rarity) ? r.rarity : "COMMON") as Rarity];
      const earned = unit * extra;
      totalEarned += earned;
      sold.push({ name: r.name, rarity: r.rarity, count: extra, earned });
      await tx
        .update(cardInventory)
        .set({ count: 1 })
        .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, r.cardId)));
    }
    await moveCurrency(tx, user.id, totalEarned, "SELL_CARD", `Vente de ${sold.length} doublons`);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return bal[0]?.c ?? 0;
  });

  return {
    ok: true,
    result: {
      soldCount: sold.reduce((a, s) => a + s.count, 0),
      totalEarned,
      newBalance,
      sold,
    },
  };
}

export async function gift(user: AuthUser, body: Record<string, unknown>) {
  const recipientId = String(body.recipientId ?? "");
  const cardId = String(body.cardId ?? "");
  if (!recipientId || !cardId)
    throw new ApiError("BAD_REQUEST", "recipientId et cardId requis", 400);
  if (recipientId === user.id)
    throw new ApiError("BAD_REQUEST", "Tu ne peux pas te donner une carte", 400);

  const prof = await ensureProfile(user.id);
  if (prof.lastGiftSent) {
    const since = Date.now() - new Date(prof.lastGiftSent).getTime();
    if (since < GIFT_COOLDOWN_H * H)
      throw new ApiError(
        "COOLDOWN",
        "Don déjà effectué récemment",
        429,
        GIFT_COOLDOWN_H * H - since,
      );
  }
  const owned = await db
    .select({ count: cardInventory.count })
    .from(cardInventory)
    .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)))
    .limit(1);
  if (!owned[0] || owned[0].count < 2)
    throw new ApiError("NO_DUPLICATE", "Il te faut un doublon pour offrir cette carte", 400);

  const rcp = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  if (!rcp[0]) throw new ApiError("NO_RECIPIENT", "Destinataire introuvable", 404);

  await db.transaction(async (tx) => {
    await tx
      .update(cardInventory)
      .set({ count: sql`${cardInventory.count} - 1` })
      .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)));
    await addCard(tx, recipientId, cardId);
    await tx.update(profiles).set({ lastGiftSent: now() }).where(eq(profiles.userId, user.id));
  });

  return {
    ok: true,
    result: {
      newBalance: prof.currency,
      recipientName: rcp[0].name ?? undefined,
    },
  };
}

export async function wishlistToggle(user: AuthUser, body: Record<string, unknown>) {
  const cardId = String(body.cardId ?? "");
  if (!cardId) throw new ApiError("BAD_REQUEST", "cardId requis", 400);
  const prof = await ensureProfile(user.id);
  const card = await db
    .select({ name: gachaCards.name })
    .from(gachaCards)
    .where(eq(gachaCards.id, cardId))
    .limit(1);
  if (!card[0]) throw new ApiError("NO_CARD", "Carte introuvable", 404);
  const existing = await db
    .select({ id: cardWishlists.id })
    .from(cardWishlists)
    .where(and(eq(cardWishlists.profileId, prof.id), eq(cardWishlists.cardId, cardId)))
    .limit(1);
  let added: boolean;
  if (existing[0]) {
    await db.delete(cardWishlists).where(eq(cardWishlists.id, existing[0].id));
    added = false;
  } else {
    await db
      .insert(cardWishlists)
      .values({ profileId: prof.id, cardId, createdAt: now() })
      .onConflictDoNothing();
    added = true;
  }
  return { ok: true, added, cardName: card[0].name };
}

export async function wishlist(user: AuthUser) {
  const prof = await ensureProfile(user.id);
  const rows = await db
    .select({ card: CARD_COLS })
    .from(cardWishlists)
    .innerJoin(gachaCards, eq(cardWishlists.cardId, gachaCards.id))
    .where(eq(cardWishlists.profileId, prof.id))
    .orderBy(desc(cardWishlists.createdAt));
  const owned = await db
    .select({ cardId: cardInventory.cardId })
    .from(cardInventory)
    .where(eq(cardInventory.userId, user.id));
  const ownedSet = new Set(owned.map((o) => o.cardId));
  return {
    ok: true,
    items: rows.map((r) => ({
      cardId: r.card.id,
      card: cardDto(r.card),
      owned: ownedSet.has(r.card.id),
    })),
  };
}

export async function history(user: AuthUser, q: URLSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? "20") || 20));
  const cursor = q.get("cursor") ?? undefined;
  const type = q.get("type") ?? undefined;
  const conds = [eq(currencyTransactions.userId, user.id)];
  if (cursor) conds.push(lt(currencyTransactions.createdAt, cursor));
  if (type) conds.push(eq(currencyTransactions.type, type as never));
  const rows = await db
    .select({
      id: currencyTransactions.id,
      amount: currencyTransactions.amount,
      type: currencyTransactions.type,
      note: currencyTransactions.note,
      createdAt: currencyTransactions.createdAt,
    })
    .from(currencyTransactions)
    .where(and(...conds))
    .orderBy(desc(currencyTransactions.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    ok: true,
    page: {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.createdAt ?? null) : null,
    },
  };
}

export function rates() {
  return { ok: true, ...RATES, pityThreshold: PITY_THRESHOLD };
}

export async function cardById(id: string) {
  const rows = await db.select(CARD_COLS).from(gachaCards).where(eq(gachaCards.id, id)).limit(1);
  if (!rows[0]) throw new ApiError("NO_CARD", "Carte introuvable", 404);
  return { ok: true, card: cardDto(rows[0]) };
}

export async function searchCards(q: URLSearchParams) {
  const term = (q.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(q.get("limit") ?? "10") || 10));
  const conds = term ? [ilike(gachaCards.name, `%${term}%`)] : [];
  const rows = await db
    .select(CARD_COLS)
    .from(gachaCards)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(gachaCards.name))
    .limit(limit);
  return { ok: true, items: rows.map(cardDto) };
}

export async function banners() {
  const rows = await db
    .select({
      id: gachaDrops.id,
      slug: gachaDrops.slug,
      name: gachaDrops.name,
      theme: gachaDrops.theme,
      season: gachaDrops.season,
      startDate: gachaDrops.startDate,
      endDate: gachaDrops.endDate,
      imageUrl: gachaDrops.imageUrl,
      isActive: gachaDrops.isActive,
    })
    .from(gachaDrops)
    .orderBy(desc(gachaDrops.season));
  return { banners: rows };
}

async function claimedBadgeCounts(userId: string): Promise<Set<number>> {
  const rows = await db
    .select({ note: currencyTransactions.note })
    .from(currencyTransactions)
    .where(
      and(
        eq(currencyTransactions.userId, userId),
        eq(currencyTransactions.type, "BADGE_REWARD" as never),
      ),
    );
  const set = new Set<number>();
  for (const r of rows) {
    const m = r.note?.match(/badge:(\d+)/);
    if (m) set.add(Number(m[1]));
  }
  return set;
}

export async function badges(user: AuthUser) {
  await ensureProfile(user.id);
  const unique = await uniqueCardCount(user.id);
  const claimed = await claimedBadgeCounts(user.id);
  const list = BADGES.map((b) => ({
    count: b.count,
    name: b.name,
    emoji: b.emoji,
    reward: b.reward,
    earned: unique >= b.count,
    claimed: claimed.has(b.count),
  }));
  const next = BADGES.find((b) => unique < b.count);
  return {
    ok: true,
    progress: {
      badges: list,
      uniqueCards: unique,
      nextBadge: next
        ? {
            count: next.count,
            name: next.name,
            emoji: next.emoji,
            reward: next.reward,
          }
        : null,
    },
  };
}

export async function claimBadge(user: AuthUser) {
  const unique = await uniqueCardCount(user.id);
  const claimed = await claimedBadgeCounts(user.id);
  const eligible = BADGES.filter((b) => unique >= b.count && !claimed.has(b.count));
  if (eligible.length === 0) throw new ApiError("NO_BADGE", "Aucun badge à réclamer", 400);
  const badge = eligible[eligible.length - 1]!;
  const newBalance = await db.transaction(async (tx) => {
    await moveCurrency(tx, user.id, badge.reward, "BADGE_REWARD", `badge:${badge.count}`);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return bal[0]?.c ?? 0;
  });
  return {
    ok: true,
    result: {
      badge: { name: badge.name, emoji: badge.emoji, reward: badge.reward },
      newBalance,
    },
  };
}

/** Rareté la plus haute ayant >= FUSION_DUPES_REQUIRED doublons. */
async function fusionCandidates(userId: string) {
  const rows = await db
    .select({
      rarity: gachaCards.rarity,
      count: cardInventory.count,
      card: CARD_COLS,
    })
    .from(cardInventory)
    .innerJoin(gachaCards, eq(cardInventory.cardId, gachaCards.id))
    .where(eq(cardInventory.userId, userId));
  const eligible = rows.filter((r) => r.count >= FUSION_DUPES_REQUIRED && r.rarity !== "SECRET");
  return eligible;
}

export async function fusionPreview(user: AuthUser) {
  const eligible = await fusionCandidates(user.id);
  if (eligible.length === 0)
    return {
      ok: true,
      preview: {
        eligible: false,
        candidates: [],
        targetRarity: null,
        message: `Il faut ${FUSION_DUPES_REQUIRED} doublons d'une même carte.`,
      },
    };
  return {
    ok: true,
    preview: {
      eligible: true,
      candidates: eligible.map((e) => cardDto(e.card)),
      targetRarity: null,
      message: `Fusionne ${FUSION_DUPES_REQUIRED} doublons → 1 carte de rareté supérieure.`,
    },
  };
}

export async function fuse(user: AuthUser, body: Record<string, unknown>) {
  const cardId = String(body.cardId ?? "");
  if (!cardId) throw new ApiError("BAD_REQUEST", "cardId requis", 400);
  const rows = await db
    .select({ count: cardInventory.count, rarity: gachaCards.rarity })
    .from(cardInventory)
    .innerJoin(gachaCards, eq(cardInventory.cardId, gachaCards.id))
    .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.count < FUSION_DUPES_REQUIRED)
    throw new ApiError("NOT_ENOUGH", `Il faut ${FUSION_DUPES_REQUIRED} exemplaires`, 400);
  const rarity = (isRarity(row.rarity) ? row.rarity : "COMMON") as Rarity;
  if (rarity === "SECRET") throw new ApiError("MAX_RARITY", "Déjà à la rareté maximale", 400);
  const targetRarity =
    RARITY_ORDER[Math.min(RARITY_ORDER.indexOf(rarity) + 1, RARITY_ORDER.length - 1)]!;
  const reward = await pickCard(targetRarity);
  if (!reward) throw new ApiError("NO_CARDS", "Aucune carte cible disponible", 404);

  const newBalance = await db.transaction(async (tx) => {
    await tx
      .update(cardInventory)
      .set({ count: sql`${cardInventory.count} - ${FUSION_DUPES_REQUIRED}` })
      .where(and(eq(cardInventory.userId, user.id), eq(cardInventory.cardId, cardId)));
    await addCard(tx, user.id, reward.id);
    await moveCurrency(tx, user.id, 0, "GACHA_PULL", `Fusion ${rarity}→${targetRarity}`);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return bal[0]?.c ?? 0;
  });

  return {
    ok: true,
    result: {
      burnedCardId: cardId,
      burnedRarity: rarity,
      rewardCard: cardDto(reward),
      rewardRarity: targetRarity,
      newBalance,
    },
  };
}

export async function leaderboard(category: string, q: URLSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? "10") || 10));
  if (category === "collection") {
    const rows = await db
      .select({
        userId: cardInventory.userId,
        value: sql<number>`count(*)::int`,
        name: users.name,
        image: users.image,
      })
      .from(cardInventory)
      .innerJoin(users, eq(cardInventory.userId, users.id))
      .groupBy(cardInventory.userId, users.name, users.image)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return { ok: true, entries: rows };
  }
  const valueCol =
    category === "wins"
      ? profiles.duelWins
      : category === "mmr"
        ? profiles.duelRating
        : profiles.currency;
  const rows = await db
    .select({
      userId: profiles.userId,
      value: valueCol,
      name: users.name,
      image: users.image,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .orderBy(desc(valueCol))
    .limit(limit);
  return { ok: true, entries: rows };
}

export async function adminGrant(user: AuthUser, body: Record<string, unknown>) {
  if (!user.isAdmin) throw new ApiError("FORBIDDEN", "Réservé aux admins", 403);
  const targetUserId = String(body.targetUserId ?? "");
  const amount = Math.trunc(Number(body.amount ?? 0));
  const note = typeof body.note === "string" ? body.note : "admin grant";
  if (!targetUserId || !Number.isFinite(amount) || amount === 0)
    throw new ApiError("BAD_REQUEST", "targetUserId et amount (≠0) requis", 400);
  const prof = await ensureProfile(targetUserId);
  const prevBalance = prof.currency;
  const newBalance = await db.transaction(async (tx) => {
    await moveCurrency(tx, targetUserId, amount, amount > 0 ? "ADMIN_GIVE" : "ADMIN_TAKE", note);
    const bal = await tx
      .select({ c: profiles.currency })
      .from(profiles)
      .where(eq(profiles.userId, targetUserId))
      .limit(1);
    return bal[0]?.c ?? 0;
  });
  return { ok: true, newBalance, prevBalance };
}

/** Duel/Trade temps-réel async : non réimplémentés côté REST (cf. docs/gacha/bot.md). */
export function notImplemented(feature: string): never {
  throw new ApiError("NOT_IMPLEMENTED", `${feature} non disponible sur ce serveur`, 501);
}
