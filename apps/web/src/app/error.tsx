'use client';

import { Box, Button, Typography } from '@mui/material';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'background.default',
        color: 'text.primary',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="h4"
        color="error"
        sx={{
          fontWeight: 'bold',
        }}
      >
        Une erreur est survenue
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
        }}
      >
        Désolé, impossible d'afficher cette page pour le moment.
      </Typography>
      {error.digest && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontFamily: 'monospace',
          }}
        >
          ID: {error.digest}
        </Typography>
      )}
      <Button
        variant="contained"
        onClick={reset}
        color="primary"
        sx={{ mt: 2 }}
      >
        Réessayer
      </Button>
    </Box>
  );
}
