"use client";

import {
  Article,
  CompareArrows,
  Dashboard,
  Diversity3,
  Groups,
  Home,
  Hub,
  Insights,
  Launch,
  Leaderboard,
  Link as LinkIcon,
  LiveTv,
  Logout,
  Menu as MenuIcon,
  People,
  Poll,
  Settings,
  Terminal,
  Theaters,
  Videocam,
  Whatshot,
  WorkspacePremium,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  alpha,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CacheBuster } from "@/components/system/CacheBuster";
import { TrophyIcon } from "@/components/ui/Icons";
import { PageTransition } from "@/components/ui/PageTransition";
import { RpbLogo } from "@/components/ui/RpbLogo";
import { signOut, useSession } from "@/lib/auth-client";

const RAIL_WIDTH = 280;

const ADMIN_NAV_ITEMS = [
  { label: "Vue d'ensemble", path: "/admin", icon: Dashboard },
  { label: "Analytics", path: "/admin/analytics", icon: Insights },
  { label: "Console & Logs", path: "/admin/logs", icon: Terminal },
  { label: "Maintenance", path: "/admin/maintenance", icon: Hub },
  { label: "Liaison Comptes", path: "/admin/link", icon: LinkIcon },
  { label: "Meta", path: "/admin/meta", icon: Hub },
  { label: "Contenu", path: "/admin/content", icon: Article },
  { label: "Sondages & Tier Lists", path: "/admin/sondages", icon: Poll },
  { label: "Gestion SATR", path: "/admin/satr", icon: WorkspacePremium },
  { label: "Gestion WB", path: "/admin/wb", icon: WorkspacePremium },
  { label: "Gestion Stardust", path: "/admin/stardust", icon: WorkspacePremium },
  { label: "Stream", path: "/admin/stream", icon: Videocam },
  { label: "Anime", path: "/admin/anime", icon: Theaters },
  { label: "Tournois", path: "/admin/tournaments", icon: TrophyIcon },
  { label: "Classements", path: "/admin/rankings", icon: Leaderboard },
  { label: "Membres", path: "/admin/membres", icon: Groups },
  { label: "Équipe", path: "/admin/staff", icon: People },
  { label: "Utilisateurs", path: "/admin/users", icon: People },
  { label: "Configuration", path: "/admin/config", icon: Settings },
];

// Accès rapide aux pages publiques du site (preview front depuis la console admin).
const SITE_LINKS = [
  { label: "Accueil", path: "/", icon: Home },
  { label: "Tournois", path: "/tournaments", icon: TrophyIcon },
  { label: "Classements", path: "/rankings", icon: Leaderboard },
  { label: "Équipes", path: "/equipes", icon: Diversity3 },
  { label: "Sondages", path: "/sondages", icon: Poll },
  { label: "Anime", path: "/anime", icon: Theaters },
  { label: "Meta", path: "/meta", icon: Whatshot },
  { label: "TV", path: "/tv", icon: LiveTv },
  { label: "Comparateur", path: "/comparateur", icon: CompareArrows },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      {/* Header Sidebar */}
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <RpbLogo size={32} animated />
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: "800",
                letterSpacing: "-0.02em",
              }}
            >
              RPB Admin
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              v1.0.0
            </Typography>
          </Box>
        </Link>
      </Box>

      {/* User Info */}
      {session?.user && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: "var(--md-sys-color-surface-variant)",
              border: "1px solid",
              borderColor: "var(--md-sys-color-outline-variant)",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Avatar
              alt={session.user.name || "User"}
              src={session.user.image || undefined}
              sx={{ width: 40, height: 40, borderRadius: 2 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: "bold",
                }}
              >
                {session.user.name}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: "block",
                  opacity: 0.7,
                }}
              >
                Super Admin
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 2 }}>
        <List disablePadding>
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive =
              item.path === "/admin" ? pathname === "/admin" : pathname.startsWith(item.path);

            const Icon = item.icon;

            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  selected={isActive}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    mx: 1.5,
                    mb: 0.5,
                    px: 3,
                    py: 1.5,
                    minHeight: 48,
                    borderRadius: 0,
                    gap: 1.5,
                    color: isActive ? "secondary.main" : "var(--md-sys-color-on-surface-variant)",
                    bgcolor: isActive
                      ? (theme) => alpha(theme.palette.secondary.main, 0.1)
                      : "transparent",
                    "&:hover": {
                      bgcolor: "var(--md-sys-color-surface-variant)",
                      color: "var(--md-sys-color-on-surface)",
                    },
                    "&.Mui-selected": {
                      bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.15),
                      "&:hover": {
                        bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.2),
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: "auto",
                      color: "inherit",
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: "0.9rem",
                          fontWeight: isActive ? 700 : 500,
                        },
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Accès rapide au site public */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: "bold",
            color: "text.secondary",
            px: 3,
            mt: 2,
            mb: 1,
            display: "block",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Site public
        </Typography>
        <List disablePadding>
          {SITE_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    mx: 1.5,
                    mb: 0.5,
                    px: 3,
                    py: 1.25,
                    minHeight: 44,
                    borderRadius: 0,
                    gap: 1.5,
                    color: "var(--md-sys-color-on-surface-variant)",
                    "&:hover": {
                      bgcolor: "var(--md-sys-color-surface-variant)",
                      color: "var(--md-sys-color-on-surface)",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: "auto", color: "inherit" }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: { sx: { fontSize: "0.85rem", fontWeight: 500 } },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Logout */}
      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "var(--md-sys-color-outline-variant)",
        }}
      >
        <ListItemButton
          onClick={handleSignOut}
          sx={{
            borderRadius: 2,
            color: "error.main",
            py: 1.5,
            px: 2,
            "&:hover": {
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Déconnexion"
            slotProps={{
              primary: { sx: { fontWeight: 600 } },
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      <CacheBuster />
      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { md: RAIL_WIDTH },
          flexShrink: { md: 0 },
          display: { xs: "none", md: "block" },
        }}
      >
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: RAIL_WIDTH,
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: RAIL_WIDTH,
            bgcolor: "background.paper",
          },
        }}
      >
        {drawerContent}
      </Drawer>
      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0, // Reset padding here, handled inside
          width: { md: `calc(100% - ${RAIL_WIDTH}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            color: "text.primary",
          }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 3 } }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              variant="h6"
              sx={{
                fontWeight: "800",
                color: "text.primary",
                flexGrow: 1,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              Administration
            </Typography>

            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: "center",
              }}
            >
              <Button
                component={Link}
                href="/dashboard"
                variant="outlined"
                size="small"
                startIcon={<Launch fontSize="small" />}
                sx={{
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: "none",
                }}
              >
                Dashboard Public
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box
          sx={{
            p: { xs: 2, md: 4 },
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
          }}
        >
          <PageTransition>{children}</PageTransition>
        </Box>
      </Box>
    </Box>
  );
}
