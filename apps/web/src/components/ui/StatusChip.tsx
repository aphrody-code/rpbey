'use client';

import {
  Block as BlockIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import Chip, { type ChipProps } from '@mui/material/Chip';
import { TrophyIcon } from '@/components/ui/Icons';

// Tournament status types
export type TournamentStatus =
  | 'draft'
  | 'pending'
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'checkin'
  | 'underway'
  | 'in_progress'
  | 'complete'
  | 'completed'
  | 'cancelled';

// User status types
export type UserStatus =
  | 'online'
  | 'offline'
  | 'idle'
  | 'dnd'
  | 'banned'
  | 'verified';

// Match status types
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

const tournamentStatusConfig: Record<
  TournamentStatus,
  { label: string; color: ChipProps['color']; icon: React.ReactElement }
> = {
  draft: { label: 'Brouillon', color: 'default', icon: <PendingIcon /> },
  pending: { label: 'En attente', color: 'warning', icon: <ScheduleIcon /> },
  upcoming: { label: 'À venir', color: 'info', icon: <ScheduleIcon /> },
  registration_open: {
    label: 'Inscriptions ouvertes',
    color: 'success',
    icon: <CheckCircleIcon />,
  },
  registration_closed: {
    label: 'Inscriptions closes',
    color: 'warning',
    icon: <BlockIcon />,
  },
  checkin: { label: 'Check-in', color: 'info', icon: <PendingIcon /> },
  underway: { label: 'En cours', color: 'primary', icon: <PlayArrowIcon /> },
  in_progress: { label: 'En cours', color: 'primary', icon: <PlayArrowIcon /> },
  complete: { label: 'Terminé', color: 'success', icon: <TrophyIcon /> },
  completed: { label: 'Terminé', color: 'success', icon: <TrophyIcon /> },
  cancelled: { label: 'Annulé', color: 'error', icon: <CancelIcon /> },
};

const userStatusConfig: Record<
  UserStatus,
  { label: string; color: ChipProps['color']; icon?: React.ReactElement }
> = {
  online: { label: 'En ligne', color: 'success', icon: <CheckCircleIcon /> },
  offline: { label: 'Hors ligne', color: 'default' },
  idle: { label: 'Inactif', color: 'warning', icon: <ScheduleIcon /> },
  dnd: { label: 'Ne pas déranger', color: 'error', icon: <BlockIcon /> },
  banned: { label: 'Banni', color: 'error', icon: <CancelIcon /> },
  verified: { label: 'Vérifié', color: 'primary', icon: <CheckCircleIcon /> },
};

const matchStatusConfig: Record<
  MatchStatus,
  { label: string; color: ChipProps['color']; icon: React.ReactElement }
> = {
  pending: { label: 'En attente', color: 'warning', icon: <ScheduleIcon /> },
  in_progress: { label: 'En cours', color: 'primary', icon: <PlayArrowIcon /> },
  completed: { label: 'Terminé', color: 'success', icon: <CheckCircleIcon /> },
  cancelled: { label: 'Annulé', color: 'error', icon: <CancelIcon /> },
};

interface StatusChipProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status?: TournamentStatus | UserStatus | MatchStatus;
  type?: 'tournament' | 'user' | 'match' | 'generic';
  label?: string;
  customColor?: string;
  showIcon?: boolean;
}

export function StatusChip({
  status,
  type,
  label,
  customColor,
  showIcon = true,
  size = 'small',
  sx,
  ...props
}: StatusChipProps) {
  let config: {
    label: string;
    color: ChipProps['color'];
    icon?: React.ReactElement;
  };

  if (type === 'generic' || (!type && label)) {
    return (
      <Chip
        label={label || status}
        size={size}
        sx={{
          ...(customColor
            ? {
                bgcolor: customColor,
                color: 'white',
                fontWeight: 600,
              }
            : {}),
          ...sx,
        }}
        {...props}
      />
    );
  }

  switch (type) {
    case 'tournament':
      config = tournamentStatusConfig[status as TournamentStatus] || {
        label: status as string,
        color: 'default',
      };
      break;
    case 'user':
      config = userStatusConfig[status as UserStatus] || {
        label: status as string,
        color: 'default',
      };
      break;
    case 'match':
      config = matchStatusConfig[status as MatchStatus] || {
        label: status as string,
        color: 'default',
      };
      break;
    default:
      config = { label: status || label || '', color: 'default' };
  }

  return (
    <Chip
      label={config.label}
      color={config.color}
      icon={showIcon ? config.icon : undefined}
      size={size}
      {...props}
    />
  );
}

// Convenience components
interface TournamentStatusChipProps
  extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: TournamentStatus;
  showIcon?: boolean;
}

export function TournamentStatusChip({
  status,
  ...props
}: TournamentStatusChipProps) {
  return <StatusChip status={status} type="tournament" {...props} />;
}

interface UserStatusChipProps
  extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: UserStatus;
  showIcon?: boolean;
}

export function UserStatusChip({ status, ...props }: UserStatusChipProps) {
  return <StatusChip status={status} type="user" {...props} />;
}

interface MatchStatusChipProps
  extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: MatchStatus;
  showIcon?: boolean;
}

export function MatchStatusChip({ status, ...props }: MatchStatusChipProps) {
  return <StatusChip status={status} type="match" {...props} />;
}
