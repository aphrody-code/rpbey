'use client';

import { GitHub, X as XIcon } from '@mui/icons-material';
import { alpha, Box, IconButton, Tooltip, Typography } from '@mui/material';
import { DiscordIcon, TikTokIcon, TwitchIcon } from '@/components/ui/Icons';

export function IconFooter() {
  return (
    <Box
      component="footer"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        py: 3,
        px: 2,
        borderTop: 'none',
        bgcolor: 'background.default',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '1px',
          background: (theme) =>
            `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.3)} 30%, ${alpha(theme.palette.primary.main, 0.5)} 50%, ${alpha(theme.palette.primary.main, 0.3)} 70%, transparent)`,
        },
      }}
    >
      {/* Social icons */}
      <Tooltip title="Discord">
        <IconButton
          component="a"
          href="https://discord.gg/rpb"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: '#5865F2',
            },
          }}
        >
          <DiscordIcon size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="GitHub">
        <IconButton
          component="a"
          href="https://github.com/rpb-beyblade"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
            },
          }}
        >
          <GitHub sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Twitch">
        <IconButton
          component="a"
          href="https://www.twitch.tv/tv_rpb"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: '#9146FF',
            },
          }}
        >
          <TwitchIcon size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="TikTok">
        <IconButton
          component="a"
          href="https://www.tiktok.com/@rpbeyblade1"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
            },
          }}
        >
          <TikTokIcon size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="X (Twitter)">
        <IconButton
          component="a"
          href="https://x.com/rpb_ey"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
            },
          }}
        >
          <XIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      {/* Divider */}
      <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', mx: 1 }} />
      {/* Links */}
      <Typography
        component="a"
        href="/reglement"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Règlement
      </Typography>
      <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', mx: 1 }} />
      <Typography
        component="a"
        href="/privacy"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Confidentialité
      </Typography>
      <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', mx: 1 }} />
      {/* Copyright */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        © {new Date().getFullYear()} RPB
      </Typography>
    </Box>
  );
}
