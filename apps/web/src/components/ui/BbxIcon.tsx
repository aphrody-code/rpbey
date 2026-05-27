'use client';

import { Box } from '@mui/material';
import { type SxProps, type Theme } from '@mui/material/styles';

interface BbxIconProps {
  src: string;
  alt?: string;
  size?: number;
  sx?: SxProps<Theme>;
}

export function BbxIcon({ src, alt = '', size = 24, sx }: BbxIconProps) {
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        ...sx,
      }}
    />
  );
}

// Pre-defined icon components for common use
export function BbxNavIcon({
  src,
  active,
  size = 26,
}: {
  src: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        filter: active ? 'none' : 'grayscale(0.6) opacity(0.7)',
        transition: 'filter 0.2s ease',
      }}
    />
  );
}
