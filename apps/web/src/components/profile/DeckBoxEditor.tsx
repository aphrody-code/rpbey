'use client';

import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';

interface DeckBoxEditorProps {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

interface Sticker {
  id: string;
  x: number;
  y: number;
  scale: number;
  color: string;
}

// Brand colors reference CSS variables so they adapt to the active theme
const COLORS = [
  { name: 'Primaire', cssVar: '--rpb-primary' },
  { name: 'Secondaire', cssVar: '--rpb-secondary' },
  { name: 'Blanc', cssVar: null, hex: '#ffffff' },
  { name: 'Noir', cssVar: null, hex: '#000000' },
  { name: 'Bleu', cssVar: null, hex: '#3b82f6' },
];

function resolveColor(c: (typeof COLORS)[number]): string {
  if (c.cssVar) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(c.cssVar)
      .trim();
  }
  return c.hex!;
}

export function DeckBoxEditor({
  open,
  imageUrl,
  onClose,
  onSave,
}: DeckBoxEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  // Load images
  useEffect(() => {
    const bg = new Image();
    bg.src = imageUrl;
    bg.crossOrigin = 'anonymous';
    bg.onload = () => setBgImage(bg);

    const logo = new Image();
    logo.src = '/logo.webp';
    logo.crossOrigin = 'anonymous';
    logo.onload = () => setLogoImage(logo);
  }, [imageUrl]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage || !logoImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas to image size
    canvas.width = 600; // Fixed work width
    const ratio = bgImage.height / bgImage.width;
    canvas.height = canvas.width * ratio;

    // Draw BG
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // Draw Stickers
    stickers.forEach((sticker) => {
      ctx.save();
      ctx.translate(sticker.x, sticker.y);
      ctx.scale(sticker.scale, sticker.scale);

      // Draw tinted logo
      // 1. Draw logo to an offscreen canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = logoImage.width;
      tempCanvas.height = logoImage.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(logoImage, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = sticker.color;
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      }

      // Draw centered
      ctx.drawImage(tempCanvas, -logoImage.width / 2, -logoImage.height / 2);

      // Selection indicator
      if (sticker.id === selectedStickerId) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 5 / sticker.scale;
        ctx.strokeRect(
          -logoImage.width / 2,
          -logoImage.height / 2,
          logoImage.width,
          logoImage.height,
        );
      }

      ctx.restore();
    });
  }, [bgImage, logoImage, stickers, selectedStickerId]);

  // Mouse Interaction
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e
        ? e.touches[0]?.clientX || 0
        : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e
        ? e.touches[0]?.clientY || 0
        : (e as React.MouseEvent).clientY;

    // Map screen coords to canvas internal coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);

    // Hit test (reverse order to pick top-most)
    const clickedSticker = [...stickers].reverse().find((s) => {
      // Simple box check (assuming logo is ~500x500 base but scaled)
      // We need the real size relative to scale.
      // logoImage is loaded, let's assume it's roughly square or use 200 as base size if not loaded yet
      const w = (logoImage?.width || 200) * s.scale;
      const h = (logoImage?.height || 200) * s.scale;
      return (
        pos.x >= s.x - w / 2 &&
        pos.x <= s.x + w / 2 &&
        pos.y >= s.y - h / 2 &&
        pos.y <= s.y + h / 2
      );
    });

    if (clickedSticker) {
      setSelectedStickerId(clickedSticker.id);
      isDragging.current = true;
      lastPos.current = pos;
    } else {
      setSelectedStickerId(null);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !selectedStickerId) return;
    // Prevent scrolling on touch
    if ('touches' in e) {
      // e.preventDefault(); // Can't prevent default in passive listener? React handles this mostly.
    }

    const pos = getPos(e);
    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;

    setStickers((prev) =>
      prev.map((s) =>
        s.id === selectedStickerId ? { ...s, x: s.x + dx, y: s.y + dy } : s,
      ),
    );

    lastPos.current = pos;
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  const addSticker = (color: string) => {
    if (!canvasRef.current) return;
    const id = crypto.randomUUID();
    const newSticker: Sticker = {
      id,
      x: canvasRef.current.width / 2,
      y: canvasRef.current.height / 2,
      scale: 0.2, // Start small
      color,
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(id);
  };

  const updateSelectedScale = (newScale: number) => {
    if (!selectedStickerId) return;
    setStickers((prev) =>
      prev.map((s) =>
        s.id === selectedStickerId ? { ...s, scale: newScale } : s,
      ),
    );
  };

  const removeSelected = () => {
    if (!selectedStickerId) return;
    setStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Deselect to remove the border
    setSelectedStickerId(null);

    // Need a tick to redraw without border?
    // We can just force a redraw in the toBlob callback or use a ref to skip drawing selection
    // But React state update is async.
    // Hack: we need to wait for the state update to clear selection, then capture.
    // Or simpler: pass a flag to the draw function?
    // Let's just redraw immediately on the canvas context manually for saving.

    // Actually, just clearing the ID and waiting a minimal timeout is standard in React.
    setTimeout(() => {
      canvas.toBlob(
        (blob) => {
          if (blob) onSave(blob);
        },
        'image/jpeg',
        0.9,
      );
    }, 50);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Personnaliser la Deck Box</DialogTitle>
      <DialogContent>
        <Stack
          spacing={2}
          sx={{
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              bgcolor: '#111',
              borderRadius: 2,
              overflow: 'hidden',
              touchAction: 'none', // Prevent scrolling while dragging
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', height: 'auto' }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </Box>

          {/* Controls */}
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" gutterBottom>
              Ajouter un Logo RPB
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {COLORS.map((c) => (
                <Box
                  key={c.name}
                  onClick={() => addSticker(resolveColor(c))}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: c.cssVar ? `var(${c.cssVar})` : c.hex,
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    '&:hover': { transform: 'scale(1.1)' },
                  }}
                  title={c.name}
                />
              ))}
            </Stack>

            {selectedStickerId && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <ZoomOutIcon color="action" />
                  <Slider
                    size="small"
                    min={0.05}
                    max={1.0}
                    step={0.01}
                    value={
                      stickers.find((s) => s.id === selectedStickerId)?.scale ||
                      0.2
                    }
                    onChange={(_, v) => updateSelectedScale(v as number)}
                    sx={{ flexGrow: 1 }}
                  />
                  <ZoomInIcon color="action" />
                  <IconButton onClick={removeSelected} color="error">
                    <CloseIcon />
                  </IconButton>
                </Stack>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
        >
          Appliquer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
