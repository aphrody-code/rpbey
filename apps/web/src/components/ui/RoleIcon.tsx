'use client';

import Box from '@mui/material/Box';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type React from 'react';
import { type RoleType } from '@/lib/role-colors';

export interface RoleIconProps {
  /**
   * The role type ('ADMIN', 'MODO', 'RH', 'STAFF', 'DEFAULT')
   */
  role: RoleType;
  /**
   * Size in pixels
   * @default 48
   */
  size?: number;
  /**
   * Animation duration in seconds
   * @default 0.5
   */
  duration?: number;
  /**
   * Whether to animate on mount
   * @default true
   */
  animate?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

const ROLE_IMAGES: Record<RoleType, string> = {
  ADMIN: '/logo-admin.webp',
  MODO: '/logo-modo.webp',
  RH: '/logo-rh.webp',
  STAFF: '/logo-staff.webp',
  ARBITRE: '/logo.webp',
  DEFAULT: '/logo.webp',
};

export const RoleIcon: React.FC<RoleIconProps> = ({
  role,
  size = 48,
  duration = 0.5,
  animate = true,
  className,
}) => {
  const src = ROLE_IMAGES[role] || ROLE_IMAGES.DEFAULT;

  return (
    <Box
      className={className}
      sx={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <motion.div
        initial={animate ? { scale: 0.8, opacity: 0 } : false}
        animate={animate ? { scale: 1, opacity: 1 } : false}
        transition={{
          duration: duration,
          ease: [0.34, 1.56, 0.64, 1], // Bouncy easeOutBack
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Image
          src={src}
          alt={role}
          width={size}
          height={size}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          priority={role === 'ADMIN' || role === 'DEFAULT'}
        />
      </motion.div>
    </Box>
  );
};

export default RoleIcon;
