'use client';

import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 3,
            p: 6,
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontWeight: 'bold',
              color: 'primary.main',
              mb: 2,
            }}
          >
            404
          </Typography>
          <Typography
            variant="h4"
            component="h2"
            gutterBottom
            sx={{ color: 'text.primary' }}
          >
            Page introuvable
          </Typography>
          <Link href="/" passHref style={{ textDecoration: 'none' }}>
            <Button variant="contained" color="secondary" sx={{ mt: 2 }}>
              Retour à l&apos;accueil
            </Button>
          </Link>
        </Box>
      </Container>
    </Box>
  );
}
