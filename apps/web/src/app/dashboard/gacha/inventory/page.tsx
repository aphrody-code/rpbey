import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import {
  getDashboardCardInventory,
  getProfileIdByUser,
  getWishlistCardIds,
  listGachaDropOptions,
} from "@/server/dal/gacha";
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

  // Fetch one extra to detect next page (DAL gère filtre + curseur)
  const items = await getDashboardCardInventory({
    userId: session.user.id,
    rarity,
    dropId,
    cursor,
    isBack,
    pageSize: PAGE_SIZE,
  });

  // Normalize direction
  const forward = isBack ? items.reverse() : items;
  const hasMore = forward.length > PAGE_SIZE;
  const page = hasMore ? forward.slice(0, PAGE_SIZE) : forward;

  const nextCursor = hasMore ? (page[PAGE_SIZE - 1]?.id ?? null) : null;
  const prevCursor = cursor ? (page[0]?.id ?? null) : null;
  const hasPrev = Boolean(cursor);
  const hasNext = hasMore;

  // Load drops for filter
  const drops = await listGachaDropOptions();

  // Load wishlist for current user
  const profileId = await getProfileIdByUser(session.user.id);
  const wishlistSet = profileId ? await getWishlistCardIds(profileId) : new Set<string>();

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
