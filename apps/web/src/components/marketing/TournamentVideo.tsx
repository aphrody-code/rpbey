'use client';

import { Box, Container, Paper, Typography } from '@mui/material';
import { YouTubeEmbed } from '@next/third-parties/google';
import { motion } from 'framer-motion';

// MD3 Expressive easing
const EASE_EMPHASIZED_DECELERATE = [0.05, 0.7, 0.1, 1.0] as const;

interface TournamentVideoProps {
  videoId: string;
  title?: string;
  subtitle?: string;
}

export function TournamentVideo({
  videoId,
  title = "REVIVEZ L'EXPÉRIENCE",
  subtitle = 'Les meilleurs moments du dernier tournoi en vidéo.',
}: TournamentVideoProps) {
  return (
    <Box
      sx={{
        // Mobile-first padding
        py: { xs: 5, sm: 6, md: 8 },
        bgcolor: 'background.default',
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          px: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.6, ease: EASE_EMPHASIZED_DECELERATE }}
          sx={{
            mb: { xs: 3, sm: 4, md: 6 },
            textAlign: 'center',
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 'bold',
              mb: { xs: 1, md: 2 },
              letterSpacing: '-0.02em',

              // Fluid typography
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',

              // Fluid typography
              fontSize: { xs: '0.9rem', sm: '1rem', md: '1.25rem' },

              px: { xs: 2, md: 0 },
            }}
          >
            {subtitle}
          </Typography>
        </Box>

        <Paper
          elevation={0}
          component={motion.div}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{
            duration: 0.8,
            delay: 0.2,
            ease: EASE_EMPHASIZED_DECELERATE,
          }}
          sx={{
            width: '100%',
            // MD3 Expressive shape - responsive radius
            borderRadius: { xs: 3, sm: 4, md: 6 },
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'black',
            // Responsive shadow
            boxShadow: {
              xs: '0 12px 40px rgba(0,0,0,0.3)',
              md: '0 24px 80px rgba(0,0,0,0.4)',
            },
            position: 'relative',
          }}
        >
          <YouTubeEmbed
            videoid={videoId}
            params="rel=0"
            style="border-radius: inherit;"
          />
        </Paper>
      </Container>
    </Box>
  );
}
