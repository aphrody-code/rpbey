'use client';

import { Add as AddIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import type React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon = <AddIcon />,
  children,
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              {description}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={2}>
          {children}
          {actionLabel && onAction && (
            <Button
              variant="contained"
              color="primary"
              startIcon={actionIcon}
              onClick={onAction}
              sx={{ fontWeight: 'bold' }}
            >
              {actionLabel}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
