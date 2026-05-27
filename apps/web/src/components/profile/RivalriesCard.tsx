/**
 * RPB - Rivalries Card Component
 * Displays head-to-head records against opponents
 */

'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { type UserStats } from '@/lib/stats-types';

interface RivalriesCardProps {
  rivalries: UserStats['rivalries'];
}

export function RivalriesCard({ rivalries }: RivalriesCardProps) {
  if (rivalries.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 'bold',
            }}
          >
            Rivalités
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              py: 4,
            }}
          >
            Pas encore de rivalités établies
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 'bold',
          }}
        >
          Rivalités
        </Typography>

        <List disablePadding>
          {rivalries.map((rivalry) => {
            const total = rivalry.wins + rivalry.losses;
            const winRate = total > 0 ? (rivalry.wins / total) * 100 : 50;

            return (
              <ListItem key={rivalry.opponentId} sx={{ px: 0 }}>
                <ListItemAvatar>
                  <Avatar>{rivalry.opponentName[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 'medium',
                        }}
                      >
                        {rivalry.opponentName}
                      </Typography>
                      <Typography variant="body2">
                        <Box
                          component="span"
                          sx={{ color: 'success.main', fontWeight: 'bold' }}
                        >
                          {rivalry.wins}
                        </Box>
                        {' - '}
                        <Box
                          component="span"
                          sx={{ color: 'error.main', fontWeight: 'bold' }}
                        >
                          {rivalry.losses}
                        </Box>
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <LinearProgress
                      variant="determinate"
                      value={winRate}
                      sx={{
                        mt: 1,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'error.light',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: 'success.main',
                          borderRadius: 3,
                        },
                      }}
                    />
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}
