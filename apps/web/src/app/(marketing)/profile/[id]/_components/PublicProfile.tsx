'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import useSWR from 'swr';
import {
  BladerProfileHeader,
  FavoritePartsCard,
  MatchHistory,
  ProfileDecksSection,
  RivalriesCard,
  UserProfileStatsCard,
} from '@/components/profile';
import { type UserStats } from '@/lib/stats-types';

interface PublicProfileProps {
  id: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublicProfile({ id }: PublicProfileProps) {
  const { data: statsData, isLoading: statsLoading } = useSWR<{
    data: UserStats;
  }>(id ? `/api/stats?userId=${id}` : null, fetcher);

  const { data: userData, isLoading: userLoading } = useSWR(
    id ? `/api/users/${id}` : null,
    fetcher,
  );

  const stats = statsData?.data;
  const user = userData?.data;

  const handleDownloadCard = async () => {
    const response = await fetch(`/api/users/${id}/card`);
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <BladerProfileHeader
          stats={stats}
          avatarUrl={user?.profile?.avatarUrl ?? user?.image}
          joinDate={user?.createdAt}
          bio={user?.profile?.bio}
          challongeUsername={stats.challongeUsername}
          onDownloadCard={handleDownloadCard}
          isOwnProfile={false}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Main content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <UserProfileStatsCard stats={stats} />
            <ProfileDecksSection userId={id} isOwnProfile={false} />
            <MatchHistory userId={id} />
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
