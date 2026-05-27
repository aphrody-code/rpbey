'use client';

import { Close } from '@mui/icons-material';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { type Part } from '@/lib/types';

function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width:599px)');
    setMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const TYPE_COLORS: Record<string, string> = {
  ATTACK: '#ef4444',
  DEFENSE: '#3b82f6',
  STAMINA: '#22c55e',
  BALANCE: '#a855f7',
};

const STAT_LABELS: Record<string, { label: string; color: string }> = {
  attack: { label: 'ATK', color: '#ef4444' },
  defense: { label: 'DEF', color: '#3b82f6' },
  stamina: { label: 'END', color: '#22c55e' },
  dash: { label: 'DSH', color: '#fbbf24' },
  burst: { label: 'BRS', color: '#a855f7' },
};

const SYSTEM_LABELS: Record<string, string> = {
  BX: 'Xtreme',
  UX: 'Ultimate',
  CX: 'Custom',
  COLLAB: 'Collab',
};

function parseStat(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

function getPartTextures(part: Part): string[] {
  if (part.textureUrl) return [part.textureUrl];

  const name = part.name.replace(/\s+/g, '');
  const basePath = '/app-assets/textures/';
  const textures: string[] = [];

  if (part.type === 'BLADE' || part.type === 'OVER_BLADE') {
    textures.push(`${basePath}${name}_Blade_AO.webp`);
    textures.push(`${basePath}${name}_EdgeMask.webp`);
  } else if (part.type === 'RATCHET') {
    const ratchetName = `Ratchet${part.name.replace(/\s+/g, '')}`;
    textures.push(`${basePath}${ratchetName}_AO.webp`);
    textures.push(`${basePath}${ratchetName}_EdgeMask.webp`);
  } else if (part.type === 'BIT') {
    // Bits use code format: "A (Accel)" → "Bit_A"
    const codeMatch = part.name.match(/^(\w+)\s*\(/);
    const bitName = codeMatch ? `Bit_${codeMatch[1]}` : `Bit_${name}`;
    textures.push(`${basePath}${bitName}_AO.webp`);
    textures.push(`${basePath}${bitName}_EdgeMask.webp`);
  } else if (part.type === 'ASSIST_BLADE') {
    const codeMatch = part.name.match(/^(\w+)\s*\(/);
    const abName = codeMatch ? `AuxBlade_${codeMatch[1]}` : `AuxBlade_${name}`;
    textures.push(`${basePath}${abName}_AO.webp`);
    textures.push(`${basePath}${abName}_EdgeMask.webp`);
  }

  return textures;
}

interface PartCardProps {
  part: Part;
  onSelect: (part: Part) => void;
}

function PartCard({ part, onSelect }: PartCardProps) {
  const [imgError, setImgError] = useState(false);
  const color = (part.beyType && TYPE_COLORS[part.beyType]) || '#6b7280';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: 4,
        borderColor: alpha(color, 0.1),
        bgcolor: 'background.paper',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: `0 12px 30px -10px ${alpha(color, 0.45)}`,
          borderColor: color,
          '& .part-image-box': {
            transform: 'scale(1.1) rotate(5deg)',
          },
        },
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <CardActionArea
        onClick={() => onSelect(part)}
        sx={{ height: '100%', borderRadius: 4 }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            pt: 2.5,
            '&:last-child': { pb: 1.5 },
          }}
        >
          {/* Type Badge */}
          {part.beyType && (
            <Box
              sx={{
                position: 'absolute',
                top: -10,
                right: 12,
                bgcolor: color,
                color: '#fff',
                px: 1.2,
                py: 0.3,
                borderRadius: 2,
                fontSize: '0.65rem',
                fontWeight: '900',
                boxShadow: `0 4px 10px ${alpha(color, 0.4)}`,
                zIndex: 2,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {part.beyType}
            </Box>
          )}

          {/* System badge */}
          {part.system && part.system !== 'BX' && (
            <Box
              sx={{
                position: 'absolute',
                top: -10,
                left: 12,
                bgcolor: '#1e293b',
                color: '#94a3b8',
                px: 1,
                py: 0.3,
                borderRadius: 2,
                fontSize: '0.6rem',
                fontWeight: '900',
                zIndex: 2,
                letterSpacing: 0.5,
              }}
            >
              {part.system}
            </Box>
          )}

          <Box
            className="part-image-box"
            sx={{
              position: 'relative',
              width: 90,
              height: 90,
              transition:
                'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          >
            {part.imageUrl && !imgError ? (
              part.imageUrl.startsWith('http') ? (
                <img
                  src={part.imageUrl}
                  alt={part.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
                  }}
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Image
                  src={part.imageUrl}
                  alt={part.name}
                  fill
                  sizes="100px"
                  style={{
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
                  }}
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              )
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: alpha(color, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 0,
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    color: 'text.disabled',
                    fontWeight: '900',
                    opacity: 0.3,
                  }}
                >
                  {part.name.charAt(0)}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ textAlign: 'center', width: '100%', mt: 0.5 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: '900',
                lineHeight: 1.2,
                fontSize: '0.8rem',
              }}
            >
              {part.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.65rem',
                fontWeight: 'bold',
              }}
            >
              {part.weight
                ? `${part.weight}g`
                : SYSTEM_LABELS[part.system || 'BX']}
            </Typography>
          </Box>

          {/* Stat Bars */}
          <Box sx={{ display: 'flex', gap: 0.4, width: '100%', mt: 0.5 }}>
            {(['attack', 'defense', 'stamina', 'dash'] as const).map((stat) => {
              const val = part[stat as keyof Part];
              if (!val) return null;
              const numericVal =
                typeof val === 'number' ? val : parseInt(String(val), 10);
              const statInfo = STAT_LABELS[stat];
              if (!statInfo) return null;
              return (
                <Tooltip
                  key={stat}
                  title={`${statInfo.label}: ${numericVal}`}
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 5,
                      bgcolor: alpha(statInfo.color, 0.1),
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.min(numericVal, 100)}%`,
                        height: '100%',
                        bgcolor: statInfo.color,
                        borderRadius: 3,
                      }}
                    />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

interface PartDetailDialogProps {
  part: Part | null;
  onClose: () => void;
}

function PartDetailDialog({ part, onClose }: PartDetailDialogProps) {
  const isMobile = useMobile();
  if (!part) return null;

  const color = (part.beyType && TYPE_COLORS[part.beyType]) || '#6b7280';
  const textures = getPartTextures(part);

  return (
    <Dialog
      open={!!part}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius: { xs: 0, sm: 5 },
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pb: 2,
          pt: 3,
          px: 3,
          bgcolor: alpha(color, 0.05),
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: '900',
              letterSpacing: -0.5,
            }}
          >
            {part.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip
              label={part.type}
              size="small"
              sx={{
                fontWeight: '900',
                fontSize: '0.65rem',
                height: 22,
                borderRadius: 2,
                textTransform: 'uppercase',
                bgcolor: 'text.primary',
                color: 'background.paper',
              }}
            />
            {part.beyType && (
              <Chip
                label={part.beyType}
                size="small"
                sx={{
                  fontWeight: '900',
                  fontSize: '0.65rem',
                  height: 22,
                  borderRadius: 2,
                  bgcolor: color,
                  color: '#fff',
                }}
              />
            )}
            {part.system && (
              <Chip
                label={SYSTEM_LABELS[part.system] || part.system}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: '900',
                  fontSize: '0.65rem',
                  height: 22,
                  borderRadius: 2,
                }}
              />
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ bgcolor: 'action.hover' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {/* Image + Info — stack on mobile */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 3 },
            mb: 4,
            alignItems: { xs: 'center', sm: 'center' },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: { xs: 100, sm: 140 },
              height: { xs: 100, sm: 140 },
              flexShrink: 0,
              filter: `drop-shadow(0 10px 20px ${alpha(color, 0.3)})`,
            }}
          >
            {part.imageUrl ? (
              part.imageUrl.startsWith('http') ? (
                <img
                  src={part.imageUrl}
                  alt={part.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Image
                  src={part.imageUrl}
                  alt={part.name}
                  fill
                  sizes="140px"
                  style={{ objectFit: 'contain' }}
                />
              )
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: alpha(color, 0.1),
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h2" sx={{ opacity: 0.2 }}>
                  {part.name.charAt(0)}
                </Typography>
              </Box>
            )}
          </Box>

          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}
          >
            {[
              { label: 'Poids', value: part.weight ? `${part.weight}g` : '—' },
              { label: 'Système', value: SYSTEM_LABELS[part.system || 'BX'] },
              { label: 'Rotation', value: part.spinDirection || 'Droite' },
              { label: 'ID', value: part.externalId },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 'bold',
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: '900',
                  }}
                >
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Combat Stats */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography
            variant="overline"
            sx={{
              fontWeight: '900',
              color: 'text.disabled',
            }}
          >
            Statistiques de Combat
          </Typography>
          {[
            { key: 'attack', label: 'Attaque', color: '#ef4444' },
            { key: 'defense', label: 'Défense', color: '#3b82f6' },
            { key: 'stamina', label: 'Endurance', color: '#22c55e' },
            { key: 'dash', label: 'Dash', color: '#fbbf24' },
            { key: 'burst', label: 'Anti-Burst', color: '#a855f7' },
          ].map(({ key, label, color: statColor }) => {
            const val = parseStat(
              part[key as keyof Part] as string | number | null,
            );
            if (!val) return null;
            return (
              <Box key={key}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 'bold',
                      color: 'text.secondary',
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: '900',
                      color: statColor,
                    }}
                  >
                    {val}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(val, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(statColor, 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: statColor,
                      borderRadius: 4,
                      boxShadow: `0 0 10px ${alpha(statColor, 0.4)}`,
                    },
                  }}
                />
              </Box>
            );
          })}
        </Box>

        {/* Textures section */}
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="overline"
            sx={{
              fontWeight: '900',
              color: 'text.disabled',
            }}
          >
            Textures du jeu
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 1,
              mt: 1,
            }}
          >
            {textures.map((tex) => (
              <Box
                key={tex}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Image
                  src={tex}
                  alt="Texture"
                  fill
                  sizes="100px"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

interface PartGridProps {
  parts: Part[];
}

export function PartGrid({ parts }: PartGridProps) {
  const [selected, setSelected] = useState<Part | null>(null);

  if (parts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: '900',
          }}
        >
          Aucune pièce trouvée
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Essayez de modifier vos filtres de recherche.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: 'repeat(5, 1fr)',
            xl: 'repeat(6, 1fr)',
          },
          gap: 2,
        }}
      >
        {parts.map((part) => (
          <PartCard key={part.id} part={part} onSelect={setSelected} />
        ))}
      </Box>
      <PartDetailDialog part={selected} onClose={() => setSelected(null)} />
    </>
  );
}
