'use client';

import {
  AccountCircle,
  AcUnit,
  LocalFireDepartment,
} from '@mui/icons-material';
import {
  Avatar,
  alpha,
  Box,
  Container,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useThemeMode } from '@/components/theme/ThemeRegistry';
import { RpbLogo } from '@/components/ui/RpbLogo';
import { useSession } from '@/lib/auth-client';

export function MarketingHeader() {
  const { data: session } = useSession();
  const { mode, toggleTheme } = useThemeMode();

  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'flex', md: 'none' },
        height: 64,
        alignItems: 'center',
        bgcolor: (t) => alpha(t.palette.background.default, 0.7),
        borderBottom: '1px solid',
        borderColor: (t) => alpha(t.palette.secondary.main, 0.2),
        position: 'fixed',
        left: { xs: 0, md: 'auto' },
        right: 0,
        top: 0,
        width: { xs: '100%', md: 'auto' },
        zIndex: 1100,
        backdropFilter: 'blur(12px)',
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RpbLogo size={28} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: '900',

                background: (t) =>
                  `linear-gradient(135deg, ${t.palette.secondary.main} 0%, ${t.palette.primary.main} 100%)`,

                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
                fontSize: '1.1rem',
              }}
            >
              RPB
            </Typography>
          </Link>

          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
            }}
          >
            <Tooltip
              title={
                mode === 'red' ? 'Passer en Mode Bleu' : 'Passer en Mode Rouge'
              }
            >
              <IconButton
                onClick={toggleTheme}
                aria-label="Changer de thème"
                sx={{
                  p: 0.5,
                  color: 'secondary.main',
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
                  },
                }}
              >
                {mode === 'red' ? (
                  <LocalFireDepartment sx={{ fontSize: 22 }} />
                ) : (
                  <AcUnit sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </Tooltip>

            {session?.user && (
              <IconButton
                component={Link}
                href="/dashboard"
                aria-label="Mon compte"
                sx={{
                  p: 0.5,
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.secondary.main, 0.3),
                  color: 'secondary.main',
                  bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.secondary.main, 0.2),
                    borderColor: 'secondary.main',
                  },
                }}
              >
                {session.user.image ? (
                  <Avatar
                    src={session.user.image}
                    alt={session.user.name || 'Avatar'}
                    sx={{
                      width: 28,
                      height: 28,
                      border: '1px solid',
                      borderColor: 'secondary.main',
                    }}
                  />
                ) : (
                  <AccountCircle sx={{ fontSize: 24 }} />
                )}
              </IconButton>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
