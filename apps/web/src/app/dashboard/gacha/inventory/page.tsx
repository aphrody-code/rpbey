import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import { db, schema, and, asc, desc, eq, gt, inArray, lt } from "@/lib/db";
import type { CardRarity } from "@/lib/types";
import { InventoryClient } from "./_components/InventoryClient";

export const metadata: Metadata = {
  title: "Inventaire | Gacha Dashboard",
  description: "Votre collection de cartes gacha.",
};

const PAGE_SIZE = 24;

interface PageProps {
  searchParams: Promise<{
    rarity?: string;
    dropId?: string;
    cursor?: string;
    prev?: string;
  }>;
}

const VALID_RARITIES = new Set<string>(["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"]);

export default async function GachaInventoryPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const rawRarity = sp.rarity ?? "";
  const rarity: CardRarity | "" = VALID_RARITIES.has(rawRarity) ? (rawRarity as CardRarity) : "";
  const dropId = sp.dropId ?? "";
  const cursor = sp.cursor ?? null;
  const isBack = Boolean(sp.prev);

  // Resolve card-level filter (rarity / dropId) into a set of card ids.
  let filterCardIds: string[] | null = null;
  if (rarity || dropId) {
    const cardConds = [];
    if (rarity) cardConds.push(eq(schema.gachaCards.rarity, rarity));
    if (dropId) cardConds.push(eq(schema.gachaCards.dropId, dropId));
    const matchingCards = await db.query.gachaCards.findMany({
      where: and(...cardConds),
      columns: { id: true },
    });
    filterCardIds = matchingCards.map((c) => c.id);
    if (filterCardIds.length === 0) filterCardIds = ["__none__"];
  }

  // Cursor pagination on obtainedAt (orderBy desc), id-based cursor row lookup.
  let cursorObtainedAt: string | null = null;
  if (cursor) {
    const cursorRow = await db.query.cardInventory.findFirst({
      where: eq(schema.cardInventory.id, cursor),
      columns: { obtainedAt: true },
    });
    cursorObtainedAt = cursorRow?.obtainedAt ?? null;
  }

  const baseConds = [eq(schema.cardInventory.userId, session.user.id)];
  if (filterCardIds) baseConds.push(inArray(schema.cardInventory.cardId, filterCardIds));
  if (cursorObtainedAt) {
    baseConds.push(
      isBack
        ? gt(schema.cardInventory.obtainedAt, cursorObtainedAt)
        : lt(schema.cardInventory.obtainedAt, cursorObtainedAt),
    );
  }

  // Fetch one extra to detect next page
  const rawItems = await db.query.cardInventory.findMany({
    where: and(...baseConds),
    with: {
      gachaCard: {
        with: {
          gachaDrop: { columns: { name: true } },
        },
      },
    },
    orderBy: isBack ? asc(schema.cardInventory.obtainedAt) : desc(schema.cardInventory.obtainedAt),
    limit: PAGE_SIZE + 1,
  });

  const items = rawItems.map((it) => ({
    ...it,
    card: { ...it.gachaCard, drop: it.gachaCard.gachaDrop ?? null },
  }));

  // Normalize direction
  const forward = isBack ? items.reverse() : items;
  const hasMore = forward.length > PAGE_SIZE;
  const page = hasMore ? forward.slice(0, PAGE_SIZE) : forward;

  const nextCursor = hasMore ? (page[PAGE_SIZE - 1]?.id ?? null) : null;
  const prevCursor = cursor ? (page[0]?.id ?? null) : null;
  const hasPrev = Boolean(cursor);
  const hasNext = hasMore;

  // Load drops for filter
  const drops = await db.query.gachaDrops.findMany({
    orderBy: desc(schema.gachaDrops.season),
    columns: { id: true, name: true },
  });

  // Load wishlist for current user
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
    columns: { id: true },
  });

  const wishlistSet = new Set<string>();
  if (profile) {
    const wishlist = await db.query.cardWishlists.findMany({
      where: eq(schema.cardWishlists.profileId, profile.id),
      columns: { cardId: true },
    });
    for (const w of wishlist) wishlistSet.add(w.cardId);
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Mon inventaire
      </Typography>
      <InventoryClient
        items={page}
        drops={drops}
        hasPrev={hasPrev}
        hasNext={hasNext}
        nextCursor={nextCursor}
        prevCursor={prevCursor}
        rarity={rarity}
        dropId={dropId}
        wishlistIds={wishlistSet}
      />
    </Box>
  );
}
