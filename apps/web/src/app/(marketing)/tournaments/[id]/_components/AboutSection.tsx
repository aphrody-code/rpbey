'use client';

import {
  CardGiftcard,
  Info,
  WarningAmber,
} from '@mui/icons-material';
import { alpha, Box, Paper, Stack, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TournamentData } from './types';

const MEDAL_COLORS: Record<string, string> = {
  '🥇': '#fbbf24',
  '🥈': '#94a3b8',
  '🥉': '#d97706',
};

function parsePrizes(text: string): { intro: string; prizes: string[] } | null {
  const medals = Object.keys(MEDAL_COLORS);
  if (!medals.some((m) => text.includes(m))) return null;
  const parts = text.split(/(?=🥇|🥈|🥉)/);
  const intro = parts[0]?.trim() ?? '';
  const prizes = parts.slice(intro ? 1 : 0).map((p) => p.trim());
  return prizes.length > 0 ? { intro, prizes } : null;
}

interface Props {
  tournament: TournamentData;
  isBTS: boolean;
}

export function AboutSection({ tournament, isBTS }: Props) {
  const accentColor = isBTS ? 'secondary.main' : 'primary.main';

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 4,
        borderRadius: 6,
        border: '1px solid',
        borderColor: isBTS
          ? (t) => alpha(t.palette.secondary.main, 0.2)
          : 'divider',
        background: isBTS
          ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : 'background.paper',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isBTS && (
        <Box
          sx={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 300,
            height: 300,
            background: (t) =>
              `radial-gradient(circle, ${alpha(t.palette.secondary.main, 0.06)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      <Box sx={{ px: { xs: 3, md: 5 }, py: { xs: 3, md: 4 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
          <Info sx={{ fontSize: 18, color: accentColor }} />
          <Typography
            variant="overline"
            sx={{
              fontWeight: 900,
              color: accentColor,
              letterSpacing: 2,
              fontSize: '0.75rem',
            }}
          >
            DESCRIPTION
          </Typography>
        </Stack>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => {
              const content = String(children);
              const parsed = parsePrizes(content);
              if (parsed) {
                return (
                  <Box sx={{ my: 2 }}>
                    {parsed.intro && (
                      <Typography
                        variant="body2"
                        sx={{
                          mb: 2,
                          lineHeight: 1.7,
                          fontSize: '0.925rem',
                          color: isBTS ? 'grey.300' : 'text.primary',
                          fontWeight: 500,
                        }}
                      >
                        {parsed.intro}
                      </Typography>
                    )}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', mb: 2 }}
                    >
                      <CardGiftcard
                        sx={{ fontSize: 18, color: accentColor }}
                      />
                      <Typography
                        variant="overline"
                        sx={{
                          fontWeight: 900,
                          color: accentColor,
                          letterSpacing: 2,
                          fontSize: '0.7rem',
                        }}
                      >
                        RÉCOMPENSES
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {parsed.prizes.map((line, i) => {
                        const medal = Object.keys(MEDAL_COLORS).find((m) =>
                          line.includes(m),
                        );
                        const color =
                          (medal ? MEDAL_COLORS[medal] : undefined) ?? '#666';
                        return (
                          <Box
                            key={i}
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              bgcolor: alpha(color, 0.07),
                              borderLeft: `3px solid ${color}`,
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              '&:hover': {
                                transform: 'translateX(4px)',
                                boxShadow: `0 4px 20px ${alpha(color, 0.15)}`,
                              },
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 800,
                                color: '#fff',
                                fontSize: '0.95rem',
                              }}
                            >
                              {line}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              }

              if (
                content.includes('⚠️') ||
                content.toLowerCase().includes('obligatoire')
              ) {
                return (
                  <Box
                    sx={{
                      my: 2,
                      p: 2,
                      borderRadius: 3,
                      bgcolor: (t) => alpha(t.palette.warning.main, 0.08),
                      border: (t) =>
                        `1px solid ${alpha(t.palette.warning.main, 0.2)}`,
                      borderLeft: (t) => `4px solid ${t.palette.warning.main}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                    }}
                  >
                    <WarningAmber
                      sx={{
                        fontSize: 18,
                        color: 'warning.main',
                        mt: 0.2,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: 'warning.light',
                        m: 0,
                        lineHeight: 1.6,
                        fontSize: '0.925rem',
                      }}
                    >
                      {children}
                    </Typography>
                  </Box>
                );
              }

              return (
                <Typography
                  variant="body2"
                  sx={{
                    mb: 2,
                    lineHeight: 1.7,
                    fontSize: '0.925rem',
                    color: isBTS ? 'grey.300' : 'text.primary',
                    fontWeight: 500,
                  }}
                >
                  {children}
                </Typography>
              );
            },
            strong: ({ children }) => (
              <Box
                component="span"
                sx={{ fontWeight: 900, color: isBTS ? '#fff' : 'text.primary' }}
              >
                {children}
              </Box>
            ),
            a: ({ href, children }) => (
              <Box
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: accentColor,
                  textDecoration: 'none',
                  fontWeight: 700,
                  borderBottom: (t) =>
                    `1px dashed ${alpha(
                      isBTS ? t.palette.secondary.main : t.palette.primary.main,
                      0.4,
                    )}`,
                  transition: 'border-color 0.2s',
                  '&:hover': {
                    borderBottomStyle: 'solid',
                    borderBottomColor: accentColor,
                  },
                }}
              >
                {children}
              </Box>
            ),
          }}
        >
          {tournament.description || ''}
        </ReactMarkdown>
      </Box>
    </Paper>
  );
}
