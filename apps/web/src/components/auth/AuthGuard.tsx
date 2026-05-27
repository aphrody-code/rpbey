'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { ROUTES } from '@/lib/constants';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export function AuthGuard({
  children,
  fallback,
  redirectTo = ROUTES.SIGN_IN,
  requireAuth = true,
}: AuthGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && requireAuth && !session) {
      router.replace(redirectTo);
    }
  }, [session, isPending, requireAuth, redirectTo, router]);

  // Loading state
  if (isPending) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <CircularProgress size={40} />
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Chargement...
          </Typography>
        </Box>
      )
    );
  }

  // Not authenticated
  if (requireAuth && !session) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <CircularProgress size={40} />
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Redirection...
          </Typography>
        </Box>
      )
    );
  }

  return <>{children}</>;
}

// Inverse guard - redirect authenticated users away (e.g., from login page)
interface GuestGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function GuestGuard({
  children,
  fallback,
  redirectTo = ROUTES.ADMIN,
}: GuestGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.replace(redirectTo);
    }
  }, [session, isPending, redirectTo, router]);

  // Loading state
  if (isPending) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <CircularProgress size={40} />
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Chargement...
          </Typography>
        </Box>
      )
    );
  }

  // Authenticated - redirecting
  if (session) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <CircularProgress size={40} />
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Redirection...
          </Typography>
        </Box>
      )
    );
  }

  return <>{children}</>;
}

// Role-based guard
interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = ROUTES.ADMIN,
}: RoleGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const hasAccess = userRole && allowedRoles.includes(userRole);

  useEffect(() => {
    if (!isPending && session && !hasAccess) {
      router.replace(redirectTo);
    }
  }, [session, isPending, hasAccess, redirectTo, router]);

  // Loading state
  if (isPending) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <CircularProgress size={40} />
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Vérification des permissions...
          </Typography>
        </Box>
      )
    );
  }

  // No access
  if (!hasAccess) {
    return (
      fallback ?? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="error">
            Accès refusé
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            Vous n&apos;avez pas les permissions nécessaires pour accéder à
            cette page.
          </Typography>
        </Box>
      )
    );
  }

  return <>{children}</>;
}
