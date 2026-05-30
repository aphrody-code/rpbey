"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { type PublicUserResponse } from "@rpbey/api-contract";
import { type ReactNode } from "react";
import useSWR from "swr";
import { type UserStats } from "@/lib/stats-types";
import { BladerProfileHeader } from "./BladerProfileHeader";
import { DeckBoxPhotoCard } from "./DeckBoxPhotoCard";
import { FavoritePartsCard } from "./FavoritePartsCard";
import { MatchHistory } from "./MatchHistory";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileDecksSection } from "./ProfileDecksSection";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { ProfileSocialsRow } from "./ProfileSocialsRow";
import { ProfileTeamBadge } from "./ProfileTeamBadge";
import { RivalriesCard } from "./RivalriesCard";
import { UserProfileStatsCard } from "./UserProfileStatsCard";

interface ProfileViewProps {
  /** Identifiant du joueur dont on affiche le profil (déjà résolu, pas "me"). */
  userId: string | undefined;
  /** L'utilisateur courant consulte-t-il son propre profil (active les actions owner). */
  isOwnProfile?: boolean;
  /** Affiche les rôles Discord dans l'en-tête (vue dashboard authentifiée). */
  showDiscordRoles?: boolean;
  /** Enveloppe le rendu dans un `<Container maxWidth="lg">` (vue marketing publique). */
  withContainer?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Vue de profil blader partagée entre le dashboard privé
 * (`/dashboard/profile/[id]`) et la page marketing publique (`/profile/[id]`).
 * Factorise l'intégralité du markup (bannière + en-tête + stats + decks +
 * historique + sidebar identité/socials/rivalités/parts). Les seules variations
 * entre les deux contextes sont les flags `isOwnProfile`, `showDiscordRoles` et
 * `withContainer`.
 */
export function ProfileView({
  userId,
  isOwnProfile = false,
  showDiscordRoles = false,
  withContainer = false,
}: ProfileViewProps) {
  const { data: statsData, isLoading: statsLoading } = useSWR<{ data: UserStats }>(
    userId ? `/api/stats?userId=${userId}` : null,
    fetcher,
  );

  const { data: publicData, isLoading: userLoading } = useSWR<{
    ok: boolean;
    data: PublicUserResponse;
  }>(userId ? `/api/v1/users/${userId}` : null, fetcher);

  const stats = statsData?.data;
  const user = publicData?.data?.user;
  const profile = user?.profile ?? null;

  const handleDownloadCard = async () => {
    const response = await fetch(`/api/users/${userId}/card`);
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

  const wrap = (children: ReactNode) =>
    withContainer ? (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children}
      </Container>
    ) : (
      <>{children}</>
    );

  if (statsLoading || userLoading) {
    return wrap(
      <>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </>,
    );
  }

  if (!stats) {
    return wrap(
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" sx={{ color: "text.secondary" }}>
          Profil introuvable
        </Typography>
      </Box>,
    );
  }

  return wrap(
    <>
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
          isOwnProfile={isOwnProfile}
          socials={{
            twitter: profile?.twitterHandle,
            tiktok: profile?.tiktokHandle,
          }}
          discordRoles={
            showDiscordRoles && Array.isArray(user?.roles)
              ? user.roles.map((name, i) => ({ id: String(i), name, color: "" }))
              : undefined
          }
          userId={userId ?? undefined}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Contenu principal */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <UserProfileStatsCard stats={stats} />
            {userId && <ProfileDecksSection userId={userId} isOwnProfile={isOwnProfile} />}
            {profile?.deckBoxImage && <DeckBoxPhotoCard imageUrl={profile.deckBoxImage} />}
            <MatchHistory userId={stats.userId} />
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              ...(withContainer ? {} : { position: { md: "sticky" }, top: { md: 24 } }),
            }}
          >
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
    </>,
  );
}
