'use client';

import CloseIcon from '@mui/icons-material/Close';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function SponsorBanner() {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner after a short delay
    const timer = setTimeout(() => {
      const dismissed = localStorage.getItem('rpb_sponsor_banner_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('rpb_sponsor_banner_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <Box
          component={motion.div}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          sx={{
            display: { xs: 'none', md: 'block' },
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 1100,
          }}
        >
          <Box
            sx={{
              px: { xs: 5, md: 4 }, // Increased padding on mobile to avoid close button
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 56, md: 48 },
              position: 'relative',
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(
                theme.palette.primary.light,
                0.8,
              )} 50%, ${theme.palette.primary.main} 100%)`,
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: 'center',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <LocalOfferIcon
                sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 'bold',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  lineHeight: 1.2,
                  flex: 1,
                }}
              >
                ANNONCE : FeedMy sponsorise la RPB ! -10% code{' '}
                <Box
                  component="span"
                  sx={{ color: 'secondary.main', fontWeight: 900 }}
                >
                  RPB10
                </Box>
              </Typography>
            </Stack>

            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{
                position: 'absolute',
                right: 8,
                color: 'inherit',
                opacity: 0.8,
                '&:hover': { opacity: 1 },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
}
