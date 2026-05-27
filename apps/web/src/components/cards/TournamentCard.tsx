'use client';

import { CalendarMonth, Group } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { TrophyIcon } from '@/components/ui/Icons';
import {
  type TournamentStatus,
  TournamentStatusChip,
} from '@/components/ui/StatusChip';
import { formatDateShort } from '@/lib/utils';

interface TournamentCardProps {
  id: string;
  name: string;
  description?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  status: TournamentStatus;
  maxParticipants?: number | null;
  currentParticipants?: number;
  categoryColor?: string | null;
  categoryLogo?: string | null;
  categoryName?: string | null;
  onClick?: () => void;
  onRegister?: () => void;
  showActions?: boolean;
}

export function TournamentCard({
  name,
  description,
  startDate,
  endDate,
  status,
  maxParticipants,
  currentParticipants = 0,
  categoryColor,
  categoryLogo,
  categoryName,
  onClick,
  onRegister,
  showActions = true,
}: TournamentCardProps) {
  const formattedStartDate = formatDateShort(new Date(startDate));
  const formattedEndDate = endDate ? formatDateShort(new Date(endDate)) : null;
  const isRegistrationOpen = status === 'registration_open';
  const isFull = maxParticipants
    ? currentParticipants >= maxParticipants
    : false;

  const cardContent = (
    <>
      <CardContent sx={{ pb: showActions ? 1 : 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 1,
            mb: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 0,
              flex: 1,
            }}
          >
            {categoryLogo && (
              <Box
                sx={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: categoryColor
                    ? `2px solid ${alpha(categoryColor, 0.35)}`
                    : '2px solid rgba(255,255,255,0.1)',
                  bgcolor: categoryColor
                    ? alpha(categoryColor, 0.08)
                    : 'transparent',
                }}
              >
                <Image
                  src={categoryLogo}
                  alt={categoryName ?? 'Catégorie'}
                  fill
                  sizes="36px"
                  style={{ objectFit: 'contain', padding: 2 }}
                />
              </Box>
            )}
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, minWidth: 0 }}
            >
              {name}
            </Typography>
          </Box>
          <TournamentStatusChip status={status} />
        </Box>

        {description && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<CalendarMonth />}
            label={
              formattedEndDate
                ? `${formattedStartDate} - ${formattedEndDate}`
                : formattedStartDate
            }
            size="small"
            variant="outlined"
          />

          {maxParticipants && (
            <Chip
              icon={<Group />}
              label={`${currentParticipants}/${maxParticipants}`}
              size="small"
              variant="outlined"
              color={isFull ? 'error' : 'default'}
            />
          )}
        </Box>
      </CardContent>

      {showActions && (
        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Button size="small" onClick={onClick}>
            Voir détails
          </Button>
          {isRegistrationOpen && !isFull && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<TrophyIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onRegister?.();
              }}
            >
              S&apos;inscrire
            </Button>
          )}
        </CardActions>
      )}
    </>
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

  return <Card sx={{ height: '100%' }}>{cardContent}</Card>;
}

// Grid variant for list views
interface TournamentCardGridProps {
  tournaments: TournamentCardProps[];
  onTournamentClick?: (id: string) => void;
  onRegister?: (id: string) => void;
}

import { useRouter } from 'next/navigation';

export function TournamentCardGrid({
  tournaments,
  onTournamentClick,
  onRegister,
}: TournamentCardGridProps) {
  const router = useRouter();

  return (
    <Grid container spacing={3}>
      {tournaments.map((tournament) => (
        <Grid key={tournament.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <TournamentCard
            {...tournament}
            onClick={
              onTournamentClick
                ? () => onTournamentClick(tournament.id)
                : () => router.push(`/tournaments/${tournament.id}`)
            }
            onRegister={() => onRegister?.(tournament.id)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
