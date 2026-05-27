'use client';

import {
  Add,
  ArrowBack,
  Delete,
  Edit,
  Upload,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Box,
  Button,
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
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  bulkImportEpisodes,
  deleteAnimeEpisode,
  deleteAnimeSource,
  getAnimeSeriesById,
  upsertAnimeEpisode,
  upsertAnimeSource,
} from '@/server/actions/anime';

interface Source {
  id: string;
  type: string;
  url: string;
  quality: string;
  language: string;
  priority: number;
  isActive: boolean;
}

interface Episode {
  id: string;
  number: number;
  title: string;
  titleFr: string | null;
  titleJp: string | null;
  synopsis: string | null;
  thumbnailUrl: string | null;
  duration: number;
  isPublished: boolean;
  sources: Source[];
  _count: { sources: number };
}

interface SeriesDetail {
  id: string;
  title: string;
  titleFr: string | null;
  slug: string;
  generation: string;
  episodeCount: number;
  episodes: Episode[];
}

const EMPTY_EP = {
  number: 1,
  title: '',
  titleFr: '',
  titleJp: '',
  synopsis: '',
  thumbnailUrl: '',
  duration: 0,
  isPublished: true,
};

const EMPTY_SOURCE: {
  type: 'YOUTUBE' | 'DAILYMOTION' | 'MP4' | 'HLS' | 'IFRAME';
  url: string;
  quality: string;
  language: string;
  priority: number;
  isActive: boolean;
} = {
  type: 'YOUTUBE',
  url: '',
  quality: '720p',
  language: 'VOSTFR',
  priority: 0,
  isActive: true,
};

export default function AdminAnimeSeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [seriesData, setSeriesData] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Episode dialog
  const [epDialogOpen, setEpDialogOpen] = useState(false);
  const [editEpId, setEditEpId] = useState<string | null>(null);
  const [epForm, setEpForm] = useState(EMPTY_EP);

  // Source dialog
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceEpisodeId, setSourceEpisodeId] = useState<string>('');
  const [editSourceId, setEditSourceId] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE);

  // Bulk import
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const data = await getAnimeSeriesById(seriesId);
    setSeriesData(data as SeriesDetail | null);
    setLoading(false);
  }, [seriesId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Episode handlers
  const handleNewEpisode = () => {
    setEditEpId(null);
    const nextNum = seriesData
      ? Math.max(0, ...seriesData.episodes.map((e) => e.number)) + 1
      : 1;
    setEpForm({ ...EMPTY_EP, number: nextNum });
    setEpDialogOpen(true);
  };

  const handleEditEpisode = (ep: Episode) => {
    setEditEpId(ep.id);
    setEpForm({
      number: ep.number,
      title: ep.title,
      titleFr: ep.titleFr || '',
      titleJp: ep.titleJp || '',
      synopsis: ep.synopsis || '',
      thumbnailUrl: ep.thumbnailUrl || '',
      duration: ep.duration,
      isPublished: ep.isPublished,
    });
    setEpDialogOpen(true);
  };

  const handleSaveEpisode = async () => {
    await upsertAnimeEpisode({
      id: editEpId || undefined,
      seriesId,
      ...epForm,
    });
    setEpDialogOpen(false);
    fetchData();
  };

  const handleDeleteEpisode = async (id: string) => {
    if (!confirm('Supprimer cet épisode et toutes ses sources ?')) return;
    await deleteAnimeEpisode(id);
    fetchData();
  };

  // Source handlers
  const handleNewSource = (episodeId: string) => {
    setEditSourceId(null);
    setSourceEpisodeId(episodeId);
    setSourceForm(EMPTY_SOURCE);
    setSourceDialogOpen(true);
  };

  const handleEditSource = (episodeId: string, source: Source) => {
    setEditSourceId(source.id);
    setSourceEpisodeId(episodeId);
    setSourceForm({
      type: source.type as 'YOUTUBE' | 'DAILYMOTION' | 'MP4' | 'HLS' | 'IFRAME',
      url: source.url,
      quality: source.quality,
      language: source.language,
      priority: source.priority,
      isActive: source.isActive,
    });
    setSourceDialogOpen(true);
  };

  const handleSaveSource = async () => {
    await upsertAnimeSource({
      id: editSourceId || undefined,
      episodeId: sourceEpisodeId,
      ...sourceForm,
    });
    setSourceDialogOpen(false);
    fetchData();
  };

  const handleDeleteSource = async (id: string) => {
    await deleteAnimeSource(id);
    fetchData();
  };

  // Bulk import
  const handleBulkImport = async () => {
    try {
      const episodes = JSON.parse(importJson);
      await bulkImportEpisodes(seriesId, episodes);
      setImportDialogOpen(false);
      setImportJson('');
      fetchData();
    } catch {
      alert(
        'JSON invalide. Format attendu : [{number, title, titleFr?, duration?}]',
      );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!seriesData) {
    return <Typography color="error">Série introuvable</Typography>;
  }

  return (
    <Box>
      <Button
        component={Link}
        href="/admin/anime"
        startIcon={<ArrowBack />}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Retour aux séries
      </Button>
      <PageHeader
        title={seriesData.titleFr || seriesData.title}
        description={`${seriesData.episodes.length} / ${seriesData.episodeCount} épisodes · ${seriesData.generation}`}
      >
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => setImportDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Import JSON
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleNewEpisode}
            sx={{ bgcolor: 'primary.main', borderRadius: 2 }}
          >
            Nouvel épisode
          </Button>
        </Stack>
      </PageHeader>
      {/* Episodes table */}
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
              <th>N°</th>
              <th>Titre</th>
              <th>Durée</th>
              <th>Sources</th>
              <th>Publié</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {seriesData.episodes.map((ep) => (
              <tr key={ep.id}>
                <td>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                    }}
                  >
                    {ep.number}
                  </Typography>
                </td>
                <td>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    {ep.titleFr || ep.title}
                  </Typography>
                  {ep.titleFr && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {ep.title}
                    </Typography>
                  )}
                </td>
                <td>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {ep.duration > 0
                      ? `${Math.floor(ep.duration / 60)}:${(ep.duration % 60).toString().padStart(2, '0')}`
                      : '-'}
                  </Typography>
                </td>
                <td>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      flexWrap: 'wrap',
                    }}
                  >
                    {ep.sources.map((src) => (
                      <Chip
                        key={src.id}
                        label={`${src.type} ${src.language}`}
                        size="small"
                        onClick={() => handleEditSource(ep.id, src)}
                        onDelete={() => handleDeleteSource(src.id)}
                        sx={{ fontSize: '0.65rem' }}
                      />
                    ))}
                    <Chip
                      icon={<Add sx={{ fontSize: '14px !important' }} />}
                      label="Ajouter"
                      size="small"
                      onClick={() => handleNewSource(ep.id)}
                      sx={{ fontSize: '0.65rem', cursor: 'pointer' }}
                    />
                  </Stack>
                </td>
                <td>
                  {ep.isPublished ? (
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
                      <IconButton
                        size="small"
                        onClick={() => handleEditEpisode(ep)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteEpisode(ep.id)}
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
      {/* Episode Dialog */}
      <Dialog
        open={epDialogOpen}
        onClose={() => setEpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editEpId ? `Modifier l'épisode ${epForm.number}` : 'Nouvel épisode'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Numéro"
              type="number"
              value={epForm.number}
              onChange={(e) =>
                setEpForm({ ...epForm, number: Number(e.target.value) })
              }
              size="small"
            />
            <TextField
              label="Titre (EN)"
              value={epForm.title}
              onChange={(e) => setEpForm({ ...epForm, title: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Titre (FR)"
              value={epForm.titleFr}
              onChange={(e) =>
                setEpForm({ ...epForm, titleFr: e.target.value })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Titre (JP)"
              value={epForm.titleJp}
              onChange={(e) =>
                setEpForm({ ...epForm, titleJp: e.target.value })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Synopsis"
              value={epForm.synopsis}
              onChange={(e) =>
                setEpForm({ ...epForm, synopsis: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label="URL Thumbnail"
              value={epForm.thumbnailUrl}
              onChange={(e) =>
                setEpForm({ ...epForm, thumbnailUrl: e.target.value })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Durée (secondes)"
              type="number"
              value={epForm.duration}
              onChange={(e) =>
                setEpForm({ ...epForm, duration: Number(e.target.value) })
              }
              size="small"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={epForm.isPublished}
                  onChange={(e) =>
                    setEpForm({ ...epForm, isPublished: e.target.checked })
                  }
                />
              }
              label="Publié"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEpDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveEpisode}
            sx={{ bgcolor: 'primary.main' }}
          >
            {editEpId ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Source Dialog */}
      <Dialog
        open={sourceDialogOpen}
        onClose={() => setSourceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editSourceId ? 'Modifier la source' : 'Nouvelle source'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={sourceForm.type}
                label="Type"
                onChange={(e) =>
                  setSourceForm({
                    ...sourceForm,
                    type: e.target.value as
                      | 'YOUTUBE'
                      | 'DAILYMOTION'
                      | 'MP4'
                      | 'HLS'
                      | 'IFRAME',
                  })
                }
              >
                <MenuItem value="YOUTUBE">YouTube</MenuItem>
                <MenuItem value="DAILYMOTION">Dailymotion</MenuItem>
                <MenuItem value="MP4">MP4</MenuItem>
                <MenuItem value="HLS">HLS</MenuItem>
                <MenuItem value="IFRAME">Iframe</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="URL"
              value={sourceForm.url}
              onChange={(e) =>
                setSourceForm({ ...sourceForm, url: e.target.value })
              }
              fullWidth
              size="small"
              helperText="YouTube: VIDEO_ID uniquement. HLS/MP4: URL complète"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Qualité"
                value={sourceForm.quality}
                onChange={(e) =>
                  setSourceForm({ ...sourceForm, quality: e.target.value })
                }
                size="small"
              />
              <TextField
                label="Langue"
                value={sourceForm.language}
                onChange={(e) =>
                  setSourceForm({ ...sourceForm, language: e.target.value })
                }
                size="small"
              />
              <TextField
                label="Priorité"
                type="number"
                value={sourceForm.priority}
                onChange={(e) =>
                  setSourceForm({
                    ...sourceForm,
                    priority: Number(e.target.value),
                  })
                }
                size="small"
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={sourceForm.isActive}
                  onChange={(e) =>
                    setSourceForm({ ...sourceForm, isActive: e.target.checked })
                  }
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSourceDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveSource}
            sx={{ bgcolor: 'primary.main' }}
          >
            {editSourceId ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Bulk Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Import JSON des épisodes</DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 2,
            }}
          >
            Format : [{`{`}&quot;number&quot;: 1, &quot;title&quot;:
            &quot;Episode 1&quot;, &quot;titleFr&quot;: &quot;Épisode 1&quot;,
            &quot;duration&quot;: 1440{`}`}]
          </Typography>
          <TextField
            multiline
            rows={10}
            fullWidth
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Collez votre JSON ici..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleBulkImport}
            sx={{ bgcolor: 'primary.main' }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
