'use client';

import {
  Avatar,
  alpha,
  Box,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { DiscordIcon } from '@/components/ui/Icons';
import { RoleColors } from '@/lib/role-colors';

interface StaffCardProps {
  member: {
    name: string;
    role: string;
    imageUrl?: string | null;
    teamId: string;
    discordId?: string | null;
  };
}

const TEAM_COLORS: Record<string, string> = {
  ADMIN: RoleColors.ADMIN.hex,
  RH: RoleColors.RH.hex,
  MODO: RoleColors.MODO.hex,
  STAFF: RoleColors.STAFF.hex,
  ARBITRE: RoleColors.ARBITRE.hex,
  DEV: '#10b981',
  EVENT: '#f59e0b',
  MEDIA: '#8b5cf6',
};

export function StaffCard({ member }: StaffCardProps) {
  const theme = useTheme();
  const color = TEAM_COLORS[member.role] || theme.palette.primary.main;

  return (
    <Card
      component={motion.div}
      whileHover={{
        y: -8,
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 20,
          mass: 0.8,
        },
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          type: 'spring',
          stiffness: 100,
          damping: 20,
        },
      }}
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.3s',
        '&:hover': {
          borderColor: alpha(color, 0.5),
        },
      }}
    >
      <CardContent sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
        {member.discordId && (
          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
            <Tooltip title="Profil Discord" arrow>
              <IconButton
                size="small"
                component="a"
                href={`https://discord.com/users/${member.discordId}`}
                target="_blank"
                sx={{
                  color: 'text.disabled',
                  '&:hover': {
                    color: '#5865F2',
                    bgcolor: alpha('#5865F2', 0.1),
                  },
                }}
              >
                <DiscordIcon size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Avatar
          src={member.imageUrl || undefined}
          sx={{
            width: 100,
            height: 100,
            mx: 'auto',
            mb: 2,
            border: `4px solid ${alpha(color, 0.1)}`,
            fontSize: '2rem',
            fontWeight: 'bold',
            bgcolor: alpha(color, 0.1),
            color: color,
            boxShadow: `0 8px 16px ${alpha(color, 0.15)}`,
          }}
        >
          {member.name.charAt(0)}
        </Avatar>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            mb: 0.5,
          }}
        >
          {member.name}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: color,
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            mb: 0,
          }}
        >
          {member.role}
        </Typography>
      </CardContent>
    </Card>
  );
}
