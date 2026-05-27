'use client';

import { Box, CircularProgress } from '@mui/material';

export default function Loading() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default', // Use theme background instead of hardcoded black
        zIndex: 9999,
      }}
    >
      <CircularProgress size={60} color="primary" />
    </Box>
  );
}
