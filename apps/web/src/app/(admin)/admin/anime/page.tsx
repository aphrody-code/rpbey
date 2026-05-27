'use client';

import {
  Add,
  Delete,
  Edit,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  deleteAnimeSeries,
  getAllAnimeSeries,
  upsertAnimeSeries,
} from '@/server/actions/anime';

const GENERATION_COLORS: Record<string, string> = {
  ORIGINAL: '#1565C0',
  METAL: '#E65100',
  BURST: '#C62828',
  X: '#7B1FA2',
};

interface Series {
  id: string;
  slug: string;
  title: string;
  titleFr: string | null;
  titleJp: string | null;
  generation: string;
  synopsis: string | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  year: number;
  episodeCount: number;
  sortOrder: number;
  isPublished: boolean;
  _count: { episodes: number };
}

const EMPTY_FORM: {
  slug: string;
  title: string;
  titleJp: string;
  titleFr: string;
  generation: 'ORIGINAL' | 'METAL' | 'BURST' | 'X';
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  year: number;
  episodeCount: number;
  sortOrder: number;
  isPublished: boolean;
} = {
  slug: '',
  title: '',
  titleJp: '',
  titleFr: '',
  generation: 'X',
  synopsis: '',
  posterUrl: '',
  bannerUrl: '',
  year: 2024,
  episodeCount: 0,
  sortOrder: 0,
  isPublished: true,
};

export default function AdminAnimePage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    const data = await getAllAnimeSeries();
    setSeries(data as Series[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const handleOpenNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (s: Series) => {
    setEditId(s.id);
    setForm({
      slug: s.slug,
      title: s.title,
      titleJp: s.titleJp || '',
      titleFr: s.titleFr || '',
      generation: s.generation as 'ORIGINAL' | 'METAL' | 'BURST' | 'X',
      synopsis: s.synopsis || '',
      posterUrl: s.posterUrl || '',
      bannerUrl: s.bannerUrl || '',
      year: s.year,
      episodeCount: s.episodeCount,
      sortOrder: s.sortOrder,
      isPublished: s.isPublished,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    await upsertAnimeSeries({
      id: editId || undefined,
      ...form,
    });
    setDialogOpen(false);
    fetchSeries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette série et tous ses épisodes ?')) return;
    await deleteAnimeSeries(id);
    fetchSeries();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="GESTION ANIME"
        description={`${series.length} séries`}
        actionLabel="Nouvelle série"
        onAction={handleOpenNew}
      />
      {/* Series table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              p: 1.5,
              textAlign: 'left',
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& th': {
              fontWeight: 700,
              color: 'text.secondary',
              fontSize: '0.8rem',
            },
          }}
        >
          <thead>
            <tr>
              <th>#</th>
              <th>Titre</th>
              <th>Génération</th>
              <th>Année</th>
              <th>Épisodes</th>
              <th>Publié</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.id}>
                <td>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {s.sortOrder}
                  </Typography>
                </td>
                <td>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    {s.titleFr || s.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {s.slug}
                  </Typography>
                </td>
                <td>
                  <Chip
                    label={s.generation}
                    size="small"
                    sx={{
                      bgcolor: GENERATION_COLORS[s.generation],
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}
                  />
                </td>
                <td>{s.year}</td>
                <td>
                  <Link
                    href={`/admin/anime/${s.id}`}
                    style={{ color: 'var(--rpb-primary)', fontWeight: 600 }}
                  >
                    {s._count.episodes} / {s.episodeCount}
                  </Link>
                </td>
                <td>
                  {s.isPublished ? (
                    <Visibility sx={{ color: 'success.main', fontSize: 20 }} />
                  ) : (
                    <VisibilityOff
                      sx={{ color: 'text.secondary', fontSize: 20 }}
                    />
                  )}
                </td>
                <td>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Modifier">
                      <IconButton size="small" onClick={() => handleEdit(s)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Gérer les épisodes">
                      <IconButton
                        size="small"
                        component={Link}
                        href={`/admin/anime/${s.id}`}
                      >
                        <Add fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(s.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      {/* Series Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3, bgcolor: 'background.paper' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editId ? 'Modifier la série' : 'Nouvelle série'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Titre (EN)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Titre (FR)"
              value={form.titleFr}
              onChange={(e) => setForm({ ...form, titleFr: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Titre (JP)"
              value={form.titleJp}
              onChange={(e) => setForm({ ...form, titleJp: e.target.value })}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Génération</InputLabel>
              <Select
                value={form.generation}
                label="Génération"
                onChange={(e) =>
                  setForm({
                    ...form,
                    generation: e.target.value as
                      | 'ORIGINAL'
                      | 'METAL'
                      | 'BURST'
                      | 'X',
                  })
                }
              >
                <MenuItem value="ORIGINAL">Original</MenuItem>
                <MenuItem value="METAL">Metal</MenuItem>
                <MenuItem value="BURST">Burst</MenuItem>
                <MenuItem value="X">X</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Synopsis"
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Année"
                type="number"
                value={form.year}
                onChange={(e) =>
                  setForm({ ...form, year: Number(e.target.value) })
                }
                size="small"
              />
              <TextField
                label="Nb épisodes"
                type="number"
                value={form.episodeCount}
                onChange={(e) =>
                  setForm({ ...form, episodeCount: Number(e.target.value) })
                }
                size="small"
              />
              <TextField
                label="Ordre"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
                size="small"
              />
            </Stack>
            <TextField
              label="URL Poster"
              value={form.posterUrl}
              onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="URL Bannière"
              value={form.bannerUrl}
              onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
              fullWidth
              size="small"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                />
              }
              label="Publié"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            sx={{ bgcolor: 'primary.main' }}
          >
            {editId ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
