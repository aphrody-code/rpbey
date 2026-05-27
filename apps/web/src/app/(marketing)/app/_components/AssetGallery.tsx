'use client';

import { Collections, FilterList, ViewModule } from '@mui/icons-material';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  ImageList,
  ImageListItem,
  Paper,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useState } from 'react';

interface AssetFile {
  name: string;
  path: string;
  category: string;
}

const TEXTURE_CATEGORIES = [
  { label: 'Toutes', value: 'all' },
  { label: 'Blades', value: 'blade' },
  { label: 'Ratchets', value: 'ratchet' },
  { label: 'Bits', value: 'bit' },
  { label: 'Arènes', value: 'arena' },
  { label: 'PowerCores', value: 'powercore' },
  { label: 'Battlepass', value: 'battlepass' },
  { label: 'Frames & Portraits', value: 'frame' },
  { label: 'Augments', value: 'augment' },
  { label: 'Badges', value: 'badge' },
  { label: 'Clan & Exhibition', value: 'clan' },
  { label: 'UI', value: 'ui' },
  { label: 'Marketing', value: 'marketing' },
];

export function AssetGallery() {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [assetType, setAssetType] = useState<
    'textures' | 'sprites' | 'marketing'
  >('textures');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cols, setCols] = useState(4);

  // Set responsive default on mount (avoids SSR hydration mismatch)
  useEffect(() => {
    if (window.innerWidth < 600) setCols(2);
  }, []);

  useEffect(() => {
    async function loadAssets() {
      setLoading(true);
      try {
        const response = await fetch(`/api/app-assets?type=${assetType}`);
        if (response.ok) {
          const data = await response.json();
          setAssets(data.assets || []);
        }
      } catch {
        // Fallback: empty
        setAssets([]);
      }
      setLoading(false);
    }
    loadAssets();
  }, [assetType]);

  const filtered =
    category === 'all' ? assets : assets.filter((a) => a.category === category);

  return (
    <Box>
      {/* Asset type selector */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Tabs
          value={assetType}
          onChange={(_, v) => setAssetType(v)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 900,
              fontSize: '0.8rem',
              textTransform: 'none',
            },
          }}
        >
          <Tab label="Textures (2 765)" value="textures" />
          <Tab label="Sprites (1 097)" value="sprites" />
          <Tab label="Marketing (9)" value="marketing" />
        </Tabs>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={cols}
            exclusive
            onChange={(_, v) => v && setCols(v)}
            size="small"
          >
            <ToggleButton value={3}>
              <ViewModule sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value={4}>
              <Collections sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value={6}>
              <FilterList sx={{ fontSize: 18 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      {/* Category filters */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 3 }}>
        {TEXTURE_CATEGORIES.map((cat) => {
          const count =
            cat.value === 'all'
              ? assets.length
              : assets.filter((a) => a.category === cat.value).length;
          return (
            <Chip
              key={cat.value}
              label={`${cat.label} (${count})`}
              clickable
              onClick={() => setCategory(cat.value)}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                borderRadius: 2,
                bgcolor:
                  category === cat.value ? 'text.primary' : 'transparent',
                color:
                  category === cat.value
                    ? 'background.paper'
                    : 'text.secondary',
                border: '1px solid',
                borderColor:
                  category === cat.value ? 'text.primary' : 'divider',
              }}
            />
          );
        })}
      </Box>
      {/* Results count */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          mb: 2,
          display: 'block',
        }}
      >
        {filtered.length} fichier{filtered.length !== 1 ? 's' : ''}
      </Typography>
      {/* Gallery grid */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography
            sx={{
              color: 'text.disabled',
            }}
          >
            Chargement des assets...
          </Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography
            sx={{
              color: 'text.disabled',
            }}
          >
            Aucun asset dans cette catégorie
          </Typography>
        </Box>
      ) : (
        <ImageList variant="masonry" cols={cols} gap={8}>
          {filtered.slice(0, 200).map((asset) => (
            <ImageListItem
              key={asset.name}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'scale(1.02)',
                  zIndex: 1,
                },
              }}
              onClick={() => setSelectedImage(asset.path)}
            >
              <img
                src={asset.path}
                alt={asset.name}
                loading="lazy"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  backgroundColor: '#111',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  px: 1,
                  py: 0.5,
                  bgcolor: alpha('#000', 0.7),
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: '#fff',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {asset.name}
                </Typography>
              </Box>
            </ImageListItem>
          ))}
        </ImageList>
      )}
      {filtered.length > 200 && (
        <Paper
          sx={{
            textAlign: 'center',
            py: 3,
            mt: 2,
            borderRadius: 3,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.1),
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Affichage limité à 200 fichiers — {filtered.length - 200} fichiers
            supplémentaires disponibles
          </Typography>
        </Paper>
      )}
      {/* Full-size image dialog */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#000',
              borderRadius: 3,
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSelectedImage(null)}
        >
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Asset preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
