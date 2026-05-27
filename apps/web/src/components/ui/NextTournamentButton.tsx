'use client';

import { EmojiEvents } from '@mui/icons-material';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Tournament {
  id: string;
  name: string;
  date: string;
  status: string;
}

export function NextTournamentButton() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNextTournament() {
      try {
        const res = await fetch('/api/tournaments');
        if (!res.ok) throw new Error('Failed to fetch');

        const tournaments: Tournament[] = await res.json();

        // Find the next upcoming tournament (status UPCOMING and date in future)
        const now = new Date();
        const upcoming = tournaments
          .filter((t) => t.status === 'UPCOMING' && new Date(t.date) > now)
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );

        setTournament(upcoming[0] ?? null);
      } catch (error) {
        console.error('Error fetching tournament:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchNextTournament();
  }, []);

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width={250}
        height={48}
        sx={{ borderRadius: 3 }}
      />
    );
  }

  const href = tournament ? `/tournaments/${tournament.id}` : '/tournaments';
  const label = tournament
    ? `S'inscrire : ${tournament.name}`
    : 'Voir les tournois';

  return (
    <Button
      component={Link}
      href={href}
      variant="contained"
      size="large"
      startIcon={<EmojiEvents />}
      sx={{
        px: 4,
        py: 1.5,
        borderRadius: 3,
        fontSize: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {label}
    </Button>
  );
}
