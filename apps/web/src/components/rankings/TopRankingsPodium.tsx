'use client';

import VerifiedIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import {
  Avatar,
  alpha,
  Box,
  Card,
  CardContent,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';

interface TopRankingsPodiumProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topProfiles: any[];
}

export default function TopRankingsPodium({
  topProfiles,
}: TopRankingsPodiumProps) {
  const theme = useTheme();

  if (!topProfiles || topProfiles.length === 0) return null;

  // Sort profiles to ensure order is 2, 1, 3 for the podium visual
  const podiumOrder = [];
  if (topProfiles[1]) podiumOrder.push({ ...topProfiles[1], rank: 2 });
  if (topProfiles[0]) podiumOrder.push({ ...topProfiles[0], rank: 1 });
  if (topProfiles[2]) podiumOrder.push({ ...topProfiles[2], rank: 3 });

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return theme.palette.text.primary;
  };

  return (
    <Box
      role="region"
      aria-label="Podium des 3 meilleurs bladers"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'flex-end' },
        justifyContent: 'center',
        gap: { xs: 1, sm: 1.5, md: 2 },
        mb: { xs: 2, md: 4 },
        mt: { xs: 1, md: 2 },
        perspective: '1000px',
        px: { xs: 1, sm: 0 },
      }}
    >
      {podiumOrder.map((profile, index) => {
        const isFirst = profile.rank === 1;
        const rankColor = getRankColor(profile.rank);

        return (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15, duration: 0.5, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            <Card
              component={Link}
              href={`/profile/${profile.userId}`}
              aria-label={`${profile.bladerName || profile.user?.name || 'Anonyme'}, ${profile.rank === 1 ? '1er' : `${profile.rank}ème`}, ${profile.rankingPoints} points`}
              sx={{
                position: 'relative',
                overflow: 'visible',
                bgcolor: alpha(theme.palette.background.paper, 0.5),
                backdropFilter: 'blur(12px)',
                border: '1px solid',
                borderColor: alpha(rankColor, 0.3),
                borderRadius: { xs: 3, md: 5 },
                textDecoration: 'none',
                height: {
                  xs: 'auto',
                  md: isFirst ? 210 : 180,
                },
                minHeight: { xs: isFirst ? 80 : 68 },
                display: 'flex',
                flexDirection: { xs: 'row', md: 'column' },
                alignItems: 'center',
                justifyContent: { xs: 'flex-start', md: 'center' },
                transition: 'all 0.3s ease',
                px: { xs: 2, md: 0 },
                py: { xs: 1.5, md: 0 },
                ml: { xs: 2, md: 0 },
                boxShadow: isFirst
                  ? `0 0 30px ${alpha(rankColor, 0.15)}`
                  : `0 8px 16px ${alpha('#000', 0.15)}`,
                '&:hover': {
                  transform: { xs: 'none', md: 'translateY(-8px)' },
                  borderColor: alpha(rankColor, 0.6),
                  boxShadow: `0 0 30px ${alpha(rankColor, 0.3)}`,
                },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: rankColor,
                  outlineOffset: 2,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  '&:hover': {
                    transform: 'none',
                  },
                },
              }}
            >
              {/* Rank Icon */}
              <Box
                sx={{
                  position: 'absolute',
                  top: { xs: '50%', md: -20 },
                  left: { xs: -14, md: '50%' },
                  transform: {
                    xs: 'translateY(-50%)',
                    md: 'translateX(-50%)',
                  },
                  width: { xs: 28, sm: 32, md: 42 },
                  height: { xs: 28, sm: 32, md: 42 },
                  bgcolor: rankColor,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 12px ${alpha(rankColor, 0.4)}`,
                  zIndex: 2,
                }}
              >
                <EmojiEventsIcon
                  sx={{
                    color: profile.rank === 1 ? 'black' : 'white',
                    fontSize: { xs: '0.9rem', sm: '1rem', md: '1.3rem' },
                  }}
                />
              </Box>

              <CardContent
                sx={{
                  p: { xs: 0, md: 2 },
                  pt: { xs: 0, md: 2 },
                  display: 'flex',
                  flexDirection: { xs: 'row', md: 'column' },
                  alignItems: 'center',
                  gap: { xs: 1.5, md: 0 },
                  textAlign: { xs: 'left', md: 'center' },
                  width: '100%',
                  '&:last-child': { pb: { xs: 0, md: 2 } },
                }}
              >
                <Avatar
                  src={profile.user?.image || undefined}
                  alt={profile.bladerName || profile.user?.name || 'Anonyme'}
                  sx={{
                    width: { xs: 40, sm: 48, md: isFirst ? 68 : 56 },
                    height: { xs: 40, sm: 48, md: isFirst ? 68 : 56 },
                    mx: { md: 'auto' },
                    mb: { xs: 0, md: 1.5 },
                    border: `2px solid ${rankColor}`,
                    boxShadow: `0 0 10px ${alpha(rankColor, 0.3)}`,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(profile.bladerName || profile.user?.name)}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: { xs: 'flex-start', md: 'center' },
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      component="h3"
                      variant={isFirst ? 'h6' : 'subtitle1'}
                      noWrap
                      sx={{
                        fontWeight: 900,
                        color: 'text.primary',
                        mb: 0,

                        fontSize: {
                          xs: isFirst ? '0.9rem' : '0.85rem',
                          sm: isFirst ? '1rem' : '0.9rem',
                          md: 'inherit',
                        },
                      }}
                    >
                      {profile.bladerName ||
                        profile.user?.name ||
                        profile.challongeUsername ||
                        'Anonyme'}
                    </Typography>
                    {profile.challongeUsername && (
                      <Tooltip
                        title={`Certifié Challonge : ${profile.challongeUsername}`}
                      >
                        <VerifiedIcon
                          sx={{
                            fontSize: { xs: '0.7rem', md: '0.9rem' },
                            color: 'info.main',
                            opacity: 0.8,
                            flexShrink: 0,
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: { xs: 'none', md: 'block' },
                      mb: 1,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      opacity: 0.6,
                    }}
                  >
                    BLADER RPB
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: { xs: 1, sm: 1.5, md: 2 },
                    py: { xs: 0.3, md: 0.5 },
                    borderRadius: 10,
                    bgcolor: alpha(rankColor, 0.1),
                    color: rankColor,
                    border: `1px solid ${alpha(rankColor, 0.2)}`,
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: '0.85rem', sm: '0.95rem', md: '1.2rem' },
                    }}
                  >
                    {profile.rankingPoints}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      display: { xs: 'none', md: 'block' },
                      fontSize: '0.65rem',
                    }}
                  >
                    PTS
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </Box>
  );
}
