'use client';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import type React from 'react';
import {
  getRoleTypeFromDiscordId,
  RoleColors,
  type RoleType,
} from '@/lib/role-colors';

const RoleIcon = dynamic(
  () => import('./RoleIcon').then((mod) => mod.RoleIcon),
  {
    ssr: false,
    loading: () => <Box sx={{ width: '100%', height: '100%' }} />,
  },
);

export interface DiscordRoleBadgeProps {
  /**
   * The Discord Role ID (e.g., '1319720685714804809')
   */
  roleId?: string;
  /**
   * Explicit RoleType override (e.g., 'ADMIN')
   */
  roleType?: RoleType;
  /**
   * Size of the badge
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Whether to show the role icon
   * @default true
   */
  showIcon?: boolean;
  /**
   * Custom label (overrides default role name)
   */
  label?: string;
  /**
   * Variant of the badge style
   * @default 'filled'
   */
  variant?: 'filled' | 'outlined' | 'glow';
  /**
   * Drawing animation duration in seconds
   * @default 1.5
   */
  duration?: number;
  /**
   * Additional className
   */
  className?: string;
}

export const DiscordRoleBadge: React.FC<DiscordRoleBadgeProps> = ({
  roleId,
  roleType,
  size = 'medium',
  showIcon = true,
  label,
  variant = 'filled',
  duration = 1.5,
  className,
}) => {
  // Determine Role Type
  const type =
    roleType || (roleId ? getRoleTypeFromDiscordId(roleId) : 'DEFAULT');
  const config = RoleColors[type];

  // Safe color and name access handling the discriminated union nature of RoleColors
  const color = 'hex' in config ? config.hex : config.secondary;
  const roleName = label || ('name' in config ? config.name : 'RPB');

  // Size calculations
  const height = size === 'small' ? 24 : size === 'large' ? 40 : 32;
  const fontSize =
    size === 'small' ? '0.75rem' : size === 'large' ? '1rem' : '0.875rem';
  const iconSize = size === 'small' ? 18 : size === 'large' ? 28 : 22;
  const paddingX = size === 'small' ? 1 : 1.5;

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    hover: { scale: 1.02 },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={containerVariants}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
      style={{ display: 'inline-flex' }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: height,
          px: paddingX,
          borderRadius: 1, // Slightly rounded corners for a modern feel
          backgroundColor:
            variant === 'filled'
              ? alpha(color, 0.1)
              : variant === 'glow'
                ? alpha(color, 0.05)
                : 'transparent',
          border: `1px solid ${variant === 'outlined' ? color : alpha(color, 0.2)}`,
          boxShadow:
            variant === 'glow' ? `0 0 15px ${alpha(color, 0.3)}` : 'none',
          color: color,
          userSelect: 'none',
          cursor: 'default',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: alpha(color, 0.15),
            borderColor: color,
            boxShadow: `0 0 20px ${alpha(color, 0.4)}`,
          },
        }}
      >
        {showIcon && (
          <Box
            component="span"
            sx={{
              mr: 1,
              display: 'flex',
              alignItems: 'center',
              ml: -0.5,
            }}
          >
            <RoleIcon role={type} size={iconSize} duration={duration} />
          </Box>
        )}
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: fontSize,
            fontWeight: 700,
            lineHeight: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-google-sans), sans-serif',
          }}
        >
          {roleName}
        </Typography>
      </Box>
    </motion.div>
  );
};

export default DiscordRoleBadge;
