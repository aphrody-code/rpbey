import { Box, Container, Skeleton, Stack } from '@mui/material';

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4, px: { xs: 0, sm: 3 } }}>
      <Box sx={{ mb: 4, px: { xs: 2, sm: 0 } }}>
        <Skeleton variant="text" width={200} height={60} />
        <Skeleton variant="text" width={300} height={20} />
      </Box>

      <Stack spacing={4}>
        {/* Fake Video Player Area */}
        <Skeleton
          variant="rectangular"
          width="100%"
          height={500}
          sx={{ borderRadius: 4 }}
        />

        {/* Fake Content Feed */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 3,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Box key={i}>
              <Skeleton
                variant="rectangular"
                width="100%"
                height={160}
                sx={{ borderRadius: 2 }}
              />
              <Skeleton variant="text" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="60%" />
            </Box>
          ))}
        </Box>
      </Stack>
    </Container>
  );
}
