'use client';

import { EmojiEvents, Home, Leaderboard, Person } from '@mui/icons-material';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
  Slide,
  useScrollTrigger,
} from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { useSession } from '@/lib/auth-client';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const trigger = useScrollTrigger();

  const [value, setValue] = React.useState(pathname);

  React.useEffect(() => {
    setValue(pathname);
  }, [pathname]);

  return (
    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Slide appear={false} direction="up" in={!trigger}>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            pb: 'env(safe-area-inset-bottom)', // Support for notch phones
            borderTop: 1,
            borderColor: 'divider',
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          }}
          elevation={0}
        >
          <BottomNavigation
            showLabels
            value={value}
            onChange={(_, newValue) => {
              setValue(newValue);
              router.push(newValue);
            }}
            sx={{ height: 64 }}
          >
            <BottomNavigationAction label="Accueil" value="/" icon={<Home />} />
            <BottomNavigationAction
              label="Tournois"
              value="/tournaments"
              icon={<EmojiEvents />}
            />
            <BottomNavigationAction
              label="Classements"
              value="/rankings"
              icon={<Leaderboard />}
            />
            <BottomNavigationAction
              label={session ? 'Profil' : 'Connexion'}
              value={session ? '/dashboard' : '/sign-in'}
              icon={<Person />}
            />
          </BottomNavigation>
        </Paper>
      </Slide>
      {/* Spacer to prevent content from being hidden behind nav */}
      <Box sx={{ height: 80 }} />
    </Box>
  );
}
