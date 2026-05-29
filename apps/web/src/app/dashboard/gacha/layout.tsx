"use client";

import { Casino, EmojiEvents, History, Inventory2, Person } from "@mui/icons-material";
import { Box, Tab, Tabs } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GACHA_TABS = [
  {
    label: "Profil",
    href: "/dashboard/gacha",
    icon: <Person fontSize="small" />,
  },
  {
    label: "Inventaire",
    href: "/dashboard/gacha/inventory",
    icon: <Inventory2 fontSize="small" />,
  },
  {
    label: "Classement",
    href: "/dashboard/gacha/leaderboard",
    icon: <EmojiEvents fontSize="small" />,
  },
  {
    label: "Historique",
    href: "/dashboard/gacha/history",
    icon: <History fontSize="small" />,
  },
] as const;

export default function GachaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine active tab by exact match first, then prefix
  const activeTab =
    GACHA_TABS.find((t) => t.href === pathname)?.href ??
    GACHA_TABS.slice(1)
      .reverse()
      .find((t) => pathname.startsWith(t.href))?.href ??
    "/dashboard/gacha";

  return (
    <Box>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          mb: 3,
          bgcolor: "background.paper",
          borderRadius: "12px 12px 0 0",
          px: 1,
        }}
      >
        <Tabs
          value={activeTab}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Navigation gacha"
          sx={{
            "& .MuiTab-root": {
              fontWeight: 600,
              minHeight: 56,
              gap: 0.5,
            },
          }}
        >
          {GACHA_TABS.map((tab) => (
            <Tab
              key={tab.href}
              label={tab.label}
              value={tab.href}
              icon={tab.icon}
              iconPosition="start"
              component={Link}
              href={tab.href}
            />
          ))}
        </Tabs>
      </Box>
      {children}
    </Box>
  );
}
