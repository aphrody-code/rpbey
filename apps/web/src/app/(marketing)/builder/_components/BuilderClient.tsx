'use client';

import { Box, Container, Paper } from '@mui/material';
import { BuilderProvider, useBuilder } from './BuilderContext';
import { BuilderHeader } from './BuilderHeader';
import { DeckComposition } from './DeckComposition';
import { MobileTabSwitcher } from './MobileTabSwitcher';
import { PartCatalog } from './PartCatalog';

function BuilderLayout() {
  const { state } = useBuilder();

  return (
    <Container
      maxWidth="xl"
      className="bbx-diagonal"
      sx={{ py: { xs: 1.5, md: 3 } }}
    >
      <BuilderHeader />

      <MobileTabSwitcher />

      {/* Desktop: 2-panel layout */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          gap: 3,
          mt: 3,
          alignItems: 'flex-start',
        }}
      >
        {/* Left: Catalog */}
        <Paper
          elevation={0}
          sx={{
            flex: 3,
            minWidth: 0,
            p: 2.5,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <PartCatalog />
        </Paper>

        {/* Right: Deck composition (sticky) */}
        <Paper
          elevation={0}
          sx={{
            flex: 2,
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            p: 2.5,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'divider',
              borderRadius: 2,
            },
          }}
        >
          <DeckComposition />
        </Paper>
      </Box>

      {/* Mobile: tabbed layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2, pb: 12 }}>
        {state.mobileTab === 'catalog' ? <PartCatalog /> : <DeckComposition />}
      </Box>
    </Container>
  );
}

export function BuilderClient() {
  return (
    <BuilderProvider>
      <BuilderLayout />
    </BuilderProvider>
  );
}
