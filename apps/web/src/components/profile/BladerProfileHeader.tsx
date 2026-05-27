'use client';

import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MusicNoteIcon from '@mui/icons-material/MusicNote'; // For TikTok substitute
import ShareIcon from '@mui/icons-material/Share';
import SyncIcon from '@mui/icons-material/Sync';
import TwitterIcon from '@mui/icons-material/Twitter';
import {
  Avatar,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { type UserStats } from '@/lib/stats-types';

interface BladerProfileHeaderProps {
  stats: UserStats;
  avatarUrl?: string;
  joinDate?: string;
  bio?: string;
  challongeUsername?: string | null;
  onDownloadCard?: () => void;
  isOwnProfile?: boolean;
  socials?: {
    twitter?: string | null;
    tiktok?: string | null;
  };
  discordRoles?: { id: string; name: string; color: string }[];
  userId?: string; // Needed for sync
}

function getRankColor(rank: number): string {
  if (rank === 1) return '#FFD700'; // Gold
  if (rank === 2) return '#C0C0C0'; // Silver
  if (rank === 3) return '#CD7F32'; // Bronze
  return '#666';
}

function getRankTitle(points: number): string {
  if (points >= 20000) return 'Légende';
  if (points >= 10000) return 'Champion';
  if (points >= 5000) return 'Élite';
  if (points >= 2500) return 'Expert';
  if (points >= 1000) return 'Confirmé';
  if (points >= 500) return 'Intermédiaire';
  return 'Débutant';
}

export function BladerProfileHeader({
  stats,
  avatarUrl,
  joinDate,
  bio,
  challongeUsername,
  onDownloadCard,
  isOwnProfile = false,
  socials,
  discordRoles,
  userId,
}: BladerProfileHeaderProps) {
  const theme = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Profil de ${stats.bladerName} | RPB`,
          text: `Découvrez les stats de ${stats.bladerName} sur la République Populaire du Beyblade !`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Lien copié dans le presse-papier !');
    }
  };

  const handleSyncRoles = async () => {
    if (!userId || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/users/${userId}/sync`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to sync roles:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        overflow: 'visible',
        position: 'relative',
        background: `linear-gradient(135deg, ${alpha(
          theme.palette.background.paper,
          0.9,
        )} 0%, ${alpha(theme.palette.background.default, 0.8)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-start' },
            gap: { xs: 3, md: 5 },
          }}
        >
          {/* Avatar Section */}
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={avatarUrl}
              sx={{
                width: { xs: 120, md: 160 },
                height: { xs: 120, md: 160 },
                border: '4px solid',
                borderColor: 'background.paper',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
            />
            {stats.rank <= 3 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -10,
                  right: -10,
                  bgcolor: getRankColor(stats.rank),
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 3,
                  border: '3px solid white',
                }}
              >
                <EmojiEventsIcon sx={{ color: 'white' }} />
              </Box>
            )}
          </Box>

          {/* Info Section */}
          <Box sx={{ flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
                justifyContent: { xs: 'center', md: 'flex-start' },
                mb: 0.5,
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: '900',
                  letterSpacing: '-0.03em',
                }}
              >
                {stats.bladerName}
              </Typography>
              {isOwnProfile && (
                <IconButton
                  component={Link}
                  href="/dashboard/profile/edit"
                  size="small"
                  sx={{ bgcolor: 'action.hover' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            {/* Handle Challonge Display */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 'bold',
                color: 'primary.main',
                mb: 2,
                display: 'block',
                opacity: 0.9,
              }}
            >
              @
              {challongeUsername ||
                stats.bladerName?.toLowerCase().replace(/\s/g, '') ||
                'blader'}
            </Typography>

            {/* Badges/Roles */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', md: 'flex-start' },
                mb: 3,
                gap: 1,
              }}
            >
              {Array.isArray(discordRoles) &&
                discordRoles.map((role) => {
                  const roleColor = role.color || '#666';
                  return (
                    <Chip
                      key={role.id}
                      label={role.name}
                      size="small"
                      sx={{
                        bgcolor: alpha(roleColor, 0.1),
                        color: roleColor,
                        borderColor: alpha(roleColor, 0.2),
                        fontWeight: 'bold',
                        border: '1px solid',
                      }}
                    />
                  );
                })}
              {isOwnProfile && (
                <Tooltip title="Synchroniser les rôles Discord">
                  <Chip
                    icon={
                      isSyncing ? <CircularProgress size={16} /> : <SyncIcon />
                    }
                    label="Sync"
                    onClick={handleSyncRoles}
                    size="small"
                    variant="outlined"
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: { xs: 'center', md: 'flex-start' },
                mb: 3,
              }}
            >
              <Chip
                label={getRankTitle(stats.points)}
                size="medium"
                color="secondary"
                variant="filled"
                sx={{ fontWeight: 'bold' }}
              />
              <Chip
                label={`${stats.points.toLocaleString()} PTS`}
                size="medium"
                variant="outlined"
                sx={{
                  fontWeight: 'bold',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              />
            </Stack>

            {bio ? (
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  maxWidth: 600,
                  lineHeight: 1.6,
                  borderLeft: '2px solid',
                  borderColor: 'primary.light',
                  pl: 2,
                  ml: { xs: 'auto', md: 0 },
                  mr: { xs: 'auto', md: 0 },
                  textAlign: 'left',
                }}
              >
                {bio}
              </Typography>
            ) : (
              <Typography
                variant="body1"
                sx={{
                  color: 'text.disabled',
                  fontStyle: 'italic',
                }}
              >
                Pas de bio renseignée.
              </Typography>
            )}

            {/* Social Links & Date */}
            <Box
              sx={{
                mt: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                justifyContent: { xs: 'center', md: 'flex-start' },
              }}
            >
              {socials?.twitter && (
                <Button
                  component="a"
                  href={`https://twitter.com/${socials.twitter}`}
                  target="_blank"
                  startIcon={<TwitterIcon />}
                  size="small"
                  sx={{ color: '#1DA1F2', borderColor: alpha('#1DA1F2', 0.3) }}
                  variant="outlined"
                >
                  @{socials.twitter}
                </Button>
              )}
              {socials?.tiktok && (
                <Button
                  component="a"
                  href={`https://tiktok.com/@${socials.tiktok}`}
                  target="_blank"
                  startIcon={<MusicNoteIcon />}
                  size="small"
                  sx={{ color: '#ff0050', borderColor: alpha('#ff0050', 0.3) }}
                  variant="outlined"
                >
                  @{socials.tiktok}
                </Button>
              )}
            </Box>

            {joinDate && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  mt: 2,
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                }}
              >
                MAÎTRE BLADER DEPUIS{' '}
                {new Date(joinDate).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Typography>
            )}
          </Box>

          {/* Actions Column */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'row', md: 'column' },
              gap: 1.5,
              justifyContent: 'center',
              minWidth: { md: 200 },
            }}
          >
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShare}
              fullWidth
              sx={{
                borderRadius: 4,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                },
              }}
            >
              Partager
            </Button>
            {onDownloadCard && (
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={onDownloadCard}
                fullWidth
                sx={{
                  borderRadius: 4,
                  textTransform: 'none',
                  fontWeight: 600,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  boxShadow: '0 4px 12px rgba(var(--rpb-primary-rgb), 0.3)',
                }}
              >
                Carte Blader
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
