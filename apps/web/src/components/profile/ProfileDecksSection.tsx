'use client';

import BuildIcon from '@mui/icons-material/Build';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import useSWR from 'swr';
import { DeckBoxDisplay } from '@/components/deck/DeckBoxDisplay';
import { type Deck, DeckCard } from '@/components/deck/DeckCard';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ProfileDecksSectionProps {
  isOwnProfile?: boolean;
  userId?: string;
}

export function ProfileDecksSection({
  isOwnProfile = false,
  userId,
}: ProfileDecksSectionProps) {
  const { data, isLoading } = useSWR<{ data: Deck[] }>(
    userId ? `/api/decks?userId=${userId}` : isOwnProfile ? '/api/decks' : null,
    fetcher,
  );

  const decks = data?.data;
  const activeDeck = decks?.find((d) => d.isActive);

  // If not own profile, we only show the active deck if it exists
  if (!isOwnProfile && !activeDeck) return null;

  if (isLoading) {
    return (
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}
      >
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {[0, 1, 2].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton
                  variant="rounded"
                  height={180}
                  sx={{ borderRadius: 3 }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: '800',
            }}
          >
            Mes Decks
          </Typography>
          <Link href="/builder" passHref style={{ textDecoration: 'none' }}>
            <Button
              size="small"
              startIcon={<BuildIcon />}
              variant="outlined"
              sx={{
                borderRadius: 2,
                fontWeight: 'bold',
                textTransform: 'none',
              }}
            >
              Deck Builder
            </Button>
          </Link>
        </Box>

        {!decks || decks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              gutterBottom
              sx={{
                color: 'text.secondary',
              }}
            >
              Aucun deck sauvegardé
            </Typography>
            <Link href="/builder" passHref style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                startIcon={<BuildIcon />}
                sx={{ mt: 1, borderRadius: 2, fontWeight: 'bold' }}
              >
                Créer mon premier deck
              </Button>
            </Link>
          </Box>
        ) : (
          <Box>
            {activeDeck && (
              <Box sx={{ mb: 4 }}>
                <DeckBoxDisplay deck={activeDeck} />
              </Box>
            )}

            {isOwnProfile && (
              <Grid container spacing={2}>
                {decks.map((deck) => (
                  <Grid key={deck.id} size={{ xs: 12, sm: 6 }}>
                    <DeckCard deck={deck} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
