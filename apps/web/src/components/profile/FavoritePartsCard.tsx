/**
 * RPB - Favorite Parts Card Component
 * Displays most used Beyblade parts
 */

'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type UserStats } from '@/lib/stats-types';

interface FavoritePartsCardProps {
  blades: UserStats['mostUsedBlades'];
  ratchets: UserStats['mostUsedRatchets'];
  bits: UserStats['mostUsedBits'];
}

function PartSection({
  title,
  color,
  parts,
}: {
  title: string;
  color: 'primary' | 'secondary' | 'success';
  parts: { partId: string; name: string; count: number }[];
}) {
  if (parts.length === 0) {
    return (
      <Box>
        <Typography
          variant="subtitle2"
          gutterBottom
          sx={{
            color: 'text.secondary',
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
          Aucune donnée
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="subtitle2"
        gutterBottom
        sx={{
          color: 'text.secondary',
        }}
      >
        {title}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          flexWrap: 'wrap',
        }}
      >
        {parts.map((part, index) => (
          <Chip
            key={part.partId}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{part.name}</span>
                <Box
                  component="span"
                  sx={{
                    bgcolor: 'action.hover',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                  }}
                >
                  ×{part.count}
                </Box>
              </Box>
            }
            color={index === 0 ? color : 'default'}
            variant={index === 0 ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
      </Stack>
    </Box>
  );
}

export function FavoritePartsCard({
  blades,
  ratchets,
  bits,
}: FavoritePartsCardProps) {
  const hasData = blades.length > 0 || ratchets.length > 0 || bits.length > 0;

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
          Pièces favorites
        </Typography>

        {!hasData ? (
          <Typography
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              py: 4,
            }}
          >
            Aucune pièce utilisée pour le moment
          </Typography>
        ) : (
          <Stack spacing={2} divider={<Divider />}>
            <PartSection title="Blades" color="primary" parts={blades} />
            <PartSection title="Ratchets" color="secondary" parts={ratchets} />
            <PartSection title="Bits" color="success" parts={bits} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
