"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { type PublicUserResponse } from "@rpbey/api-contract";
import useSWR from "swr";
import {
  BladerProfileHeader,
  FavoritePartsCard,
  MatchHistory,
  ProfileBanner,
  ProfileDecksSection,
  ProfileIdentityCard,
  ProfileSocialsRow,
  ProfileTeamBadge,
  RivalriesCard,
  UserProfileStatsCard,
} from "@/components/profile";
import { type UserStats } from "@/lib/stats-types";

interface PublicProfileProps {
  id: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublicProfile({ id }: PublicProfileProps) {
  const { data: statsData, isLoading: statsLoading } = useSWR<{
    data: UserStats;
  }>(id ? `/api/stats?userId=${id}` : null, fetcher);

  const { data: publicData, isLoading: userLoading } = useSWR<{
    ok: boolean;
    data: PublicUserResponse;
  }>(id ? `/api/v1/users/${id}` : null, fetcher);

  const stats = statsData?.data;
  const user = publicData?.data?.user;
  const profile = user?.profile ?? null;

  const handleDownloadCard = async () => {
    const response = await fetch(`/api/users/${id}/card`);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stats?.bladerName ?? "profile"}-card.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (statsLoading || userLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h5" sx={{ color: "text.secondary" }}>
            Profil introuvable
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {profile?.bannerImage && (
        <Box sx={{ mb: 3 }}>
          <ProfileBanner imageUrl={profile.bannerImage} accentColor={profile.accentColor} />
        </Box>
      )}

      <Box sx={{ mb: 4 }}>
        <BladerProfileHeader
          stats={stats}
          avatarUrl={user?.serverAvatar ?? user?.image ?? undefined}
          joinDate={user?.createdAt ?? undefined}
          bio={profile?.bio ?? undefined}
          displayName={profile?.displayName ?? undefined}
          pronouns={profile?.pronouns ?? undefined}
          accentColor={profile?.accentColor ?? undefined}
          challongeUsername={stats.challongeUsername}
          onDownloadCard={handleDownloadCard}
          isOwnProfile={false}
          socials={{
            twitter: profile?.twitterHandle,
            tiktok: profile?.tiktokHandle,
          }}
        />
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <UserProfileStatsCard stats={stats} />
            <ProfileDecksSection userId={id} isOwnProfile={false} />
            <MatchHistory userId={id} />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {profile && (
              <ProfileIdentityCard
                favoriteSeason={profile.favoriteSeason}
                favoriteType={profile.favoriteType}
                favoriteBeyblade={profile.favoriteBeyblade}
                favoriteDeck={profile.favoriteDeck}
                duelRating={profile.duelRating}
                location={{
                  country: profile.country,
                  region: profile.region,
                  city: profile.city,
                }}
              />
            )}
            {profile?.team && <ProfileTeamBadge team={profile.team} />}
            {profile && (
              <ProfileSocialsRow
                socials={{
                  twitterHandle: profile.twitterHandle,
                  tiktokHandle: profile.tiktokHandle,
                  instagramHandle: profile.instagramHandle,
                  youtubeHandle: profile.youtubeHandle,
                  twitchHandle: profile.twitchHandle,
                  discordHandle: profile.discordHandle,
                  websiteUrl: profile.websiteUrl,
                }}
              />
            )}
            <RivalriesCard rivalries={stats.rivalries} />
            <FavoritePartsCard
              blades={stats.mostUsedBlades}
              ratchets={stats.mostUsedRatchets}
              bits={stats.mostUsedBits}
            />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
