/**
 * RPB - Participant List Component
 * Displays registered participants for a tournament
 */

'use client';

import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

interface Participant {
  id: string;
  seed: number | null;
  userId: string;
  user: {
    id: string;
    name: string;
    profile?: {
      bladerName?: string;
      avatarUrl?: string;
    };
    decks?: Array<{
      id: string;
      name: string;
      isActive: boolean;
    }>;
  };
}

interface ParticipantListProps {
  participants: Participant[];
  maxPlayers: number;
  canManage?: boolean;
  onRemove?: (userId: string) => void;
}

export function ParticipantList({
  participants,
  maxPlayers,
  canManage = false,
  onRemove,
}: ParticipantListProps) {
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.seed && b.seed) return a.seed - b.seed;
    if (a.seed) return -1;
    if (b.seed) return 1;
    return 0;
  });

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
            }}
          >
            Participants
          </Typography>
          <Chip
            label={`${participants.length} / ${maxPlayers}`}
            color={participants.length >= maxPlayers ? 'error' : 'default'}
            size="small"
          />
        </Box>

        {participants.length === 0 ? (
          <Typography
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              py: 4,
            }}
          >
            Aucun participant inscrit
          </Typography>
        ) : (
          <List disablePadding>
            {sortedParticipants.map((participant, index) => {
              const name =
                participant.user.profile?.bladerName ?? participant.user.name;
              const hasActiveDeck = participant.user.decks?.some(
                (d) => d.isActive,
              );

              return (
                <ListItem
                  key={participant.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: 'action.hover',
                  }}
                  secondaryAction={
                    canManage && onRemove ? (
                      <Tooltip title="Retirer">
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => onRemove(participant.userId)}
                        >
                          <PersonRemoveIcon />
                        </IconButton>
                      </Tooltip>
                    ) : undefined
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      src={participant.user.profile?.avatarUrl}
                      sx={{
                        width: 36,
                        height: 36,
                        border: 2,
                        borderColor: participant.seed
                          ? participant.seed <= 3
                            ? 'warning.main'
                            : 'primary.main'
                          : 'transparent',
                      }}
                    >
                      {name[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Link
                        href={`/dashboard/profile/${participant.userId}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 'medium',
                            }}
                          >
                            {index + 1}. {name}
                          </Typography>
                          {participant.seed && (
                            <Chip
                              label={`Seed ${participant.seed}`}
                              size="small"
                              color="warning"
                              sx={{ height: 18, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      </Link>
                    }
                    secondary={
                      hasActiveDeck ? (
                        <Chip
                          label="Deck prêt"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                        />
                      ) : (
                        <Chip
                          label="Pas de deck"
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                        />
                      )
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
