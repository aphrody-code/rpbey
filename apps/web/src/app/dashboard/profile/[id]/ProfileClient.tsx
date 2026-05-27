/**
 * RPB - Profile Page
 * Full blader profile with stats, matches, and rivalries
 */

'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { use } from 'react';
import useSWR from 'swr';
import {
  BladerProfileHeader,
  FavoritePartsCard,
  MatchHistory,
  ProfileDecksSection,
  RivalriesCard,
  UserProfileStatsCard,
} from '@/components/profile';
import { useAuth } from '@/hooks';
import { type UserStats } from '@/lib/stats-types';

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params);
  const { user: currentUser } = useAuth();

  // If no ID, show current user's profile
  const userId = id === 'me' ? currentUser?.id : id;

  const { data: statsData, isLoading: statsLoading } = useSWR<{
    data: UserStats;
  }>(userId ? `/api/stats?userId=${userId}` : null, fetcher);

  const { data: userData, isLoading: userLoading } = useSWR(
    userId ? `/api/users/${userId}` : null,
    fetcher,
  );

  const stats = statsData?.data;
  const user = userData?.data;

  const handleDownloadCard = async () => {
    // Will trigger canvas generation endpoint
    const response = await fetch(`/api/users/${userId}/card`);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stats?.bladerName ?? 'profile'}-card.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (statsLoading || userLoading) {
    return (
      <Box>
        <Skeleton
          variant="rectangular"
          height={200}
          sx={{ borderRadius: 2, mb: 3 }}
        />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton
              variant="rectangular"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton
              variant="rectangular"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            color: 'text.secondary',
          }}
        >
          Profil introuvable
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <BladerProfileHeader
          stats={stats}
          avatarUrl={
            user?.serverAvatar ?? user?.profile?.avatarUrl ?? user?.image
          }
          joinDate={user?.createdAt}
          bio={user?.profile?.bio}
          challongeUsername={stats.challongeUsername}
          onDownloadCard={handleDownloadCard}
          isOwnProfile={currentUser?.id === userId}
          socials={{
            twitter: user?.profile?.twitterHandle,
            tiktok: user?.profile?.tiktokHandle,
          }}
          discordRoles={user?.roles}
          userId={userId ?? undefined}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Main content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <UserProfileStatsCard stats={stats} />
            {userId && (
              <ProfileDecksSection
                userId={userId}
                isOwnProfile={currentUser?.id === userId}
              />
            )}
            <MatchHistory userId={stats.userId} />
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              position: { md: 'sticky' },
              top: { md: 24 },
            }}
          >
            <RivalriesCard rivalries={stats.rivalries} />
            <FavoritePartsCard
              blades={stats.mostUsedBlades}
              ratchets={stats.mostUsedRatchets}
              bits={stats.mostUsedBits}
            />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
