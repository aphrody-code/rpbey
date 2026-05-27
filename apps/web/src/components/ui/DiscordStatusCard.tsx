'use client';

import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { AnimatePresence, motion } from 'framer-motion';
import useSWR from 'swr';
import { type DiscordStats, type TeamGroup } from '@/lib/discord-types';
import { RoleColors, type RoleType } from '@/lib/role-colors';
import { api } from '@/lib/standard-api';
import { DiscordRoleBadge } from './DiscordRoleBadge';

const DISCORD_BLUE = '#5865F2';

interface DiscordStatusCardProps {
  initialStats?: DiscordStats | null;
  initialTeam?: TeamGroup[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (url: string) => api.get(url).then((res) => res as any);

const roleColor = (role: RoleType) => {
  const c = RoleColors[role];
  return 'hex' in c ? c.hex : c.primary;
};

export function DiscordStatusCard({
  initialStats,
  initialTeam,
}: DiscordStatusCardProps) {
  const theme = useTheme();

  const { data: stats, isLoading: statsLoading } = useSWR<DiscordStats>(
    '/api/discord/stats',
    fetcher,
    {
      fallbackData: initialStats || undefined,
      refreshInterval: 60000,
      revalidateOnFocus: false,
    },
  );

  const { data: teamData, isLoading: teamLoading } = useSWR<{
    team: TeamGroup[];
  }>('/api/discord/team', fetcher, {
    fallbackData: initialTeam ? { team: initialTeam } : undefined,
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  const team = teamData?.team || [];
  const loading = (statsLoading && !stats) || (teamLoading && !teamData);

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width="100%"
        height={400}
        sx={{ borderRadius: 4 }}
      />
    );
  }

  const onlineCount = stats?.onlineCount || 0;
  const totalCount = stats?.memberCount || 0;
  const allMembers = team.flatMap((g) => g.members);

  return (
    <Card
      variant="outlined"
      sx={{
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        bgcolor: 'surface.high',
        borderRadius: 0,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Banner */}
      <Box
        sx={{
          position: 'relative',
          height: 80,
          background: `linear-gradient(135deg, ${DISCORD_BLUE} 0%, ${alpha(DISCORD_BLUE, 0.6)} 50%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 41px)',
          },
        }}
      >
        {/* Online badge */}
        <Chip
          size="small"
          label={`${onlineCount} en ligne`}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            bgcolor: alpha('#22c55e', 0.2),
            color: '#22c55e',
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 24,
            border: `1px solid ${alpha('#22c55e', 0.3)}`,
            '& .MuiChip-label': { px: 1 },
            '&::before': {
              content: '""',
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              ml: 1,
              animation: 'pulse 2s infinite',
            },
          }}
        />
      </Box>
      {/* Server info */}
      <Box sx={{ px: 2.5, mt: -3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'flex-end',
          }}
        >
          <Avatar
            src="/logo.webp"
            sx={{
              width: 56,
              height: 56,
              border: '4px solid',
              borderColor: 'surface.high',
              bgcolor: 'background.default',
            }}
          />
          <Box sx={{ pb: 0.5 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 900,
                lineHeight: 1.2,
              }}
            >
              RPB
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              {totalCount.toLocaleString()} membres
            </Typography>
          </Box>
        </Stack>
      </Box>
      {/* Team */}
      <Box
        sx={{
          flex: 1,
          px: 2,
          pt: 2,
          pb: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 2,
          },
        }}
      >
        <Stack spacing={2}>
          {team.map((group) => (
            <Box key={group.roleId}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <DiscordRoleBadge
                  roleType={group.roleType}
                  size="small"
                  variant="glow"
                  duration={2}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontWeight: 600,
                  }}
                >
                  {group.members.length}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <AnimatePresence>
                  {group.members.map((member, idx) => (
                    <Box
                      component={motion.div}
                      key={member.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 0.6,
                        px: 1,
                        borderRadius: 1.5,
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.action.hover, 0.06),
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative' }}>
                        <Avatar
                          src={member.avatar || undefined}
                          sx={{
                            width: 30,
                            height: 30,
                            border: '2px solid',
                            borderColor: alpha(roleColor(group.roleType), 0.3),
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#22c55e',
                            border: '2px solid',
                            borderColor: 'surface.high',
                          }}
                        />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }}
                        >
                          {member.displayName}
                        </Typography>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            color: 'text.disabled',
                            fontSize: '0.65rem',
                          }}
                        >
                          {member.username}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </AnimatePresence>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      {/* Community avatars + join */}
      <Box sx={{ p: 2, pt: 1.5 }}>
        {allMembers.length > 0 && (
          <AvatarGroup
            max={8}
            sx={{
              mb: 1.5,
              justifyContent: 'center',
              '& .MuiAvatar-root': {
                width: 24,
                height: 24,
                fontSize: '0.65rem',
                border: '2px solid',
                borderColor: 'surface.high',
              },
            }}
          >
            {allMembers.slice(0, 8).map((m) => (
              <Avatar key={m.id} src={m.avatar || undefined} />
            ))}
          </AvatarGroup>
        )}
        <Button
          component="a"
          href="https://discord.gg/rpb"
          target="_blank"
          rel="noopener noreferrer"
          variant="contained"
          fullWidth
          sx={{
            bgcolor: DISCORD_BLUE,
            color: 'white',
            '&:hover': {
              bgcolor: alpha(DISCORD_BLUE, 0.85),
              boxShadow: `0 6px 20px ${alpha(DISCORD_BLUE, 0.4)}`,
            },
            py: 1.2,
            fontSize: '0.85rem',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 800,
          }}
        >
          Rejoindre le serveur
        </Button>
      </Box>
    </Card>
  );
}
