'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { DatePicker } from '@/components/ui';
import {
  type Tournament,
  type TournamentStatus,
} from '@/lib/types';
import { type TournamentInput } from './actions';

interface TournamentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TournamentInput) => Promise<void>;
  initialData: Tournament | null;
  loading: boolean;
  categories: { id: string; name: string }[];
}

const TOURNAMENT_STATUSES: { value: TournamentStatus; label: string }[] = [
  { value: 'UPCOMING', label: 'À venir' },
  { value: 'REGISTRATION_OPEN', label: 'Inscriptions ouvertes' },
  { value: 'REGISTRATION_CLOSED', label: 'Inscriptions fermées' },
  { value: 'CHECKIN', label: 'Check-in en cours' },
  { value: 'UNDERWAY', label: 'En cours' },
  { value: 'COMPLETE', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

export function TournamentDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  loading,
  categories,
}: TournamentDialogProps) {
  const [formData, setFormData] = useState<
    Omit<TournamentInput, 'date'> & { date: Dayjs | null }
  >({
    name: '',
    description: '',
    date: dayjs(),
    location: '',
    format: '3on3 Double Elimination',
    maxPlayers: 64,
    status: 'UPCOMING',
    challongeUrl: '',
    categoryId: '',
    weight: 1.0,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        date: dayjs(initialData.date),
        location: initialData.location || '',
        format: initialData.format,
        maxPlayers: initialData.maxPlayers,
        status: initialData.status,
        challongeUrl: initialData.challongeUrl || '',
        categoryId: initialData.categoryId || '',
        weight: initialData.weight || 1.0,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        date: dayjs(),
        location: '',
        format: '3on3 Double Elimination',
        maxPlayers: 64,
        status: 'UPCOMING',
        challongeUrl: '',
        categoryId: '',
        weight: 1.0,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) return;

    await onSubmit({
      ...formData,
      date: formData.date.toDate(),
    } as TournamentInput);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {initialData ? 'Modifier le tournoi' : 'Nouveau tournoi'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Date du tournoi"
                  value={formData.date}
                  onChange={(newValue) =>
                    setFormData({ ...formData, date: newValue })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={formData.status}
                    label="Statut"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as TournamentStatus,
                      })
                    }
                  >
                    {TOURNAMENT_STATUSES.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Catégorie</InputLabel>
                  <Select
                    value={formData.categoryId || ''}
                    label="Catégorie"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        categoryId: e.target.value as string,
                      })
                    }
                  >
                    <MenuItem value="">Aucune (Poids manuel)</MenuItem>
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Poids (Multiplicateur)"
                  type="number"
                  disabled={!!formData.categoryId}
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weight: parseFloat(e.target.value) || 1.0,
                    })
                  }
                  fullWidth
                  size="small"
                  helperText={
                    formData.categoryId
                      ? 'Géré par la catégorie'
                      : 'Multiplicateur manuel'
                  }
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Lieu"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="Max Joueurs"
                  type="number"
                  value={formData.maxPlayers}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxPlayers: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="Format"
                  value={formData.format}
                  onChange={(e) =>
                    setFormData({ ...formData, format: e.target.value })
                  }
                  fullWidth
                  required
                />
              </Grid>
            </Grid>

            <TextField
              label="Lien Challonge (Optionnel)"
              value={formData.challongeUrl}
              onChange={(e) =>
                setFormData({ ...formData, challongeUrl: e.target.value })
              }
              fullWidth
              placeholder="https://challonge.com/..."
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !formData.date}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
