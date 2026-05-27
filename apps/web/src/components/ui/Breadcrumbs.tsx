'use client';

import { NavigateNext } from '@mui/icons-material';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link as MuiLink,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import type React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <MuiBreadcrumbs
      separator={<NavigateNext fontSize="small" />}
      aria-label="breadcrumb"
      sx={{ mb: 2 }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (isLast || !item.href) {
          return (
            <Typography
              key={item.label}
              sx={{
                color: 'text.primary',
                fontWeight: isLast ? 'medium' : 'regular',
              }}
            >
              {item.label}
            </Typography>
          );
        }

        return (
          <MuiLink
            key={item.label}
            component={Link}
            href={item.href}
            underline="hover"
            color="inherit"
          >
            {item.label}
          </MuiLink>
        );
      })}
    </MuiBreadcrumbs>
  );
};
