'use client';

import {
  EmojiEvents as TrophyIcon,
  CheckCircle as VerifiedIcon,
} from '@mui/icons-material';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';

interface RankingPreviewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rankings: any[];
}

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank];

  if (color) {
    return (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: color,
          color: 'rgba(0, 0, 0, 0.87)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '0.75rem',
          mx: 'auto',
          boxShadow: `0 2px 8px ${alpha(color, 0.35)}`,
        }}
      >
        {rank}
      </Box>
    );
  }

  return (
    <Typography
      sx={{
        fontWeight: 'bold',
        color: 'text.secondary',
        fontSize: '0.75rem',
        textAlign: 'center',
      }}
    >
      #{rank}
    </Typography>
  );
}

export function RankingPreview({ rankings }: RankingPreviewProps) {
  const theme = useTheme();

  if (!rankings || rankings.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          py: 4,
          textAlign: 'center',
        }}
      >
        Aucun blader classé
      </Typography>
    );
  }

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Table size="small" aria-label="Top 5 bladers">
        <TableHead>
          <TableRow>
            <TableCell
              align="center"
              sx={{
                width: 40,
                px: 0.5,
                py: 1,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                fontWeight: 900,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              #
            </TableCell>
            <TableCell
              sx={{
                px: 1,
                py: 1,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                fontWeight: 900,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Blader
            </TableCell>
            <TableCell
              align="center"
              sx={{
                px: 0.5,
                py: 1,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                fontWeight: 900,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Pts
            </TableCell>
            <TableCell
              align="center"
              sx={{
                px: 0.5,
                py: 1,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                fontWeight: 900,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              V/D
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rankings.map((profile, index) => {
            const rank = index + 1;
            const rankColor = RANK_COLORS[rank];
            const totalMatches = (profile.wins ?? 0) + (profile.losses ?? 0);
            const winRate =
              totalMatches > 0
                ? ((profile.wins / totalMatches) * 100).toFixed(0)
                : '0';
            const playerName =
              profile.playerName || profile.user?.name || 'Anonyme';
            const avatarUrl =
              profile.avatarUrl || profile.user?.image || undefined;
            const challongeUsername =
              profile.challongeUsername ||
              profile.user?.profile?.challongeUsername;

            return (
              <TableRow
                key={profile.id}
                component={motion.tr}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                hover
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  bgcolor:
                    index % 2 === 0
                      ? 'transparent'
                      : 'rgba(255, 255, 255, 0.015)',
                  borderLeft: rankColor
                    ? `3px solid ${alpha(rankColor, 0.5)}`
                    : '3px solid transparent',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.action.hover, 0.08),
                  },
                }}
              >
                {/* Rank */}
                <TableCell align="center" sx={{ px: 0.5, py: 0.75 }}>
                  <RankBadge rank={rank} />
                </TableCell>
                {/* Blader info */}
                <TableCell sx={{ px: 1, py: 0.75 }}>
                  <Box
                    component={profile.userId ? Link : 'div'}
                    href={
                      profile.userId ? `/profile/${profile.userId}` : undefined
                    }
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      textDecoration: 'none',
                      color: 'inherit',
                      '&:hover .blader-name': profile.userId
                        ? { color: 'primary.main' }
                        : undefined,
                    }}
                  >
                    <Avatar
                      src={avatarUrl}
                      alt={playerName}
                      sx={{
                        width: 30,
                        height: 30,
                        border: `1.5px solid ${rankColor ? alpha(rankColor, 0.6) : theme.palette.divider}`,
                        flexShrink: 0,
                        fontSize: '0.7rem',
                      }}
                    >
                      {getInitials(playerName)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          className="blader-name"
                          noWrap
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            transition: 'color 0.2s',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {playerName}
                        </Typography>
                        {challongeUsername && (
                          <Tooltip title={`Challonge : ${challongeUsername}`}>
                            <VerifiedIcon
                              sx={{
                                fontSize: '0.65rem',
                                color: 'info.main',
                                opacity: 0.8,
                                flexShrink: 0,
                              }}
                            />
                          </Tooltip>
                        )}
                        {profile.tournamentWins > 0 && (
                          <Tooltip
                            title={`${profile.tournamentWins} tournoi(s) remport\u00e9(s)`}
                          >
                            <TrophyIcon
                              sx={{
                                fontSize: '0.7rem',
                                color: '#FFD700',
                                filter:
                                  'drop-shadow(0 0 2px rgba(255, 215, 0, 0.4))',
                                flexShrink: 0,
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </TableCell>
                {/* Points */}
                <TableCell align="center" sx={{ px: 0.5, py: 0.75 }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      color: 'primary.main',
                      fontSize: '0.8rem',
                    }}
                  >
                    {profile.points}
                  </Typography>
                </TableCell>
                {/* V/D with win rate */}
                <TableCell align="center" sx={{ px: 0.5, py: 0.75 }}>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ color: 'success.main', fontWeight: 700 }}
                    >
                      {profile.wins ?? 0}
                    </Box>
                    <Box component="span" sx={{ opacity: 0.4, mx: '1px' }}>
                      /
                    </Box>
                    <Box component="span" sx={{ color: 'error.main' }}>
                      {profile.losses ?? 0}
                    </Box>
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.55rem',
                      opacity: 0.6,
                      display: 'block',
                      lineHeight: 1,
                    }}
                    color={
                      Number.parseFloat(winRate) >= 50
                        ? 'success.main'
                        : 'text.secondary'
                    }
                  >
                    {winRate}%
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
