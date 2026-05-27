import Box from '@mui/material/Box';
import { type Metadata } from 'next';
import {
  IconFooter,
  IconNav,
  MarketingHeader,
  MobileNav,
} from '@/components/layout';
import { ICON_NAV_WIDTH } from '@/components/layout/constants';
import { DiscordFloatingCTA } from '@/components/ui/DiscordFloatingCTA';
import { SmoothScroll } from '@/components/ui/SmoothScroll';

export const metadata: Metadata = {
  title: {
    default: 'RPB - République Populaire du Beyblade',
    template: '%s | RPB',
  },
  description:
    'La communauté française de Beyblade. Tournois, classements et plus encore.',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SmoothScroll />
      {/* Desktop: Left icon navigation */}
      <IconNav />

      {/* Main content */}
      <Box
        component="main"
        className="bbx-dots"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          ml: { xs: 0, md: `${ICON_NAV_WIDTH}px` },
          pt: { xs: '64px', md: 0 },
          pb: { xs: 'calc(64px + env(safe-area-inset-bottom))', md: 0 },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <MarketingHeader />
        <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>{children}</Box>
        <IconFooter />
      </Box>

      {/* Mobile: Bottom navigation */}
      <MobileNav />

      {/* Discord join CTA */}
      <DiscordFloatingCTA />
    </Box>
  );
}
