'use client';

import { Message } from '@mui/icons-material';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { TrophyIcon } from '@/components/ui/Icons';
import { getInitials } from '@/lib/utils';

// Styled badge for online status
const StyledBadge = styled(Badge)<{
  status?: 'online' | 'offline' | 'idle' | 'dnd';
}>(({ theme, status = 'offline' }) => {
  const colors = {
    online: '#44b700',
    offline: theme.palette.grey[500],
    idle: '#faa61a',
    dnd: '#ed4245',
  };

  return {
    '& .MuiBadge-badge': {
      backgroundColor: colors[status],
      color: colors[status],
      boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
      '&::after': {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        animation:
          status === 'online' ? 'ripple 1.2s infinite ease-in-out' : 'none',
        border: '1px solid currentColor',
        content: '""',
      },
    },
    '@keyframes ripple': {
      '0%': {
        transform: 'scale(.8)',
        opacity: 1,
      },
      '100%': {
        transform: 'scale(2.4)',
        opacity: 0,
      },
    },
  };
});

interface UserCardProps {
  id: string;
  name: string | null;
  image?: string | null;
  discordId?: string | null;
  status?: 'online' | 'offline' | 'idle' | 'dnd';
  role?: string;
  tournamentsWon?: number;
  onClick?: () => void;
  onMessage?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export function UserCard({
  name,
  image,
  discordId,
  status = 'offline',
  role,
  tournamentsWon = 0,
  onClick,
  onMessage,
  showActions = true,
  compact = false,
}: UserCardProps) {
  const displayName = name ?? 'Utilisateur inconnu';

  const avatarContent = (
    <StyledBadge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      status={status}
    >
      <Avatar
        src={image ?? undefined}
        alt={displayName}
        sx={{
          width: compact ? 48 : 80,
          height: compact ? 48 : 80,
          bgcolor: 'primary.main',
          fontSize: compact ? '1rem' : '1.5rem',
        }}
      >
        {getInitials(displayName)}
      </Avatar>
    </StyledBadge>
  );

  if (compact) {
    return (
      <Card
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          cursor: onClick ? 'pointer' : 'default',
        }}
        onClick={onClick}
      >
        {avatarContent}
        <Box sx={{ ml: 2, flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {displayName}
          </Typography>
          {role && (
            <Chip
              label={role}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        {tournamentsWon > 0 && (
          <Chip
            icon={<TrophyIcon size={16} />}
            label={tournamentsWon}
            size="small"
            color="warning"
          />
        )}
      </Card>
    );
  }

  const cardContent = (
    <CardContent sx={{ textAlign: 'center', pb: showActions ? 1 : 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        {avatarContent}
      </Box>

      <Typography variant="h6" component="h3" gutterBottom noWrap>
        {displayName}
      </Typography>

      {role && (
        <Chip
          label={role}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mb: 1 }}
        />
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
        {tournamentsWon > 0 && (
          <Chip
            icon={<TrophyIcon size={16} />}
            label={`${tournamentsWon} victoire${tournamentsWon > 1 ? 's' : ''}`}
            size="small"
            color="warning"
          />
        )}
        {discordId && (
          <Chip
            label="Discord lié"
            size="small"
            color="secondary"
            variant="outlined"
          />
        )}
      </Box>
    </CardContent>
  );

  const actions = showActions && (
    <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
      <Button size="small" onClick={onClick}>
        Voir profil
      </Button>
      {onMessage && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Message />}
          onClick={(e) => {
            e.stopPropagation();
            onMessage();
          }}
        >
          Message
        </Button>
      )}
    </CardActions>
  );

  if (onClick && !showActions) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {cardContent}
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      {cardContent}
      {actions}
    </Card>
  );
}

// Grid variant for list views
interface UserCardGridProps {
  users: UserCardProps[];
  onUserClick?: (id: string) => void;
  onMessage?: (id: string) => void;
  compact?: boolean;
}

export function UserCardGrid({
  users,
  onUserClick,
  onMessage,
  compact = false,
}: UserCardGridProps) {
  return (
    <Grid container spacing={compact ? 2 : 3}>
      {users.map((user) => (
        <Grid
          key={user.id}
          size={{
            xs: 12,
            sm: compact ? 12 : 6,
            md: compact ? 6 : 4,
            lg: compact ? 4 : 3,
          }}
        >
          <UserCard
            {...user}
            compact={compact}
            onClick={() => onUserClick?.(user.id)}
            onMessage={onMessage ? () => onMessage(user.id) : undefined}
          />
        </Grid>
      ))}
    </Grid>
  );
}
