import { Box, CircularProgress } from '@mui/material';
import { Suspense } from 'react';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      }
    >
      {children}
    </Suspense>
  );
}
