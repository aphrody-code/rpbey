export const dynamic = "force-dynamic";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Alert, Box, Skeleton, Typography } from "@mui/material";
import { auth } from "@/lib/auth";
import { getGachaDashboardProfile } from "@/server/dal/gacha";
import { GachaProfileCard } from "@/components/GachaProfileCard";

export const metadata: Metadata = {
  title: "Profil Gacha | Dashboard",
  description: "Vos statistiques gacha, pièces, série quotidienne et duels.",
};

async function ProfileContent({ userId }: { userId: string }) {
  const profile = await getGachaDashboardProfile(userId);

  if (!profile) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          Aucun profil gacha trouvé
        </Typography>
        <Typography variant="body2">
          Lance ton premier pull dans Discord avec{" "}
          <Box component="code" sx={{ fontFamily: "monospace", px: 0.5 }}>
            /pull
          </Box>{" "}
          pour initialiser ton profil.
        </Typography>
      </Alert>
    );
  }

  return (
    <GachaProfileCard
      profile={{
        ...profile,
        cardCount: profile.cardCount,
        user: {
          name: profile.user.name,
          image: profile.user.image,
        },
      }}
    />
  );
}

function ProfileSkeleton() {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        p: 3,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Skeleton variant="rounded" width={56} height={56} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="rounded" width={80} height={22} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
      <Skeleton variant="text" height={1} sx={{ mb: 3 }} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1.5,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={90} />
        ))}
      </Box>
    </Box>
  );
}

export default async function GachaProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Mon profil Gacha
      </Typography>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent userId={session.user.id} />
      </Suspense>
    </Box>
  );
}
