import "server-only";
import {
  db,
  schema,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "@/lib/db";
import type { CardRarity, TransactionType } from "@/lib/types";

/**
 * Data Access Layer — Gacha TCG + économie (cartes, drops, inventaire, wishlist,
 * profil, transactions, duels) + lectures Stardust/BTS pour les actions du domaine.
 *
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine (direct ET transitif).
 * UI-agnostic. Invariant timestamp : toutes les tables gacha sont en `mode:"string"`
 * (string ISO) — on écrit `new Date().toISOString()`, on lit des strings.
 */

const PART_TYPES = ["BLADE", "OVER_BLADE", "RATCHET", "BIT", "LOCK_CHIP", "ASSIST_BLADE"] as const;

// ─── Auth Bearer (sessions, mode:"date") ────────────────────────────────────

/**
 * Résout un session-token Bearer → user (mobile). La table `sessions` est en
 * `mode:"date"` (invariant auth) : `expiresAt` est un objet `Date`, on compare
 * donc avec `new Date()`.
 */
export async function findUserBySessionToken(token: string) {
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, new Date())),
    with: { user: true },
  });
  return session?.user ?? null;
}

// ─── Cartes & drops (lectures publiques) ─────────────────────────────────────

export interface GachaCardsFilter {
  rarity?: CardRarity;
  dropId?: string;
  series?: string;
  search?: string;
  activeOnly?: boolean;
  limit?: number;
}

/** Catalogue public de cartes (filtres + limite) — `/api/v1/gacha/cards`. */
export async function listGachaCards(params: GachaCardsFilter) {
  const { rarity, dropId, series, search, activeOnly, limit = 200 } = params;
  const conditions: SQL[] = [];
  if (activeOnly) conditions.push(eq(schema.gachaCards.isActive, true));
  if (rarity) conditions.push(eq(schema.gachaCards.rarity, rarity));
  if (dropId) conditions.push(eq(schema.gachaCards.dropId, dropId));
  if (series) conditions.push(eq(schema.gachaCards.series, series));
  if (search) {
    const orCond = or(
      ilike(schema.gachaCards.name, `%${search}%`),
      ilike(schema.gachaCards.slug, `%${search}%`),
    );
    if (orCond) conditions.push(orCond);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [cards, totalRows] = await Promise.all([
    db.query.gachaCards.findMany({
      where,
      limit,
      orderBy: [desc(schema.gachaCards.rarity), asc(schema.gachaCards.name)],
    }),
    db.select({ value: count() }).from(schema.gachaCards).where(where),
  ]);
  return { cards, total: totalRows[0]?.value ?? 0 };
}

/** Une carte par id ou slug (route OG `/api/gacha/card`). */
export async function getGachaCard(opts: { id?: string | null; slug?: string | null }) {
  if (opts.id) {
    return db.query.gachaCards.findFirst({
      where: eq(schema.gachaCards.id, opts.id),
    });
  }
  if (opts.slug) {
    return db.query.gachaCards.findFirst({
      where: eq(schema.gachaCards.slug, opts.slug),
    });
  }
  return null;
}

/** Liste des drops + nombre de cartes par drop (route `/api/gacha/drops`). */
export async function listGachaDrops() {
  const drops = await db.query.gachaDrops.findMany({
    orderBy: desc(schema.gachaDrops.season),
    with: { gachaCards: { columns: { id: true } } },
  });
  return drops.map(({ gachaCards, ...d }) => ({
    ...d,
    cardCount: gachaCards.length,
  }));
}

/** Drops minimaux (id/name) pour le filtre d'inventaire — RSC dashboard. */
export async function listGachaDropOptions() {
  return db.query.gachaDrops.findMany({
    orderBy: desc(schema.gachaDrops.season),
    columns: { id: true, name: true },
  });
}

// ─── Profil & économie ───────────────────────────────────────────────────────

/** Profil gacha (currency, streak, duels…) + nombre de cartes possédées. */
export async function getGachaProfile(userId: string) {
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    columns: {
      id: true,
      userId: true,
      bladerName: true,
      currency: true,
      dailyStreak: true,
      lastDaily: true,
      pityCount: true,
      wins: true,
      losses: true,
      tournamentWins: true,
    },
  });
  if (!profile) return null;

  const [cardCountRow, totalCardsRow] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.cardInventory)
      .where(eq(schema.cardInventory.userId, userId)),
    db
      .select({ value: count() })
      .from(schema.gachaCards)
      .where(eq(schema.gachaCards.isActive, true)),
  ]);

  return {
    ...profile,
    cardCount: cardCountRow[0]?.value ?? 0,
    totalCards: totalCardsRow[0]?.value ?? 0,
  };
}

/** Profil gacha complet pour la carte dashboard (inclut duels + user). */
export async function getGachaDashboardProfile(userId: string) {
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    columns: {
      id: true,
      userId: true,
      bladerName: true,
      currency: true,
      dailyStreak: true,
      lastDaily: true,
      pityCount: true,
      wins: true,
      losses: true,
      tournamentWins: true,
      duelRating: true,
      duelWins: true,
      duelLosses: true,
    },
    with: { user: { columns: { name: true, image: true } } },
  });
  if (!profile) return null;

  const [cardCountRow] = await db
    .select({ value: count() })
    .from(schema.cardInventory)
    .where(eq(schema.cardInventory.userId, userId));

  return { ...profile, cardCount: cardCountRow?.value ?? 0 };
}

/** Solde courant (route action `getUserCurrency`). */
export async function getProfileCurrency(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    columns: { currency: true },
  });
}

/** Compteur de pity courant (route `/api/gacha/pull`). */
export async function getProfilePityCount(userId: string): Promise<number | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    columns: { pityCount: true },
  });
  return profile?.pityCount ?? null;
}

// ─── Inventaire (pièces & cartes) ────────────────────────────────────────────

export interface PartInventoryItem {
  partId: string;
  count: number;
  obtainedAt: string;
  part: {
    id: string;
    externalId: string;
    name: string;
    type: string;
    imageUrl: string | null;
    system: string | null;
    weight: number | null;
    beyType: string | null;
    tipType: string | null;
    protrusions: number | null;
  };
}

/** Inventaire de pièces (parts) de l'utilisateur — actions gacha + `/api/game/inventory`. */
export async function getPartInventory(userId: string): Promise<PartInventoryItem[]> {
  const rows = await db.query.partInventory.findMany({
    where: eq(schema.partInventory.userId, userId),
    with: {
      part: {
        columns: {
          id: true,
          externalId: true,
          name: true,
          type: true,
          imageUrl: true,
          system: true,
          weight: true,
          beyType: true,
          tipType: true,
          protrusions: true,
        },
      },
    },
    orderBy: desc(schema.partInventory.obtainedAt),
  });
  return rows.map((item) => ({
    partId: item.partId,
    count: item.count,
    obtainedAt: item.obtainedAt,
    part: item.part,
  }));
}

/** Inventaire de cartes (gacha_cards) de l'utilisateur — route `/api/gacha/inventory`. */
export async function getCardInventory(userId: string) {
  const rows = await db.query.cardInventory.findMany({
    where: eq(schema.cardInventory.userId, userId),
    with: { gachaCard: true },
    orderBy: desc(schema.cardInventory.obtainedAt),
  });
  return rows.map((i) => ({ ...i, card: i.gachaCard }));
}

export interface DashboardInventoryFilter {
  userId: string;
  rarity?: CardRarity | "";
  dropId?: string;
  cursor?: string | null;
  isBack: boolean;
  pageSize: number;
}

/**
 * Inventaire de cartes paginé par curseur (page dashboard inventaire).
 * Retourne `pageSize + 1` lignes pour détecter la page suivante côté appelant.
 */
export async function getDashboardCardInventory(params: DashboardInventoryFilter) {
  const { userId, rarity, dropId, cursor, isBack, pageSize } = params;

  // Résout le filtre carte (rarity/dropId) → set d'ids.
  let filterCardIds: string[] | null = null;
  if (rarity || dropId) {
    const cardConds: SQL[] = [];
    if (rarity) cardConds.push(eq(schema.gachaCards.rarity, rarity));
    if (dropId) cardConds.push(eq(schema.gachaCards.dropId, dropId));
    const matchingCards = await db.query.gachaCards.findMany({
      where: and(...cardConds),
      columns: { id: true },
    });
    filterCardIds = matchingCards.map((c) => c.id);
    if (filterCardIds.length === 0) filterCardIds = ["__none__"];
  }

  // Curseur sur obtainedAt (lookup de la ligne du curseur par id).
  let cursorObtainedAt: string | null = null;
  if (cursor) {
    const cursorRow = await db.query.cardInventory.findFirst({
      where: eq(schema.cardInventory.id, cursor),
      columns: { obtainedAt: true },
    });
    cursorObtainedAt = cursorRow?.obtainedAt ?? null;
  }

  const baseConds: SQL[] = [eq(schema.cardInventory.userId, userId)];
  if (filterCardIds) baseConds.push(inArray(schema.cardInventory.cardId, filterCardIds));
  if (cursorObtainedAt) {
    baseConds.push(
      isBack
        ? gt(schema.cardInventory.obtainedAt, cursorObtainedAt)
        : lt(schema.cardInventory.obtainedAt, cursorObtainedAt),
    );
  }

  const rawItems = await db.query.cardInventory.findMany({
    where: and(...baseConds),
    with: { gachaCard: { with: { gachaDrop: { columns: { name: true } } } } },
    orderBy: isBack ? asc(schema.cardInventory.obtainedAt) : desc(schema.cardInventory.obtainedAt),
    limit: pageSize + 1,
  });

  return rawItems.map((it) => ({
    ...it,
    card: { ...it.gachaCard, drop: it.gachaCard.gachaDrop ?? null },
  }));
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

/** Set des cardId en wishlist pour un profil (RSC inventaire). */
export async function getWishlistCardIds(profileId: string): Promise<Set<string>> {
  const wishlist = await db.query.cardWishlists.findMany({
    where: eq(schema.cardWishlists.profileId, profileId),
    columns: { cardId: true },
  });
  return new Set(wishlist.map((w) => w.cardId));
}

/** Cartes en wishlist (route `/api/gacha/wishlist`). */
export async function getWishlistCards(profileId: string) {
  const wishlist = await db.query.cardWishlists.findMany({
    where: eq(schema.cardWishlists.profileId, profileId),
    with: { gachaCard: true },
    orderBy: desc(schema.cardWishlists.createdAt),
  });
  return wishlist.map((w) => w.gachaCard);
}

export async function getProfileIdByUser(userId: string): Promise<string | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
    columns: { id: true },
  });
  return profile?.id ?? null;
}

export async function addToWishlist(profileId: string, cardId: string) {
  await db
    .insert(schema.cardWishlists)
    .values({ profileId, cardId })
    .onConflictDoNothing({
      target: [schema.cardWishlists.profileId, schema.cardWishlists.cardId],
    });
}

export async function removeFromWishlist(profileId: string, cardId: string) {
  await db
    .delete(schema.cardWishlists)
    .where(
      and(eq(schema.cardWishlists.profileId, profileId), eq(schema.cardWishlists.cardId, cardId)),
    );
}

// ─── Leaderboard gacha public ─────────────────────────────────────────────────

/** Classement gacha public (par BeyCoins) — `/api/v1/gacha/leaderboard`. */
export async function getGachaLeaderboard(limit = 100) {
  const profiles = await db.query.profiles.findMany({
    orderBy: desc(schema.profiles.currency),
    limit,
    columns: {
      userId: true,
      bladerName: true,
      currency: true,
      duelWins: true,
      duelRating: true,
    },
    with: { user: { columns: { name: true, image: true } } },
  });

  const userIds = profiles.map((p) => p.userId);
  const cardCounts = userIds.length
    ? await db
        .select({ userId: schema.cardInventory.userId, value: count() })
        .from(schema.cardInventory)
        .where(inArray(schema.cardInventory.userId, userIds))
        .groupBy(schema.cardInventory.userId)
    : [];
  const cardCountMap = new Map<string, number>(cardCounts.map((c) => [c.userId, c.value]));

  return profiles.map((p, i) => ({
    rank: i + 1,
    userId: p.userId,
    name: p.bladerName ?? p.user.name,
    image: p.user.image,
    currency: p.currency,
    duelWins: p.duelWins,
    duelRating: p.duelRating,
    cardCount: cardCountMap.get(p.userId) ?? 0,
  }));
}

// ─── Historique des transactions ──────────────────────────────────────────────

/** Transactions de currency d'un utilisateur (page dashboard historique). */
export async function listCurrencyTransactions(opts: {
  userId: string;
  type?: TransactionType | "";
  limit?: number;
}) {
  const { userId, type, limit = 100 } = opts;
  return db.query.currencyTransactions.findMany({
    where: and(
      eq(schema.currencyTransactions.userId, userId),
      ...(type ? [eq(schema.currencyTransactions.type, type)] : []),
    ),
    orderBy: desc(schema.currencyTransactions.createdAt),
    limit,
    columns: {
      id: true,
      amount: true,
      type: true,
      note: true,
      createdAt: true,
    },
  });
}

// ─── Pull / Multi (pièces, via server actions) ────────────────────────────────

/** Pièces d'une ligne produit (BX/UX/CX) pour le tirage de pièces. */
export async function getPartsForLine(line: string) {
  return db.query.parts.findMany({
    where: and(eq(schema.parts.system, line), inArray(schema.parts.type, PART_TYPES)),
  });
}

export interface PullPartOutcome {
  partId: string;
  cost: number;
  type: TransactionType;
  note: string;
}

/**
 * Transaction de tirage de pièces : vérifie le solde, débite, upsert l'inventaire,
 * journalise. Lève `NO_PROFILE` / `INSUFFICIENT_FUNDS`. Retourne le nouveau solde.
 */
export async function executePartPullTx(opts: {
  userId: string;
  partIds: string[];
  cost: number;
  type: TransactionType;
  note: string;
}): Promise<number> {
  const { userId, partIds, cost, type, note } = opts;
  return db.transaction(async (tx) => {
    // Verrou ligne profil (`FOR UPDATE`) — sérialise les tirages de pièces
    // concurrents → pas d'overspend (cf. executeCardPullTx). Sans verrou, 2
    // tirages parallèles lisent le même solde et débitent tous deux.
    const [profile] = await tx
      .select({ currency: schema.profiles.currency })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .for("update")
      .limit(1);
    if (!profile) throw new Error("NO_PROFILE");
    if (profile.currency < cost) throw new Error("INSUFFICIENT_FUNDS");

    const [updated] = await tx
      .update(schema.profiles)
      .set({ currency: sql`${schema.profiles.currency} - ${cost}` })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    for (const partId of partIds) {
      await tx
        .insert(schema.partInventory)
        .values({ userId, partId, count: 1 })
        .onConflictDoUpdate({
          target: [schema.partInventory.userId, schema.partInventory.partId],
          set: { count: sql`${schema.partInventory.count} + 1` },
        });
    }

    await tx.insert(schema.currencyTransactions).values({ userId, amount: -cost, type, note });

    return updated!.currency;
  });
}

// ─── Pull / Multi (cartes, via routes API) ────────────────────────────────────

/** Carte active d'une rareté donnée (offset aléatoire), fallback toute carte active. */
export async function pickActiveCardByRarity(rarity: CardRarity) {
  const [cnt] = await db
    .select({ value: count() })
    .from(schema.gachaCards)
    .where(and(eq(schema.gachaCards.rarity, rarity), eq(schema.gachaCards.isActive, true)));
  const card = await db.query.gachaCards.findFirst({
    where: and(eq(schema.gachaCards.rarity, rarity), eq(schema.gachaCards.isActive, true)),
    orderBy: desc(schema.gachaCards.createdAt),
    offset: Math.floor(Math.random() * (cnt?.value ?? 0)),
  });
  if (card) return card;
  return db.query.gachaCards.findFirst({
    where: eq(schema.gachaCards.isActive, true),
  });
}

type GachaCardRow = typeof schema.gachaCards.$inferSelect;

/**
 * Tirage de cartes transactionnel : sélectionne les cartes par rareté via `pickFn`,
 * débite, upsert inventaire, met à jour la pity, journalise. Lève
 * `NO_PROFILE` / `INSUFFICIENT_FUNDS` / `NO_CARDS`.
 */
export async function executeCardPullTx(opts: {
  userId: string;
  rarities: CardRarity[];
  cost: number;
  type: TransactionType;
  newPityCount: number;
  pickFn: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    rarity: CardRarity,
  ) => Promise<GachaCardRow | null | undefined>;
  noteFor: (cards: GachaCardRow[]) => string;
}): Promise<{ cards: GachaCardRow[]; newBalance: number; pityCount: number }> {
  const { userId, rarities, cost, type, newPityCount, pickFn, noteFor } = opts;
  return db.transaction(async (tx) => {
    // Verrou ligne profil (`SELECT … FOR UPDATE`) : sérialise les tirages
    // concurrents du même user → le contrôle de solde et le débit sont atomiques
    // (sinon 2 tirages parallèles lisent le même solde et débitent → solde négatif).
    const [profile] = await tx
      .select({
        id: schema.profiles.id,
        currency: schema.profiles.currency,
        pityCount: schema.profiles.pityCount,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .for("update")
      .limit(1);
    if (!profile) throw new Error("NO_PROFILE");
    if (profile.currency < cost) throw new Error("INSUFFICIENT_FUNDS");

    const cards: GachaCardRow[] = [];
    for (const rarity of rarities) {
      const picked = await pickFn(tx, rarity);
      if (picked) cards.push(picked);
    }
    if (cards.length === 0) throw new Error("NO_CARDS");

    const [updated] = await tx
      .update(schema.profiles)
      .set({
        currency: sql`${schema.profiles.currency} - ${cost}`,
        pityCount: newPityCount,
      })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    for (const card of cards) {
      await tx
        .insert(schema.cardInventory)
        .values({ userId, cardId: card.id, count: 1 })
        .onConflictDoUpdate({
          target: [schema.cardInventory.userId, schema.cardInventory.cardId],
          set: { count: sql`${schema.cardInventory.count} + 1` },
        });
    }

    await tx
      .insert(schema.currencyTransactions)
      .values({ userId, amount: -cost, type, note: noteFor(cards) });

    return { cards, newBalance: updated!.currency, pityCount: newPityCount };
  });
}

/** Sélectionne une carte active par rareté à l'intérieur d'une transaction. */
export async function pickActiveCardByRarityTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  rarity: CardRarity,
): Promise<GachaCardRow | null> {
  const [cnt] = await tx
    .select({ value: count() })
    .from(schema.gachaCards)
    .where(and(eq(schema.gachaCards.rarity, rarity), eq(schema.gachaCards.isActive, true)));
  const card = await tx.query.gachaCards.findFirst({
    where: and(eq(schema.gachaCards.rarity, rarity), eq(schema.gachaCards.isActive, true)),
    orderBy: desc(schema.gachaCards.createdAt),
    offset: Math.floor(Math.random() * (cnt?.value ?? 0)),
  });
  if (card) return card;
  return (
    (await tx.query.gachaCards.findFirst({
      where: eq(schema.gachaCards.isActive, true),
    })) ?? null
  );
}

// ─── Daily claim ───────────────────────────────────────────────────────────────

/**
 * Crédite la récompense quotidienne de façon anti-race (UPDATE conditionnel sur
 * `lastDaily < début du jour UTC`). Lève `NO_PROFILE` / `ALREADY_CLAIMED`.
 */
export async function claimDailyTx(opts: {
  userId: string;
  baseAmount: number;
  streakBonus: number;
  maxBonus: number;
  resetHours: number;
}): Promise<{ amount: number; streak: number; newBalance: number }> {
  const { userId, baseAmount, streakBonus, maxBonus, resetHours } = opts;
  return db.transaction(async (tx) => {
    const profile = await tx.query.profiles.findFirst({
      where: eq(schema.profiles.userId, userId),
      columns: { currency: true, lastDaily: true, dailyStreak: true },
    });
    if (!profile) throw new Error("NO_PROFILE");

    const now = new Date();
    if (profile.lastDaily) {
      const lastDate = new Date(profile.lastDaily);
      const isSameDay =
        lastDate.getUTCFullYear() === now.getUTCFullYear() &&
        lastDate.getUTCMonth() === now.getUTCMonth() &&
        lastDate.getUTCDate() === now.getUTCDate();
      if (isSameDay) throw new Error("ALREADY_CLAIMED");
    }

    let newStreak = 1;
    if (profile.lastDaily) {
      const hoursSince = (now.getTime() - new Date(profile.lastDaily).getTime()) / (1000 * 60 * 60);
      if (hoursSince < resetHours) newStreak = profile.dailyStreak + 1;
    }

    const bonus = Math.min((newStreak - 1) * streakBonus, maxBonus);
    const totalAmount = baseAmount + bonus;

    const startOfTodayIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
    const [updated] = await tx
      .update(schema.profiles)
      .set({
        currency: sql`${schema.profiles.currency} + ${totalAmount}`,
        lastDaily: now.toISOString(),
        dailyStreak: newStreak,
      })
      .where(
        and(
          eq(schema.profiles.userId, userId),
          or(isNull(schema.profiles.lastDaily), lt(schema.profiles.lastDaily, startOfTodayIso)),
        ),
      )
      .returning();

    if (!updated) throw new Error("ALREADY_CLAIMED");

    await tx.insert(schema.currencyTransactions).values({
      userId,
      amount: totalAmount,
      type: "DAILY_CLAIM",
      note: `Récompense quotidienne (série: ${newStreak} jours)`,
    });

    return {
      amount: totalAmount,
      streak: newStreak,
      newBalance: updated.currency,
    };
  });
}

// ─── Duel ────────────────────────────────────────────────────────────────────

export async function getOwnedCard(userId: string, cardId: string) {
  return db.query.cardInventory.findFirst({
    where: and(eq(schema.cardInventory.userId, userId), eq(schema.cardInventory.cardId, cardId)),
    with: { gachaCard: true },
  });
}

/** Carte adverse aléatoire parmi les cartes actives. */
export async function getRandomActiveCard() {
  const [totalRow] = await db
    .select({ value: count() })
    .from(schema.gachaCards)
    .where(eq(schema.gachaCards.isActive, true));
  const total = totalRow?.value ?? 0;
  return db.query.gachaCards.findFirst({
    where: eq(schema.gachaCards.isActive, true),
    offset: Math.floor(Math.random() * total),
  });
}

/** Crédite la récompense de duel + journalise (hors transaction, fire path). */
export async function awardDuelReward(userId: string, reward: number, note: string) {
  await db
    .update(schema.profiles)
    .set({ currency: sql`${schema.profiles.currency} + ${reward}` })
    .where(eq(schema.profiles.userId, userId));
  await db.insert(schema.currencyTransactions).values({
    userId,
    amount: reward,
    type: "TOURNAMENT_REWARD",
    note,
  });
}

// ─── OG : Stardust & leaderboard saisonnier ────────────────────────────────────

/** Stats agrégées pour l'OG Stardust (compte tournois, bladers, podium). */
export async function getStardustOgStats() {
  const [tournamentCountRows, bladerCountRows, podium] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.tournaments)
      .innerJoin(
        schema.tournamentCategories,
        eq(schema.tournaments.categoryId, schema.tournamentCategories.id),
      )
      .where(
        and(
          ilike(schema.tournamentCategories.name, "%STARDUST%"),
          inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED"]),
        ),
      ),
    db.select({ value: count() }).from(schema.stardustBladers),
    db.query.stardustRankings.findMany({
      orderBy: asc(schema.stardustRankings.rank),
      limit: 3,
      columns: { rank: true, playerName: true, score: true },
    }),
  ]);
  return {
    tournamentCount: tournamentCountRows[0]?.value ?? 0,
    bladerCount: bladerCountRows[0]?.value ?? 0,
    podium: podium.map((p) => ({
      rank: p.rank,
      name: p.playerName,
      score: p.score,
    })),
  };
}

/** Top 10 de la saison active (OG leaderboard card). */
export async function getActiveSeasonTop10() {
  const seasonRow = await db.query.rankingSeasons.findFirst({
    where: eq(schema.rankingSeasons.isActive, true),
    with: {
      seasonEntries: {
        orderBy: desc(schema.seasonEntries.points),
        limit: 10,
        with: { user: { columns: { name: true, image: true } } },
      },
    },
  });
  if (!seasonRow) return null;
  return { ...seasonRow, entries: seasonRow.seasonEntries };
}

// ─── Stardust / BTS (lectures DB pour les actions du domaine) ──────────────────

const STARDUST_CATEGORY = "STARDUST";

/** Ids des catégories de tournoi dont le nom contient STARDUST. */
async function stardustCategoryIds(): Promise<string[]> {
  const cats = await db
    .select({ id: schema.tournamentCategories.id })
    .from(schema.tournamentCategories)
    .where(ilike(schema.tournamentCategories.name, `%${STARDUST_CATEGORY}%`));
  return cats.map((c) => c.id);
}

export interface LoadedStardustTournament {
  id: string;
  name: string;
  date: Date;
  format: string;
  status: string;
  challongeState: string | null;
  participants: (typeof schema.tournamentParticipants.$inferSelect)[];
  matches: (typeof schema.tournamentMatches.$inferSelect)[];
}

/** Tournois Stardust (COMPLETE/ARCHIVED/UNDERWAY) avec participants + matches. */
export async function loadStardustTournaments(): Promise<LoadedStardustTournament[]> {
  const catIds = await stardustCategoryIds();
  if (catIds.length === 0) return [];
  const rows = await db.query.tournaments.findMany({
    where: and(
      inArray(schema.tournaments.categoryId, catIds),
      inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED", "UNDERWAY"]),
    ),
    orderBy: asc(schema.tournaments.date),
    with: {
      tournamentParticipants: true,
      tournamentMatches: true,
      tournamentCategory: true,
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    date: new Date(t.date),
    format: t.format,
    status: t.status,
    challongeState: t.challongeState,
    participants: t.tournamentParticipants,
    matches: t.tournamentMatches,
  }));
}

export async function getStardustBladerByName(name: string) {
  return db.query.stardustBladers.findFirst({
    where: ilike(schema.stardustBladers.name, name),
  });
}

/** Résout un id OU un slug/label vers un tournoi Stardust (id-only). */
export async function resolveStardustTournamentId(idOrSlug: string): Promise<string | null> {
  const byId = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, idOrSlug),
    columns: { id: true },
  });
  if (byId) return byId.id;
  const catIds = await stardustCategoryIds();
  if (catIds.length === 0) return null;
  const byName = await db.query.tournaments.findFirst({
    where: and(
      inArray(schema.tournaments.categoryId, catIds),
      ilike(schema.tournaments.name, `%${idOrSlug}%`),
    ),
    columns: { id: true },
  });
  return byName?.id ?? null;
}

/** Top 10 (finalPlacement) d'un tournoi donné. */
export async function getTournamentTop10(tournamentId: string) {
  return db.query.tournamentParticipants.findMany({
    where: and(
      eq(schema.tournamentParticipants.tournamentId, tournamentId),
      isNotNull(schema.tournamentParticipants.finalPlacement),
      gt(schema.tournamentParticipants.finalPlacement, 0),
    ),
    orderBy: asc(schema.tournamentParticipants.finalPlacement),
    limit: 10,
    columns: { playerName: true, finalPlacement: true },
  });
}

/** Tous les bladers Stardust (pour le linkage Discord). */
export async function listStardustBladers() {
  return db.query.stardustBladers.findMany();
}

/** Users avec leur discordTag (pour le linkage Stardust). */
export async function listUsersForStardustLink() {
  return db.query.users.findMany({
    columns: { id: true, name: true, discordTag: true },
  });
}

export async function setStardustBladerLink(bladerId: string, userId: string) {
  await db
    .update(schema.stardustBladers)
    .set({ linkedUserId: userId })
    .where(eq(schema.stardustBladers.id, bladerId));
}

// BTS : enrichissement Discord (résolveur d'avatars).
export interface BtsDiscordUserRow {
  id: string;
  discordId: string | null;
  username: string | null;
  displayUsername: string | null;
  name: string | null;
  globalName: string | null;
  nickname: string | null;
  discordTag: string | null;
  image: string | null;
  profile: {
    challongeUsername: string | null;
    bladerName: string | null;
  } | null;
}

/** Users Discord + profil (challongeUsername/bladerName) pour le résolveur BTS. */
export async function listDiscordUsersForBts(): Promise<BtsDiscordUserRow[]> {
  const userRows = await db.query.users.findMany({
    where: isNotNull(schema.users.discordId),
    columns: {
      id: true,
      discordId: true,
      username: true,
      displayUsername: true,
      name: true,
      globalName: true,
      nickname: true,
      discordTag: true,
      image: true,
    },
    with: {
      profiles: { columns: { challongeUsername: true, bladerName: true } },
    },
  });
  return userRows.map((u) => ({ ...u, profile: u.profiles[0] ?? null }));
}

/** Tournois DB par challongeId (BTS : lien bracket/poster/pools). */
export async function listTournamentsByChallongeIds(challongeIds: string[]) {
  if (challongeIds.length === 0) return [];
  return db.query.tournaments.findMany({
    where: inArray(schema.tournaments.challongeId, challongeIds),
    columns: { id: true, name: true, challongeId: true, posterUrl: true },
  });
}

// ─── Sync Stardust (DB write via builder pur) ─────────────────────────────────

export interface StardustSyncTournament {
  id: string;
  name: string;
  date: Date;
  status: string;
  challongeState: string | null;
  participants: Array<{
    playerName: string | null;
    finalPlacement: number | null;
    wins: number;
    losses: number;
  }>;
  matches: Array<{
    state: string;
    round: number;
    player1Name: string | null;
    player2Name: string | null;
    winnerName: string | null;
    score: string | null;
  }>;
}

/** Tournois Stardust prêts pour le builder de classement (forme minimale). */
export async function loadStardustSyncTournaments(): Promise<StardustSyncTournament[]> {
  const catIds = await stardustCategoryIds();
  if (catIds.length === 0) return [];
  const rows = await db.query.tournaments.findMany({
    where: and(
      inArray(schema.tournaments.categoryId, catIds),
      inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED", "UNDERWAY"]),
    ),
    orderBy: asc(schema.tournaments.date),
    with: {
      tournamentParticipants: true,
      tournamentMatches: true,
      tournamentCategory: true,
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    date: new Date(t.date),
    status: t.status,
    challongeState: t.challongeState,
    participants: t.tournamentParticipants.map((p) => ({
      playerName: p.playerName,
      finalPlacement: p.finalPlacement,
      wins: p.wins,
      losses: p.losses,
    })),
    matches: t.tournamentMatches.map((m) => ({
      state: m.state,
      round: m.round,
      player1Name: m.player1Name,
      player2Name: m.player2Name,
      winnerName: m.winnerName,
      score: m.score,
    })),
  }));
}

export interface StardustRankingRow {
  rank: number;
  playerName: string;
  score: number;
  wins: number;
  losses: number;
  participation: number;
  winRate: string;
  pointsAverage: string;
}

export interface StardustBladerRow {
  name: string;
  totalWins: number;
  totalLosses: number;
  tournamentWins: number;
  tournamentsCount: number;
  history: object[];
}

/** Barème de points actif (table ranking_system). */
export async function getRankingSystemConfig() {
  return db.query.rankingSystem.findFirst();
}

/** Remplace les classements Stardust et upsert les bladers (transaction). */
export async function persistStardustRankings(
  ranked: StardustRankingRow[],
  bladers: StardustBladerRow[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.stardustRankings);
    if (ranked.length > 0) await tx.insert(schema.stardustRankings).values(ranked);
    for (const b of bladers) {
      await tx
        .insert(schema.stardustBladers)
        .values({
          name: b.name,
          totalWins: b.totalWins,
          totalLosses: b.totalLosses,
          tournamentWins: b.tournamentWins,
          tournamentsCount: b.tournamentsCount,
          history: b.history as never,
        })
        .onConflictDoUpdate({
          target: schema.stardustBladers.name,
          set: {
            totalWins: b.totalWins,
            totalLosses: b.totalLosses,
            tournamentWins: b.tournamentWins,
            tournamentsCount: b.tournamentsCount,
            history: b.history as never,
          },
        });
    }
  });
}
