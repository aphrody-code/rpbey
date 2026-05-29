import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import { getGachaLeaderboardEntries } from "@/server/services/gacha";
import { LeaderboardClient } from "./_components/LeaderboardClient";

export const metadata: Metadata = {
  title: "Classement | Gacha Dashboard",
  description: "Classement gacha : pièces, victoires, MMR et collection.",
};

export const revalidate = 60;

export default async function GachaLeaderboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Fetch top 100 profiles with user info + card counts (via service, seam DAL↔SDK)
  const { entries: rows } = await getGachaLeaderboardEntries(100);

  const entries = rows.map((p) => ({
    rank: 0, // computed client-side per tab
    userId: p.userId,
    name: p.name ?? null,
    image: p.image ?? null,
    currency: p.currency,
    duelWins: p.duelWins,
    duelRating: p.duelRating,
    cardCount: p.cardCount,
    isCurrentUser: p.userId === session.user.id,
  }));

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Classement
      </Typography>
      <LeaderboardClient entries={entries} />
    </Box>
  );
}
