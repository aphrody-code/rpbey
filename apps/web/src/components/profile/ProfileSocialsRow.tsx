"use client";

import ChatIcon from "@mui/icons-material/Chat";
import InstagramIcon from "@mui/icons-material/Instagram";
import LanguageIcon from "@mui/icons-material/Language";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TwitterIcon from "@mui/icons-material/Twitter";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { alpha, Box, Stack, Tooltip, Typography } from "@mui/material";
import { type ReactNode } from "react";

interface ProfileSocials {
  twitterHandle?: string | null;
  tiktokHandle?: string | null;
  instagramHandle?: string | null;
  youtubeHandle?: string | null;
  twitchHandle?: string | null;
  discordHandle?: string | null;
  websiteUrl?: string | null;
}

interface ProfileSocialsRowProps {
  socials: ProfileSocials;
}

interface SocialEntry {
  key: string;
  label: string;
  icon: ReactNode;
  href: string | null;
  color: string;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, "");
}

function ensureProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Rangée de liens vers les réseaux sociaux d'un joueur. N'affiche que les réseaux
 * renseignés ; Discord n'est pas cliquable (juste affiché). Vide → rend `null`.
 */
export function ProfileSocialsRow({ socials }: ProfileSocialsRowProps) {
  const entries: SocialEntry[] = [];

  if (socials.twitterHandle) {
    const h = normalizeHandle(socials.twitterHandle);
    entries.push({
      key: "twitter",
      label: `@${h}`,
      icon: <TwitterIcon fontSize="small" />,
      href: `https://twitter.com/${h}`,
      color: "#1DA1F2",
    });
  }
  if (socials.instagramHandle) {
    const h = normalizeHandle(socials.instagramHandle);
    entries.push({
      key: "instagram",
      label: `@${h}`,
      icon: <InstagramIcon fontSize="small" />,
      href: `https://instagram.com/${h}`,
      color: "#E1306C",
    });
  }
  if (socials.tiktokHandle) {
    const h = normalizeHandle(socials.tiktokHandle);
    entries.push({
      key: "tiktok",
      label: `@${h}`,
      icon: <MusicNoteIcon fontSize="small" />,
      href: `https://tiktok.com/@${h}`,
      color: "#ff0050",
    });
  }
  if (socials.youtubeHandle) {
    const h = normalizeHandle(socials.youtubeHandle);
    entries.push({
      key: "youtube",
      label: h,
      icon: <YouTubeIcon fontSize="small" />,
      href: `https://youtube.com/@${h}`,
      color: "#FF0000",
    });
  }
  if (socials.twitchHandle) {
    const h = normalizeHandle(socials.twitchHandle);
    entries.push({
      key: "twitch",
      label: h,
      icon: <SportsEsportsIcon fontSize="small" />,
      href: `https://twitch.tv/${h}`,
      color: "#9146FF",
    });
  }
  if (socials.discordHandle) {
    entries.push({
      key: "discord",
      label: socials.discordHandle.trim(),
      icon: <ChatIcon fontSize="small" />,
      href: null,
      color: "#5865F2",
    });
  }
  if (socials.websiteUrl) {
    entries.push({
      key: "website",
      label: socials.websiteUrl.replace(/^https?:\/\//i, ""),
      icon: <LanguageIcon fontSize="small" />,
      href: ensureProtocol(socials.websiteUrl),
      color: "#888",
    });
  }

  if (entries.length === 0) return null;

  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
      {entries.map((entry) => {
        const content = (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(entry.color, 0.3),
              bgcolor: alpha(entry.color, 0.08),
              color: entry.color,
              fontWeight: 600,
              maxWidth: 220,
              cursor: entry.href ? "pointer" : "default",
              transition: "all 0.15s",
              "&:hover": entry.href ? { bgcolor: alpha(entry.color, 0.16) } : undefined,
            }}
          >
            {entry.icon}
            <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
              {entry.label}
            </Typography>
          </Box>
        );

        if (!entry.href) {
          return (
            <Tooltip key={entry.key} title="Discord">
              {content}
            </Tooltip>
          );
        }

        return (
          <Box
            key={entry.key}
            component="a"
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textDecoration: "none" }}
          >
            {content}
          </Box>
        );
      })}
    </Stack>
  );
}
