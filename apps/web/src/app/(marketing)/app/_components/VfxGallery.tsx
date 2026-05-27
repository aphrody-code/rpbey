'use client';

import { Pause, PlayArrow } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';

interface VfxSequence {
  name: string;
  frames: string[];
  category: string;
  description: string;
}

const VFX_SEQUENCES: VfxSequence[] = [
  {
    name: 'Battle Sparks',
    frames: Array.from(
      { length: 8 },
      (_, i) => `/app-assets/vfx/BattleScreen_Center_Sparks_Seq_${i}.webp`,
    ),
    category: 'combat',
    description: "Étincelles centrales de l'arène de combat",
  },
  {
    name: 'Point Appearing',
    frames: Array.from(
      { length: 15 },
      (_, i) => `/app-assets/vfx/PointAppearing_Seq_${i}.webp`,
    ),
    category: 'ui',
    description: "Animation d'apparition des points de score",
  },
  {
    name: 'Lightning Strike',
    frames: Array.from(
      { length: 30 },
      (_, i) => `/app-assets/vfx/V_SEQ_Lightning_UI_${i}.webp`,
    ),
    category: 'combat',
    description: "Éclair d'attaque (30 frames)",
  },
  {
    name: 'Lightning Strike (Variant)',
    frames: Array.from(
      { length: 10 },
      (_, i) => `/app-assets/vfx/V_SEQ_Lightning_UI_${i}_1.webp`,
    ),
    category: 'combat',
    description: "Variante éclair d'attaque",
  },
  {
    name: 'XP Bar Fill',
    frames: Array.from(
      { length: 15 },
      (_, i) => `/app-assets/vfx/V_XPBar_SpriteSheet_${i}.webp`,
    ),
    category: 'ui',
    description: "Remplissage de la barre d'XP",
  },
  {
    name: 'XP Raise Surge',
    frames: Array.from(
      { length: 11 },
      (_, i) => `/app-assets/vfx/V_XPBar_Raise_SpriteSheet_${i}.webp`,
    ),
    category: 'ui',
    description: "Effet de gain d'XP",
  },
  {
    name: 'MiniGame Orb',
    frames: Array.from(
      { length: 15 },
      (_, i) => `/app-assets/vfx/V_MiniGame_Orb_SpriteSheet_${i}.webp`,
    ),
    category: 'booster',
    description: 'Animation orbe du mini-jeu / ouverture booster',
  },
  {
    name: 'Spark Burst 1',
    frames: Array.from(
      { length: 6 },
      (_, i) => `/app-assets/vfx/V_SEQ_Spark_0${i + 1}.webp`,
    ),
    category: 'combat',
    description: "Rafale d'étincelles d'impact",
  },
  {
    name: 'End Sparks',
    frames: Array.from(
      { length: 3 },
      (_, i) => `/app-assets/vfx/V_SEQ_End_Sparks_Alph_${i}.webp`,
    ),
    category: 'combat',
    description: 'Étincelles de fin de combat',
  },
  {
    name: 'Hit Manga',
    frames: Array.from(
      { length: 3 },
      (_, i) => `/app-assets/vfx/V_SEQ_Hit_Manga_01_${i}.webp`,
    ),
    category: 'combat',
    description: 'Impact style manga',
  },
  {
    name: 'Bey Explode Hit',
    frames: Array.from(
      { length: 2 },
      (_, i) => `/app-assets/vfx/V_SEQ_Bey_Explode_Hit_${i}.webp`,
    ),
    category: 'combat',
    description: "Explosion d'un Beyblade à l'impact",
  },
  {
    name: 'Fire Burst',
    frames: Array.from(
      { length: 7 },
      (_, i) => `/app-assets/vfx/V_Fire_04_${i}.webp`,
    ),
    category: 'element',
    description: 'Explosion de feu (type Attaque)',
  },
  {
    name: 'Electric Cards Reveal',
    frames: Array.from(
      { length: 64 },
      (_, i) => `/app-assets/vfx/vfx_UI_ElectricCards_${i}.webp`,
    ),
    category: 'booster',
    description:
      'Révélation de carte électrique — animation booster/invocation (64 frames)',
  },
  {
    name: 'Electric Cards 2',
    frames: Array.from(
      { length: 64 },
      (_, i) => `/app-assets/vfx/vfx_UI_ElectricCards02_${i}.webp`,
    ),
    category: 'booster',
    description: 'Variante de révélation de carte (64 frames)',
  },
  {
    name: 'Electric Cards 3',
    frames: Array.from(
      { length: 16 },
      (_, i) => `/app-assets/vfx/vfx_UI_ElectricCards03_${i}.webp`,
    ),
    category: 'booster',
    description: 'Effet électrique final de révélation',
  },
];

const CATEGORIES = [
  { label: 'Toutes', value: 'all' },
  { label: 'Booster / Invocation', value: 'booster', color: '#f59e0b' },
  { label: 'Combat', value: 'combat', color: '#ef4444' },
  { label: 'Éléments', value: 'element', color: '#22c55e' },
  { label: 'UI', value: 'ui', color: '#3b82f6' },
];

function AnimatedPreview({ sequence }: { sequence: VfxSequence }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const validFrames = useRef<string[]>(sequence.frames);

  const catColor =
    CATEGORIES.find((c) => c.value === sequence.category)?.color || '#888';

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setFrame((f) => (f + 1) % validFrames.current.length);
      }, 42);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s',
          borderColor: alpha(catColor, 0.15),
          '&:hover': {
            borderColor: catColor,
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 24px ${alpha(catColor, 0.2)}`,
          },
        }}
        onClick={() => setDialogOpen(true)}
      >
        {/* Animation canvas */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            bgcolor: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={sequence.frames[frame]}
            alt={`${sequence.name} frame ${frame}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          {/* Play/Pause overlay */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setPlaying(!playing);
            }}
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              bgcolor: alpha('#000', 0.6),
              color: '#fff',
              '&:hover': { bgcolor: alpha('#000', 0.8) },
            }}
          >
            {playing ? (
              <Pause sx={{ fontSize: 16 }} />
            ) : (
              <PlayArrow sx={{ fontSize: 16 }} />
            )}
          </IconButton>

          {/* Frame counter */}
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              bgcolor: alpha('#000', 0.6),
              color: '#fff',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: '0.6rem',
              fontWeight: 900,
              fontFamily: 'monospace',
            }}
          >
            {frame + 1}/{sequence.frames.length}
          </Box>
        </Box>

        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: '900',
                flex: 1,
              }}
            >
              {sequence.name}
            </Typography>
            <Chip
              label={sequence.category}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 900,
                bgcolor: alpha(catColor, 0.15),
                color: catColor,
                textTransform: 'uppercase',
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.7rem',
            }}
          >
            {sequence.description}
          </Typography>
        </CardContent>
      </Card>
      {/* Full-size dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        slotProps={{
          paper: {
            sx: { bgcolor: '#000', borderRadius: 3, overflow: 'hidden' },
          },
        }}
      >
        <DialogContent
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: '900',
              color: '#fff',
            }}
          >
            {sequence.name}
          </Typography>
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={sequence.frames[frame]}
              alt={`${sequence.name} frame ${frame}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={() => setPlaying(!playing)}
              sx={{ color: '#fff' }}
            >
              {playing ? <Pause /> : <PlayArrow />}
            </IconButton>
            <Typography
              variant="caption"
              sx={{ color: '#888', fontFamily: 'monospace' }}
            >
              Frame {frame + 1} / {sequence.frames.length}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ color: '#aaa', textAlign: 'center' }}
          >
            {sequence.description}
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StaticVfxGrid() {
  const [assets, setAssets] = useState<{ name: string; path: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/app-assets?type=vfx')
      .then((r) => r.json())
      .then((data) => {
        // Filter to show only non-sequence files (single images)
        const singles = (data.assets || []).filter(
          (a: { name: string }) =>
            !/_\d+\.\w+$/.test(a.name) &&
            !/_\d\.\w+$/.test(a.name) &&
            !/Seq_\d/.test(a.name) &&
            !/SpriteSheet_\d/.test(a.name) &&
            !/ElectricCards/.test(a.name),
        );
        setAssets(singles);
      })
      .catch(() => setAssets([]));
  }, []);

  if (assets.length === 0) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: '900',
          mb: 2,
        }}
      >
        Textures VFX individuelles ({assets.length})
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
            md: 'repeat(6, 1fr)',
            lg: 'repeat(8, 1fr)',
          },
          gap: 1,
        }}
      >
        {assets.slice(0, 120).map((asset) => (
          <Box
            key={asset.name}
            sx={{
              aspectRatio: '1',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#0a0a0a',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'scale(1.05)',
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
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
        ))}
      </Box>
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
        slotProps={{
          paper: { sx: { bgcolor: '#000', borderRadius: 3 } },
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
              alt="VFX"
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

export function VfxGallery() {
  const [category, setCategory] = useState('all');

  const filtered =
    category === 'all'
      ? VFX_SEQUENCES
      : VFX_SEQUENCES.filter((s) => s.category === category);

  return (
    <Box>
      {/* Category filter */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 3 }}>
        {CATEGORIES.map((cat) => {
          const count =
            cat.value === 'all'
              ? VFX_SEQUENCES.length
              : VFX_SEQUENCES.filter((s) => s.category === cat.value).length;
          return (
            <Chip
              key={cat.value}
              label={`${cat.label} (${count})`}
              clickable
              onClick={() => setCategory(cat.value)}
              sx={{
                fontWeight: 900,
                fontSize: '0.75rem',
                borderRadius: 2,
                bgcolor:
                  category === cat.value
                    ? cat.color || 'text.primary'
                    : 'transparent',
                color: category === cat.value ? '#fff' : 'text.secondary',
                border: '1px solid',
                borderColor:
                  category === cat.value
                    ? cat.color || 'text.primary'
                    : 'divider',
              }}
            />
          );
        })}
      </Box>

      {/* Animated sequences grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {filtered.map((seq) => (
          <AnimatedPreview key={seq.name} sequence={seq} />
        ))}
      </Box>

      {/* Static VFX textures */}
      <StaticVfxGrid />
    </Box>
  );
}
