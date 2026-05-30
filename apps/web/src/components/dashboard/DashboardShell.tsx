"use client";

import {
  AdminPanelSettings,
  ArrowBack,
  Build,
  Casino,
  Groups,
  Launch,
  Logout,
  MoreHoriz,
  Person,
  Settings,
  Style,
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
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CacheBuster } from "@/components/system/CacheBuster";
import { PageTransition } from "@/components/ui/PageTransition";
import { RpbLogo } from "@/components/ui/RpbLogo";
import { signOut, useSession } from "@/lib/auth-client";

const RAIL_WIDTH = 280;

interface NavItem {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Profil",
    icon: Person,
    path: "/dashboard/profile",
  },
  {
    label: "Mes Decks",
    icon: Build,
    path: "/builder",
  },
  {
    label: "Mon équipe",
    icon: Groups,
    path: "/dashboard/team",
  },
  {
    label: "Gacha",
    icon: Style,
    path: "/dashboard/gacha",
  },
  {
    label: "Aléatoire",
    icon: Casino,
    path: "/dashboard/random",
  },
  {
    label: "Paramètres",
    icon: Settings,
    path: "/dashboard/settings",
  },
];

const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Administration",
    icon: AdminPanelSettings,
    path: "/admin",
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "superadmin";

  // Determine active item
  const activeNavItem = [...NAV_ITEMS, ...ADMIN_ITEMS].find((item) =>
    pathname.startsWith(item.path),
  );

  // Bottom Nav Logic
  const isPrimaryTab = NAV_ITEMS.some((item) => item.path === activeNavItem?.path);
  const bottomNavValue = isPrimaryTab ? activeNavItem?.path : mobileOpen ? "menu" : false;

  const showBackButton = pathname !== "/dashboard/profile";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBottomNavChange = (_: any, newValue: string) => {
    if (newValue === "menu") {
      setMobileOpen(true);
    } else {
      setMobileOpen(false);
      router.push(newValue);
    }
  };

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSignOut = async () => {
    handleCloseUserMenu();
    await signOut();
    router.push("/");
  };

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
          <Typography
            variant="h6"
            sx={{
              fontWeight: "800",
              letterSpacing: "-0.02em",
            }}
          >
            RPB Dashboard
          </Typography>
        </Link>
      </Box>

      {session?.user && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
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
                  color: "text.secondary",
                  display: "block",
                }}
              >
                {isAdmin ? "Administrateur" : "Blader"}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: "auto", py: 2 }}>
        <List
          disablePadding
          subheader={
            <Typography
              variant="caption"
              sx={{
                fontWeight: "bold",
                color: "text.secondary",
                px: 3,
                mb: 1,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Menu Principal
            </Typography>
          }
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.path);
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
                    minHeight: 56,
                    borderRadius: 0,
                    gap: 1.5,
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                    color: isActive ? "primary.main" : "text.primary",
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                    "&.Mui-selected": {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.16),
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: "auto",
                      color: isActive ? "primary.main" : "text.secondary",
                    }}
                  >
                    <Icon sx={{ fontSize: 24 }} />
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

        {isAdmin && (
          <List
            disablePadding
            sx={{ mt: 2 }}
            subheader={
              <Typography
                variant="caption"
                sx={{
                  fontWeight: "bold",
                  color: "text.secondary",
                  px: 3,
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Administration
              </Typography>
            }
          >
            {ADMIN_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.path);
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
                      minHeight: 56,
                      borderRadius: 0,
                      gap: 1.5,
                      color: "primary.main",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: "auto",
                        color: "primary.main",
                      }}
                    >
                      <Icon sx={{ fontSize: 24 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: "0.9rem",
                            fontWeight: 700,
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <ListItemButton
          onClick={handleSignOut}
          sx={{
            borderRadius: 2,
            color: "error.main",
            py: 1.5,
            px: 2,
            "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.05) },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "error.main" }}>
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
              borderRight: "1px dashed",
              borderColor: "divider",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>
      {/* Mobile Menu Drawer */}
      <Drawer
        variant="temporary"
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: "80%",
            maxWidth: 300,
            bgcolor: "background.paper",
          },
        }}
      >
        {drawerContent}
      </Drawer>
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${RAIL_WIDTH}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          pb: { xs: "calc(64px + env(safe-area-inset-bottom))", md: 0 },
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "background.default",
            borderBottom: "none",
            color: "text.primary",
          }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                gap: 1,
                mr: 2,
              }}
            >
              <RpbLogo size={28} animated />
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexGrow: 1,
              }}
            >
              {showBackButton && (
                <IconButton
                  onClick={() => router.back()}
                  size="small"
                  edge="start"
                  sx={{
                    bgcolor: alpha(theme.palette.text.primary, 0.05),
                    "&:hover": {
                      bgcolor: alpha(theme.palette.text.primary, 0.1),
                    },
                  }}
                >
                  <ArrowBack fontSize="small" />
                </IconButton>
              )}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: "800",
                  color: "text.primary",
                  fontSize: { xs: "1.1rem", md: "1.25rem" },
                  lineHeight: 1.2,
                }}
              >
                {activeNavItem?.label || "Dashboard"}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
              }}
            >
              <Button
                component={Link}
                href="/"
                variant="outlined"
                size="small"
                startIcon={<Launch fontSize="small" />}
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  fontWeight: 600,
                  borderRadius: 2,
                }}
              >
                Site
              </Button>

              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0.5 }}>
                <Avatar
                  src={session?.user?.image || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    border: "2px solid",
                    borderColor: "background.paper",
                  }}
                />
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

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
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            pb: "env(safe-area-inset-bottom)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <BottomNavigation
            showLabels
            value={bottomNavValue}
            onChange={handleBottomNavChange}
            sx={{
              bgcolor: "transparent",
              height: 64,
              "& .MuiBottomNavigationAction-root": {
                minWidth: "auto",
                padding: "6px 0",
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                },
              },
            }}
          >
            {NAV_ITEMS.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <BottomNavigationAction
                  key={item.path}
                  label={item.label}
                  value={item.path}
                  icon={<Icon />}
                />
              );
            })}

            <BottomNavigationAction label="Menu" value="menu" icon={<MoreHoriz />} />
          </BottomNavigation>
        </Box>
      )}
      <Menu
        sx={{ mt: "45px" }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        keepMounted
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <Typography>Déconnexion</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
