'use client';

import { Leaderboard, People, SmartToy } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui';
import { TrophyIcon } from '@/components/ui/Icons';

export function QuickActions() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartBot = async () => {
    if (!confirm('Êtes-vous sûr de vouloir redémarrer le bot ?')) return;

    setIsRestarting(true);
    try {
      const response = await fetch('/api/admin/bot/restart', {
        method: 'POST',
      });

      if (response.ok) {
        showToast('Redémarrage du bot demandé...', 'success');
      } else {
        showToast('Erreur lors du redémarrage du bot', 'error');
      }
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setIsRestarting(false);
    }
  };

  const actions = [
    {
      label: 'Créer un tournoi',
      icon: TrophyIcon,
      onClick: () => router.push('/admin/tournaments?action=new'),
    },
    {
      label: 'Gérer les utilisateurs',
      icon: People,
      onClick: () => router.push('/admin/users'),
    },
    {
      label: 'Ajuster les points',
      icon: Leaderboard,
      onClick: () => router.push('/admin/rankings'),
    },
    {
      label: isRestarting ? 'Redémarrage...' : 'Redémarrer le bot',
      icon: SmartToy,
      onClick: handleRestartBot,
      disabled: isRestarting,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Box
            key={action.label}
            onClick={action.onClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              opacity: action.disabled ? 0.6 : 1,
              transition: 'all 0.2s',
              '&:hover': action.disabled
                ? {}
                : {
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
            }}
          >
            <Icon fontSize="small" />
            <Typography variant="body2">{action.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
