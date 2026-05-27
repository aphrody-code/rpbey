'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { type ElementType } from 'react';

interface FeatureCardProps {
  icon: ElementType;
  title: string;
  description: string;
  href: string;
  color: string;
  external?: boolean;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  color,
  external,
}: FeatureCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconAny = Icon as any;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          bgcolor: alpha(color, 0.08),
          transform: 'scale(1.02)',
          boxShadow: `0 12px 24px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3),
        },
      }}
    >
      <CardActionArea
        component={external ? 'a' : Link}
        href={href}
        target={external ? '_blank' : undefined}
        sx={{ height: '100%', p: 3 }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(color, 0.1),
            color: color,
            mb: 2,
          }}
        >
          <IconAny size={28} style={{ width: 28, height: 28 }} />
        </Box>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 'bold',
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {description}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
