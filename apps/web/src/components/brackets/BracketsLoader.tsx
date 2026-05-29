"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

/**
 * Skeleton MUI affiche le temps que `BracketsViewerClient` se charge cote browser
 * (dynamic import + fetch script UMD + render DOM).
 */
export function BracketsLoader(): React.ReactElement {
  return (
    <Box sx={{ p: 2 }} aria-busy="true" aria-live="polite">
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={40} width="40%" />
        <Stack direction="row" spacing={2}>
          <Skeleton variant="rounded" height={120} width="100%" />
          <Skeleton variant="rounded" height={120} width="100%" />
          <Skeleton variant="rounded" height={120} width="100%" />
        </Stack>
        <Stack direction="row" spacing={2}>
          <Skeleton variant="rounded" height={120} width="50%" />
          <Skeleton variant="rounded" height={120} width="50%" />
        </Stack>
        <Skeleton variant="rounded" height={120} width="60%" />
      </Stack>
    </Box>
  );
}

export default BracketsLoader;
