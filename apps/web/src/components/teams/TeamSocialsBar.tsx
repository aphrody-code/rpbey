"use client";

import InstagramIcon from "@mui/icons-material/Instagram";
import LanguageIcon from "@mui/icons-material/Language";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { IconButton, Stack, Tooltip } from "@mui/material";
import type { TeamSocials } from "@rpbey/api-contract";
import { MuiDiscordIcon, MuiTwitchIcon, MuiXIcon } from "@/components/ui/MuiIcons";

/** Normalise un handle (avec ou sans @ / URL) vers une URL absolue. */
function buildUrl(base: string, handle?: string | null): string | null {
  if (!handle) return null;
  const v = handle.trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `${base}${v.replace(/^@/, "")}`;
}

/** Barre de liens sociaux d'une équipe (page publique). */
export function TeamSocialsBar({ socials }: { socials: TeamSocials }) {
  const links: { label: string; href: string; icon: React.ReactNode }[] = [];

  const twitter = buildUrl("https://x.com/", socials.twitterHandle);
  if (twitter) links.push({ label: "X / Twitter", href: twitter, icon: <MuiXIcon /> });

  const instagram = buildUrl("https://instagram.com/", socials.instagramHandle);
  if (instagram) links.push({ label: "Instagram", href: instagram, icon: <InstagramIcon /> });

  const youtube = buildUrl("https://youtube.com/", socials.youtubeHandle);
  if (youtube) links.push({ label: "YouTube", href: youtube, icon: <YouTubeIcon /> });

  const twitch = buildUrl("https://twitch.tv/", socials.twitchHandle);
  if (twitch) links.push({ label: "Twitch", href: twitch, icon: <MuiTwitchIcon /> });

  if (socials.discordInvite) {
    const dc = socials.discordInvite.startsWith("http")
      ? socials.discordInvite
      : `https://discord.gg/${socials.discordInvite.replace(/^.*discord\.gg\//, "")}`;
    links.push({ label: "Discord", href: dc, icon: <MuiDiscordIcon /> });
  }

  if (socials.websiteUrl) {
    links.push({ label: "Site web", href: socials.websiteUrl, icon: <LanguageIcon /> });
  }

  if (links.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
      {links.map((l) => (
        <Tooltip title={l.label} key={l.label}>
          <IconButton
            component="a"
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{
              color: "text.secondary",
              "&:hover": { color: "primary.main" },
            }}
          >
            {l.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
