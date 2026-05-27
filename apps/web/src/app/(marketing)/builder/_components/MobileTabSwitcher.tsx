'use client';

import { Dashboard, ViewList } from '@mui/icons-material';
import { Badge, Box, Tab, Tabs } from '@mui/material';
import { useBuilder } from './BuilderContext';

export function MobileTabSwitcher() {
  const { state, dispatch } = useBuilder();

  const filledCount = state.beys.filter(
    (b) => b.blade || b.ratchet || b.bit,
  ).length;

  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        mx: -2,
        px: 0,
      }}
    >
      <Tabs
        value={state.mobileTab === 'catalog' ? 0 : 1}
        onChange={(_, v) =>
          dispatch({
            type: 'SET_MOBILE_TAB',
            tab: v === 0 ? 'catalog' : 'deck',
          })
        }
        variant="fullWidth"
        textColor="inherit"
        sx={{
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            fontWeight: 'bold',
            fontSize: '0.85rem',
            textTransform: 'none',
          },
        }}
        slotProps={{
          indicator: { sx: { bgcolor: 'error.main', height: 3 } },
        }}
      >
        <Tab
          icon={<ViewList sx={{ fontSize: 20 }} />}
          iconPosition="start"
          label="Catalogue"
        />
        <Tab
          icon={
            <Badge badgeContent={filledCount} color="error" max={3}>
              <Dashboard sx={{ fontSize: 20 }} />
            </Badge>
          }
          iconPosition="start"
          label="Mon Deck"
        />
      </Tabs>
    </Box>
  );
}
