'use client';

import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import {
  alpha,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { DiscordIcon } from './Icons';

const DISCORD_INVITE = 'https://discord.gg/rpb';
const X_URL = 'https://x.com/rpb_ey';
const DISMISS_KEY = 'rpb-social-cta-dismissed';
const VIEW_COUNT_KEY = 'rpb-social-cta-views';

// Bird SVG for X/Twitter
function BirdIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
    </svg>
  );
}

type CTA = 'discord' | 'x';

const ctaConfigs = {
  discord: {
    color: '#5865F2',
    title: 'Rejoins la communauté RPB !',
    subtitle: 'Tournois, classements, trades et discussions meta.',
    buttonText: 'Rejoindre',
    href: DISCORD_INVITE,
    ariaLabel: 'Rejoindre le Discord RPB',
  },
  x: {
    color: '#000',
    title: 'Suis la RPB sur X !',
    subtitle: 'Actus, résultats de tournois, clips et annonces en temps réel.',
    buttonText: 'Suivre',
    href: X_URL,
    ariaLabel: 'Suivre RPB sur X',
  },
};

export function DiscordFloatingCTA() {
  const [visible, setVisible] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [activeCta, setActiveCta] = useState<CTA>('discord');

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 86400000) return;

    // Alternate between Discord and X every other page view
    const views = Number(localStorage.getItem(VIEW_COUNT_KEY) || '0') + 1;
    localStorage.setItem(VIEW_COUNT_KEY, String(views));
    setActiveCta(views % 3 === 0 ? 'x' : 'discord');

    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch('/api/discord/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.onlineCount) setMemberCount(data.onlineCount);
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!visible) return null;

  const config = ctaConfigs[activeCta];

  return (
    <Box
      role="complementary"
      aria-label={config.ariaLabel}
      sx={{
        position: 'fixed',
        bottom: { xs: 'calc(64px + env(safe-area-inset-bottom))', md: 24 },
        right: { xs: 12, md: 24 },
        left: { xs: 12, md: 'auto' },
        zIndex: 1050,
        maxWidth: { xs: 'none', md: 400 },
        animation: 'slideUp 0.4s ease-out',
        '@keyframes slideUp': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box
        sx={{
          bgcolor: config.color,
          color: 'white',
          p: { xs: 2, md: 2.5 },
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxShadow: `0 8px 32px ${alpha(config.color, 0.4)}, 0 2px 8px rgba(0,0,0,0.3)`,
          border: `1px solid ${alpha('#fff', 0.15)}`,
          position: 'relative',
        }}
      >
        <IconButton
          onClick={handleDismiss}
          aria-label="Fermer"
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: alpha('#fff', 0.6),
            '&:hover': { color: 'white' },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>

        <Box
          sx={{
            width: 44,
            height: 44,
            bgcolor: alpha('#fff', 0.15),
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {activeCta === 'discord' ? (
            <DiscordIcon size={26} />
          ) : (
            <BirdIcon size={26} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              lineHeight: 1.2,
            }}
          >
            {config.title}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '0.72rem', md: '0.78rem' },
              opacity: 0.85,
              mt: 0.25,
            }}
          >
            {config.subtitle}
            {activeCta === 'discord' && memberCount && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.3,
                  ml: 0.5,
                  fontWeight: 700,
                }}
              >
                <GroupIcon sx={{ fontSize: '0.75rem' }} />
                {memberCount} en ligne
              </Box>
            )}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Button
            component="a"
            href={config.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size="small"
            sx={{
              bgcolor: 'white',
              color: config.color,
              fontWeight: 800,
              fontSize: { xs: '0.75rem', md: '0.8rem' },
              px: { xs: 1.5, md: 2 },
              py: 0.8,
              whiteSpace: 'nowrap',
              '&:hover': {
                bgcolor: alpha('#fff', 0.9),
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {config.buttonText}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
