'use client';

import {
  AccountCircle,
  AdminPanelSettings,
  Login,
  Logout,
  PersonAdd,
  Settings,
} from '@mui/icons-material';
import {
  alpha,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Clapperboard,
  Crown,
  Gamepad2,
  House,
  type LucideIcon,
  Swords,
  Trophy,
  Tv,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { signOut, useSession } from '@/lib/auth-client';
import { ICON_NAV_WIDTH } from './constants';

const navItems: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: House, label: 'Accueil', href: '/' },
  { icon: Trophy, label: 'Tournois', href: '/tournaments' },
  { icon: Crown, label: 'Classements', href: '/rankings' },
  { icon: Swords, label: 'Meta', href: '/meta' },
  { icon: Tv, label: 'TV', href: '/tv' },
  { icon: Clapperboard, label: 'Anime', href: '/anime' },
  { icon: Wrench, label: 'Builder', href: '/builder' },
  { icon: Gamepad2, label: 'App', href: '/app' },
];

export function IconNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await signOut();
  };

  return (
    <Box
      component="nav"
      aria-label="Navigation principale"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 1200,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        p: 1,
        pt: 'calc(12px + env(safe-area-inset-top))',
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
        backdropFilter: 'blur(24px)',
        boxShadow: (theme) =>
          `1px 0 0 ${alpha(theme.palette.divider, 0.5)}, 4px 0 24px rgba(0,0,0,0.2)`,
        borderRight: '1px solid',
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.1),
        width: ICON_NAV_WIDTH,
      }}
    >
      {/* Logo */}
      <Tooltip title="RPB — Accueil" placement="right">
        <Link
          href="/"
          aria-label="RPB — Retour à l'accueil"
          style={{ display: 'block', marginBottom: 8 }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'transform 0.2s ease',
              '&:hover': {
                transform: 'scale(1.1)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -6,
                left: '20%',
                right: '20%',
                height: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.4),
              },
            }}
          >
            <Image
              src="/logo.webp"
              alt="RPB Logo"
              width={48}
              height={48}
              style={{ objectFit: 'contain' }}
              priority
            />
          </Box>
        </Link>
      </Tooltip>

      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          mt: 1,
        }}
      >
        {/* Nav items */}
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Tooltip key={item.href} title={item.label} placement="right">
              <IconButton
                component={Link}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  width: '100%',
                  height: 48,
                  borderRadius: 0,
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    '& svg': {
                      transform: 'scale(1.12)',
                    },
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                }}
              >
                {/* Active indicator — left accent bar */}
                {isActive && (
                  <Box
                    component={motion.div}
                    layoutId="desktop-nav-active"
                    sx={{
                      position: 'absolute',
                      top: 6,
                      left: 0,
                      bottom: 6,
                      width: 3,
                      bgcolor: 'primary.main',
                      boxShadow: (theme) =>
                        `0 0 8px ${alpha(theme.palette.primary.main, 0.5)}`,
                    }}
                  />
                )}
                {/* Active background */}
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.1),
                      zIndex: -1,
                    }}
                  />
                )}
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    transition: 'all 0.15s ease',
                    filter: isActive
                      ? 'drop-shadow(0 0 4px rgba(var(--rpb-primary-rgb), 0.4))'
                      : 'none',
                    opacity: isActive ? 1 : 0.6,
                  }}
                />
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          width: '100%',
        }}
      >
        <ThemeSwitcher />

        {/* Auth Menu */}
        <Tooltip title="Compte" placement="right">
          <IconButton
            onClick={handleMenuOpen}
            aria-label="Menu compte"
            sx={{
              width: '100%',
              height: 48,
              borderRadius: 0,
              color: session?.user ? 'primary.main' : 'text.secondary',
              bgcolor: session?.user
                ? (theme) => alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <AccountCircle sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Account Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 200,
              overflow: 'visible',
              mt: 1.5,
              ml: 2,
              bgcolor: 'surface.high',
              boxShadow:
                '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {session?.user
          ? [
              <MenuItem
                key="profile"
                component={Link}
                href={`/dashboard/profile/${session.user.id}`}
                sx={{ m: 0.5 }}
              >
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Mon profil" />
              </MenuItem>,
              <MenuItem
                key="settings"
                component={Link}
                href="/profile"
                sx={{ m: 0.5 }}
              >
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Paramètres" />
              </MenuItem>,
              <Divider key="divider-profile" sx={{ my: 0.5 }} />,
              (session.user.role === 'admin' ||
                (session.user as { role: string }).role === 'superadmin') && (
                <MenuItem
                  key="admin"
                  component={Link}
                  href="/admin"
                  sx={{ m: 0.5 }}
                >
                  <ListItemIcon>
                    <AdminPanelSettings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Administration" />
                </MenuItem>
              ),
              (session.user.role === 'admin' ||
                (session.user as { role: string }).role === 'superadmin') && (
                <Divider key="divider-admin" sx={{ my: 0.5 }} />
              ),
              <MenuItem
                key="logout"
                onClick={handleLogout}
                sx={{ m: 0.5, color: 'error.main' }}
              >
                <ListItemIcon>
                  <Logout fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primary="Déconnexion" />
              </MenuItem>,
            ].filter(Boolean)
          : [
              <MenuItem
                key="login"
                component={Link}
                href="/sign-in"
                sx={{ m: 0.5 }}
              >
                <ListItemIcon>
                  <Login fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Se connecter" />
              </MenuItem>,
              <MenuItem
                key="register"
                component={Link}
                href="/sign-up"
                sx={{ m: 0.5 }}
              >
                <ListItemIcon>
                  <PersonAdd fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="S'inscrire" />
              </MenuItem>,
            ]}
      </Menu>
    </Box>
  );
}

// Mobile bottom navigation — docked to bottom like a real mobile app
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const getActiveValue = () => {
    if (pathname === '/') return '/';
    if (pathname.startsWith('/tournaments')) return '/tournaments';
    if (pathname.startsWith('/rankings')) return '/rankings';
    if (pathname.startsWith('/anime')) return '/anime';
    if (pathname.startsWith('/tv')) return '/tv';
    if (pathname.startsWith('/meta')) return '/meta';
    if (pathname.startsWith('/admin')) return '/admin';
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up')
    ) {
      return '/account';
    }
    return '/';
  };

  const activeValue = getActiveValue();

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        display: { xs: 'block', md: 'none' },
        borderRadius: 0,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid',
        borderColor: (theme) => alpha(theme.palette.divider, 0.3),
        boxShadow: '0 -2px 20px rgba(0,0,0,0.3)',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        showLabels
        value={activeValue}
        onChange={(_, newValue) => {
          if (newValue === '/account') {
            if (session?.user) {
              router.push(`/dashboard/profile/${session.user.id}`);
            } else {
              router.push('/sign-in');
            }
          } else {
            router.push(newValue);
          }
        }}
        sx={{
          height: 56,
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            maxWidth: 'none',
            px: 0,
            py: 0.5,
            gap: 0,
            color: 'text.secondary',
            position: 'relative',
            transition: 'color 0.15s ease',
            '&.Mui-selected': {
              color: 'primary.main',
              '& .MuiSvgIcon-root': {
                zIndex: 2,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 2,
                height: '100%',
                bgcolor: 'transparent',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '15%',
                right: '15%',
                height: 2,
                bgcolor: 'primary.main',
                boxShadow: (theme) =>
                  `0 0 6px ${alpha(theme.palette.primary.main, 0.5)}`,
              },
            },
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
            '& .MuiBottomNavigationAction-label': {
              mt: 0.25,
              fontWeight: 600,
              fontSize: '0.6rem',
              letterSpacing: '0.01em',
              '&.Mui-selected': {
                fontSize: '0.6rem',
                fontWeight: 700,
              },
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Accueil"
          value="/"
          icon={
            <House size={22} strokeWidth={activeValue === '/' ? 2.5 : 1.8} />
          }
        />
        <BottomNavigationAction
          label="Tournois"
          value="/tournaments"
          icon={
            <Trophy
              size={22}
              strokeWidth={activeValue === '/tournaments' ? 2.5 : 1.8}
            />
          }
        />
        <BottomNavigationAction
          label="Classements"
          value="/rankings"
          icon={
            <Crown
              size={22}
              strokeWidth={activeValue === '/rankings' ? 2.5 : 1.8}
            />
          }
        />
        <BottomNavigationAction
          label="Meta"
          value="/meta"
          icon={
            <Swords
              size={22}
              strokeWidth={activeValue === '/meta' ? 2.5 : 1.8}
            />
          }
        />
        <BottomNavigationAction
          label="Anime"
          value="/anime"
          icon={
            <Clapperboard
              size={22}
              strokeWidth={activeValue === '/anime' ? 2.5 : 1.8}
            />
          }
        />
        <BottomNavigationAction
          label={session?.user ? 'Profil' : 'Connexion'}
          value="/account"
          icon={<AccountCircle />}
        />
      </BottomNavigation>
    </Paper>
  );
}
