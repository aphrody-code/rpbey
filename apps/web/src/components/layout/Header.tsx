'use client';

import { AcUnit, LocalFireDepartment } from '@mui/icons-material';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useThemeMode } from '@/components/theme/ThemeRegistry';
import { signOut, useSession } from '@/lib/auth-client';
import { LOGO_VARIANTS } from '@/lib/role-colors';

const pages = [
  { label: 'Tableau de bord', href: '/dashboard' },
  { label: 'Tournois', href: '/tournaments' },
  { label: 'Classements', href: '/rankings' },
];

export function Header() {
  const { data: session } = useSession();
  const { mode, toggleTheme } = useThemeMode();
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSignOut = async () => {
    await signOut();
    handleCloseUserMenu();
  };

  return (
    <AppBar position="sticky" color="default" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo - Desktop */}
          <Box
            component={Link}
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
            }}
          >
            <Image
              src={LOGO_VARIANTS[0].src}
              alt="RPB Logo"
              width={40}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </Box>

          {/* Mobile menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorElNav}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                <MenuItem
                  key={page.href}
                  component={Link}
                  href={page.href}
                  onClick={handleCloseNavMenu}
                >
                  {page.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Logo - Mobile */}
          <Box
            component={Link}
            href="/"
            sx={{
              flexGrow: 1,
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
            }}
          >
            <Image
              src={LOGO_VARIANTS[0].src}
              alt="RPB Logo"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
            />
          </Box>

          {/* Desktop menu */}
          <Box
            sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}
          >
            {pages.map((page) => (
              <Button
                key={page.href}
                component={Link}
                href={page.href}
                sx={{ color: 'text.primary' }}
              >
                {page.label}
              </Button>
            ))}
          </Box>

          {/* Theme switcher + User menu */}
          <Box
            sx={{
              flexGrow: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
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
                  color: mode === 'red' ? 'primary.main' : 'secondary.main',
                }}
              >
                {mode === 'red' ? (
                  <LocalFireDepartment sx={{ fontSize: 22 }} />
                ) : (
                  <AcUnit sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </Tooltip>

            {session?.user ? (
              <>
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar
                    alt={session.user.name || 'User'}
                    src={session.user.image || undefined}
                  />
                </IconButton>
                <Menu
                  anchorEl={anchorElUser}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {(session.user.role === 'admin' ||
                    session.user.role === 'superadmin') && (
                    <MenuItem
                      component={Link}
                      href="/admin"
                      onClick={handleCloseUserMenu}
                    >
                      Administration
                    </MenuItem>
                  )}
                  <MenuItem
                    component={Link}
                    href="/profile"
                    onClick={handleCloseUserMenu}
                  >
                    Profil
                  </MenuItem>
                  <MenuItem onClick={handleSignOut}>Déconnexion</MenuItem>
                </Menu>
              </>
            ) : null}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
