'use client';

import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Part } from '@/lib/types';
import { useSession } from '@/lib/auth-client';
import {
  claimDaily,
  getUserCurrency,
  pullBooster,
  pullMulti,
} from '@/server/actions/gacha';

interface PulledPart {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  rarity: string;
  beyType?: string | null;
  system?: string | null;
  weight?: number | null;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#6b7280',
  RARE: '#3b82f6',
  SUPER_RARE: '#8b5cf6',
  LEGENDARY: '#f59e0b',
  SECRET: '#ef4444', // Legacy
};

const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commune',
  RARE: 'Rare',
  SUPER_RARE: 'Super Rare',
  LEGENDARY: 'Légendaire',
  SECRET: 'Secrète',
};

const PACK_LINES = [
  {
    id: 'BX',
    name: 'XTREME',
    color: '#ef4444',
    img: '/bbx-icons/BBX-AttackType.webp',
    desc: 'Pièces de la série Beyblade Xtreme',
  },
  {
    id: 'UX',
    name: 'ULTIMATE',
    color: '#3b82f6',
    img: '/bbx-icons/BBX-DefenseType.webp',
    desc: 'Pièces de la série Ultimate Xtreme',
  },
  {
    id: 'CX',
    name: 'CUSTOM',
    color: '#a855f7',
    img: '/bbx-icons/BBX-BalanceType.webp',
    desc: 'Pièces de la série Custom Xtreme',
  },
];

// VFX animation — 4 phases:
// Phase 0: Interactive — user drags/swipes to split the booster pack
// Phase 1: Pack separates with shake
// Phase 2: Electric Cards VFX full screen
// Phase 3: White flash then reveal
function RevealAnimation({
  onComplete,
  packColor,
}: {
  onComplete: () => void;
  packColor: string;
}) {
  // 0=split, 1=separating, 2=vfx, 3=flash
  const [phase, setPhase] = useState(0);
  const [frame, setFrame] = useState(0);
  const [splitProgress, setSplitProgress] = useState(0); // 0-100
  const [glowIntensity, setGlowIntensity] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // After split completes → auto-advance through phases
  useEffect(() => {
    if (phase !== 1) return;
    const t1 = setTimeout(() => setPhase(2), 600);
    const t2 = setTimeout(() => setPhase(3), 2600);
    const t3 = setTimeout(onComplete, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase, onComplete]);

  // VFX frame animation during phase 2
  useEffect(() => {
    if (phase !== 2) return;
    const interval = setInterval(() => {
      setFrame((f) => Math.min(f + 1, 63));
    }, 30);
    return () => clearInterval(interval);
  }, [phase]);

  // Glow pulsing during drag
  useEffect(() => {
    if (phase !== 0) return;
    const interval = setInterval(() => {
      setGlowIntensity((_g) => {
        const base = splitProgress / 100;
        return base * 0.5 + Math.sin(Date.now() / 200) * 0.15 * base;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [phase, splitProgress]);

  // Handle drag/touch to split
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== 0) return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [phase],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== 0 || !dragStartRef.current) return;
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      const distance = Math.max(dx, dy);
      const threshold = Math.min(window.innerWidth, window.innerHeight) * 0.25;
      const progress = Math.min((distance / threshold) * 100, 100);
      setSplitProgress(progress);

      if (progress >= 100) {
        dragStartRef.current = null;
        setPhase(1);
      }
    },
    [phase],
  );

  const handlePointerUp = useCallback(() => {
    if (phase !== 0) {
      dragStartRef.current = null;
      return;
    }
    dragStartRef.current = null;
    // Snap back if not fully split
    if (splitProgress < 100) {
      setSplitProgress(0);
    }
  }, [phase, splitProgress]);

  const halfGap = (splitProgress / 100) * 120; // max 120px apart

  return (
    <Box
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        bgcolor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: phase === 0 ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Phase 0: Interactive split */}
      {phase === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Booster pack — splits in two */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Center glow line */}
            <Box
              sx={{
                position: 'absolute',
                width: 4,
                height: '130%',
                bgcolor: packColor,
                opacity: glowIntensity,
                boxShadow: `0 0 ${20 + splitProgress * 0.5}px ${packColor}, 0 0 ${40 + splitProgress}px ${packColor}`,
                zIndex: 3,
                transition: 'opacity 0.1s',
              }}
            />

            {/* Left half */}
            <Box
              sx={{
                transform: `translateX(-${halfGap / 2}px) rotate(-${splitProgress * 0.05}deg)`,
                transition:
                  splitProgress === 0 ? 'transform 0.3s ease-out' : 'none',
                clipPath: 'inset(0 50% 0 0)',
                filter: `drop-shadow(${halfGap > 10 ? `0 0 15px ${packColor}` : 'none'})`,
              }}
            >
              <Box
                component="img"
                src="/bbx-icons/orangeStar.webp"
                alt=""
                sx={{
                  width: { xs: 140, md: 200 },
                  height: { xs: 140, md: 200 },
                }}
              />
            </Box>

            {/* Right half */}
            <Box
              sx={{
                transform: `translateX(${halfGap / 2}px) rotate(${splitProgress * 0.05}deg)`,
                transition:
                  splitProgress === 0 ? 'transform 0.3s ease-out' : 'none',
                clipPath: 'inset(0 0 0 50%)',
                ml: '-100%',
                filter: `drop-shadow(${halfGap > 10 ? `0 0 15px ${packColor}` : 'none'})`,
              }}
            >
              <Box
                component="img"
                src="/bbx-icons/orangeStar.webp"
                alt=""
                sx={{
                  width: { xs: 140, md: 200 },
                  height: { xs: 140, md: 200 },
                }}
              />
            </Box>

            {/* Spark particles along the split */}
            {splitProgress > 30 &&
              Array.from({ length: Math.floor(splitProgress / 15) }).map(
                (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      bgcolor: packColor,
                      boxShadow: `0 0 6px ${packColor}`,
                      top: `${15 + i * 18 + Math.sin(i * 2.3) * 10}%`,
                      left: '50%',
                      transform: `translateX(${Math.sin(i * 1.5) * halfGap * 0.3}px)`,
                      opacity: 0.5 + ((i * 7 + 3) % 10) / 20,
                      animation: `spark-float-${i % 3} 0.6s ease-out infinite`,
                      '@keyframes spark-float-0': {
                        '0%': {
                          transform: 'translateX(0) scale(1)',
                          opacity: 1,
                        },
                        '100%': {
                          transform: 'translateX(-20px) scale(0)',
                          opacity: 0,
                        },
                      },
                      '@keyframes spark-float-1': {
                        '0%': {
                          transform: 'translateX(0) scale(1)',
                          opacity: 1,
                        },
                        '100%': {
                          transform: 'translateX(20px) scale(0)',
                          opacity: 0,
                        },
                      },
                      '@keyframes spark-float-2': {
                        '0%': {
                          transform: 'translateY(0) scale(1)',
                          opacity: 1,
                        },
                        '100%': {
                          transform: 'translateY(-15px) scale(0)',
                          opacity: 0,
                        },
                      },
                    }}
                  />
                ),
              )}
          </Box>

          {/* Progress bar */}
          <Box
            sx={{
              width: { xs: 200, md: 280 },
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(packColor, 0.15),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${splitProgress}%`,
                height: '100%',
                bgcolor: packColor,
                borderRadius: 3,
                boxShadow:
                  splitProgress > 50 ? `0 0 10px ${packColor}` : 'none',
                transition:
                  splitProgress === 0 ? 'width 0.3s ease-out' : 'none',
              }}
            />
          </Box>

          {/* Instruction text */}
          <Typography
            sx={{
              color: alpha('#fff', 0.5),
              fontWeight: 700,
              fontSize: { xs: '0.85rem', md: '1rem' },
              letterSpacing: 1,
              textAlign: 'center',
              animation:
                splitProgress === 0
                  ? 'bbx-pulse-text 2s ease-in-out infinite'
                  : 'none',
              '@keyframes bbx-pulse-text': {
                '0%, 100%': { opacity: 0.4 },
                '50%': { opacity: 0.8 },
              },
            }}
          >
            {splitProgress > 60
              ? 'ENCORE !'
              : splitProgress > 0
                ? 'Continue...'
                : 'Glisser pour ouvrir le booster'}
          </Typography>
        </Box>
      )}

      {/* Phase 1: Pack flies apart with shake */}
      {phase === 1 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'bbx-shake 0.08s infinite',
            '@keyframes bbx-shake': {
              '0%': { transform: 'translate(0, 0) scale(1.3)' },
              '25%': { transform: 'translate(-3px, 2px) scale(1.32)' },
              '50%': { transform: 'translate(3px, -1px) scale(1.3)' },
              '75%': { transform: 'translate(-2px, -3px) scale(1.33)' },
              '100%': { transform: 'translate(2px, 3px) scale(1.3)' },
            },
          }}
        >
          {/* Left half flies left */}
          <Box
            sx={{
              clipPath: 'inset(0 50% 0 0)',
              animation: 'fly-left 0.5s ease-in forwards',
              '@keyframes fly-left': {
                '0%': {
                  transform: 'translateX(-60px) rotate(-3deg)',
                  opacity: 1,
                },
                '100%': {
                  transform: 'translateX(-200px) rotate(-20deg)',
                  opacity: 0,
                },
              },
            }}
          >
            <Box
              component="img"
              src="/bbx-icons/orangeStar.webp"
              sx={{ width: { xs: 140, md: 200 }, height: { xs: 140, md: 200 } }}
            />
          </Box>
          {/* Right half flies right */}
          <Box
            sx={{
              clipPath: 'inset(0 0 0 50%)',
              ml: '-100%',
              animation: 'fly-right 0.5s ease-in forwards',
              '@keyframes fly-right': {
                '0%': {
                  transform: 'translateX(60px) rotate(3deg)',
                  opacity: 1,
                },
                '100%': {
                  transform: 'translateX(200px) rotate(20deg)',
                  opacity: 0,
                },
              },
            }}
          >
            <Box
              component="img"
              src="/bbx-icons/orangeStar.webp"
              sx={{ width: { xs: 140, md: 200 }, height: { xs: 140, md: 200 } }}
            />
          </Box>
          {/* Center burst */}
          <Box
            sx={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${packColor} 0%, transparent 70%)`,
              opacity: 0,
              animation: 'center-burst 0.4s 0.1s ease-out forwards',
              '@keyframes center-burst': {
                '0%': { transform: 'scale(0)', opacity: 0.8 },
                '100%': { transform: 'scale(3)', opacity: 0 },
              },
            }}
          />
        </Box>
      )}

      {/* Phase 2: Electric Cards VFX */}
      {phase === 2 && (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <Box
            component="img"
            src={`/app-assets/vfx/vfx_UI_ElectricCards_${frame}.webp`}
            alt=""
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '100vw', md: '60vw' },
              height: { xs: '100vh', md: '60vh' },
              objectFit: 'contain',
            }}
          />
          {frame > 10 && (
            <Box
              component="img"
              src={`/app-assets/vfx/vfx_UI_ElectricCards02_${Math.min(frame - 10, 63)}.webp`}
              alt=""
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) scale(1.3)',
                width: { xs: '100vw', md: '60vw' },
                height: { xs: '100vh', md: '60vh' },
                objectFit: 'contain',
                opacity: 0.5,
                mixBlendMode: 'screen',
              }}
            />
          )}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 60%)',
              animation: 'pulse 0.5s infinite',
            }}
          />
        </Box>
      )}

      {/* Phase 3: White flash */}
      {phase === 3 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: '#fff',
            animation: 'bbx-flash 0.3s ease-out forwards',
          }}
        />
      )}
    </Box>
  );
}

// ── TCG Card design tokens ──
const RARITY_THEME: Record<
  string,
  {
    bg: string;
    border: string;
    frame: string;
    glow: string;
    foilOpacity: number;
  }
> = {
  COMMON: {
    bg: 'linear-gradient(160deg, #1c1f26 0%, #262a33 40%, #1c1f26 100%)',
    border: '#3a3e48',
    frame: '#2a2e38',
    glow: 'transparent',
    foilOpacity: 0,
  },
  RARE: {
    bg: 'linear-gradient(160deg, #0e1b30 0%, #1a3a60 40%, #0e1b30 100%)',
    border: '#4a80b8',
    frame: '#1a3050',
    glow: 'rgba(74,128,184,0.15)',
    foilOpacity: 0,
  },
  SUPER_RARE: {
    bg: 'linear-gradient(160deg, #1a0e30 0%, #3a1a70 40%, #1a0e30 100%)',
    border: '#9060e0',
    frame: '#2a1a50',
    glow: 'rgba(144,96,224,0.2)',
    foilOpacity: 0.6,
  },
  LEGENDARY: {
    bg: 'linear-gradient(160deg, #2a1e08 0%, #705020 30%, #2a1e08 100%)',
    border: '#e0a840',
    frame: '#4a3418',
    glow: 'rgba(224,168,64,0.25)',
    foilOpacity: 0.8,
  },
  SECRET: {
    bg: 'linear-gradient(160deg, #2a0e10 0%, #701830 25%, #0e1a30 75%, #2a0e10 100%)',
    border: '#e04868',
    frame: '#3a1020',
    glow: 'rgba(224,72,104,0.3)',
    foilOpacity: 1,
  },
};

const TYPE_ICONS: Record<string, string> = {
  BLADE: '/bbx-icons/BBX-AttackType.webp',
  OVER_BLADE: '/bbx-icons/BBX-AttackType.webp',
  RATCHET: '/bbx-icons/BBX-DefenseType.webp',
  BIT: '/bbx-icons/BBX-StaminaType.webp',
  LOCK_CHIP: '/bbx-icons/BBX-BalanceType.webp',
  ASSIST_BLADE: '/bbx-icons/BBX-BalanceType.webp',
};

const STAR_COUNT: Record<string, number> = {
  COMMON: 1,
  RARE: 2,
  SUPER_RARE: 3,
  LEGENDARY: 4,
  SECRET: 5,
};

// ── Professional TCG Card Component ──
function RevealedCard({
  part,
  index,
  total,
}: {
  part: PulledPart;
  index: number;
  total: number;
}) {
  const [visible, setVisible] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);
  const rc = RARITY_COLORS[part.rarity] || '#6b7280';
  const theme = RARITY_THEME[part.rarity] || RARITY_THEME.COMMON!;
  const isHolo = theme.foilOpacity > 0;
  const stars = STAR_COUNT[part.rarity] || 1;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 250);
    return () => clearTimeout(t);
  }, [index]);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }, []);

  const tiltX = ((mouse.y - 50) / 50) * -10;
  const tiltY = ((mouse.x - 50) / 50) * 10;
  const lightAngle = 115 + (mouse.x - 50) * 0.6;

  return (
    <Box
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'scale(1) translateY(0)'
          : 'scale(0.3) translateY(60px)',
        transition: `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.08}s`,
        flex: {
          xs: '0 0 calc(50% - 8px)',
          sm: total > 3 ? '0 0 calc(33.33% - 12px)' : '0 0 calc(50% - 8px)',
        },
        minWidth: { xs: 130, sm: 150 },
        maxWidth: 210,
        perspective: '800px',
      }}
    >
      <Box
        ref={cardRef}
        onPointerMove={onMove}
        onPointerLeave={() => setMouse({ x: 50, y: 50 })}
        sx={{
          position: 'relative',
          aspectRatio: '63/88', // Standard TCG card ratio
          borderRadius: 0,
          overflow: 'hidden',
          border: '3px solid',
          borderColor: theme.border,
          background: theme.bg,
          boxShadow: `0 6px 24px ${alpha(rc, 0.35)}, 0 0 50px ${theme.glow}, inset 0 1px 0 ${alpha('#fff', 0.06)}`,
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
          transition: 'transform 0.12s ease-out, box-shadow 0.3s',
          cursor: 'default',
          '&:hover': {
            boxShadow: `0 12px 40px ${alpha(rc, 0.5)}, 0 0 80px ${alpha(rc, 0.2)}, inset 0 1px 0 ${alpha('#fff', 0.1)}`,
          },
        }}
      >
        {/* ── Noise texture overlay ── */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            background:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E\")",
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ── Inner frame ── */}
        <Box
          sx={{
            position: 'absolute',
            inset: 5,
            borderRadius: 0,
            border: '1px solid',
            borderColor: alpha(theme.border, 0.3),
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* ── Header: Name + Type icon ── */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.4,
            pt: 1.2,
            pb: 0.4,
          }}
        >
          <Typography
            noWrap
            sx={{
              color: '#fff',
              fontWeight: 900,
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              flex: 1,
              textShadow: `0 1px 4px rgba(0,0,0,0.6), 0 0 12px ${alpha(rc, 0.3)}`,
              letterSpacing: 0.3,
            }}
          >
            {part.name}
          </Typography>
          <Box
            component="img"
            src={TYPE_ICONS[part.type] || '/bbx-icons/BBX-BalanceType.webp'}
            alt=""
            sx={{
              width: 18,
              height: 18,
              ml: 0.5,
              flexShrink: 0,
              filter: `drop-shadow(0 0 4px ${alpha(rc, 0.4)})`,
            }}
          />
        </Box>

        {/* ── Art Window with inner shadow ── */}
        <Box
          sx={{
            mx: 1.2,
            borderRadius: 0,
            overflow: 'hidden',
            border: '2px solid',
            borderColor: theme.frame,
            position: 'relative',
            aspectRatio: '5/4',
            bgcolor: '#08080c',
            zIndex: 3,
          }}
        >
          {/* Radial spotlight behind art */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 50% 40%, ${alpha(rc, 0.12)} 0%, transparent 65%)`,
              pointerEvents: 'none',
            }}
          />

          {part.imageUrl ? (
            <img
              src={part.imageUrl}
              alt={part.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: '6%',
                filter: `drop-shadow(0 4px 12px ${alpha(rc, 0.4)})`,
                position: 'relative',
                zIndex: 1,
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="h3"
                sx={{ opacity: 0.06, fontWeight: 900, color: rc }}
              >
                {part.name.charAt(0)}
              </Typography>
            </Box>
          )}

          {/* Inner shadow vignette */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
              borderRadius: 0,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* ── Holographic foil overlay ── */}
          {isHolo && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                pointerEvents: 'none',
                mixBlendMode: 'color-dodge',
                opacity: theme.foilOpacity,
                background: `
                linear-gradient(${lightAngle}deg,
                  transparent 15%,
                  ${alpha('#fff', 0.08)} 28%,
                  ${alpha(rc, 0.12)} 35%,
                  ${alpha('#88ccff', 0.1)} 42%,
                  ${alpha('#fff', 0.15)} 50%,
                  ${alpha('#ff88cc', 0.08)} 58%,
                  ${alpha(rc, 0.12)} 65%,
                  transparent 80%
                )`,
                transition: 'background 0.08s',
              }}
            />
          )}

          {/* ── SECRET full rainbow ── */}
          {part.rarity === 'SECRET' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 4,
                pointerEvents: 'none',
                mixBlendMode: 'overlay',
                opacity: 0.3,
                background: `linear-gradient(${130 + (mouse.x - 50) * 1.2}deg, #ff0000 0%, #ff8800 15%, #ffff00 30%, #00ff88 45%, #0088ff 60%, #8800ff 75%, #ff0088 100%)`,
                transition: 'background 0.06s',
              }}
            />
          )}
        </Box>

        {/* ── Info section ── */}
        <Box sx={{ position: 'relative', zIndex: 3, px: 1.4, pt: 0.8 }}>
          {/* Type chip + Stars */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Chip
              label={part.type.replace('_', ' ')}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.5rem',
                fontWeight: 900,
                bgcolor: alpha(rc, 0.12),
                color: alpha('#fff', 0.75),
                letterSpacing: 0.5,
                border: '1px solid',
                borderColor: alpha(rc, 0.2),
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              {Array.from({ length: stars }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: rc,
                    boxShadow: isHolo
                      ? `0 0 6px ${rc}, 0 0 2px ${rc}`
                      : `0 0 2px ${alpha(rc, 0.5)}`,
                    animation: isHolo
                      ? `star-pulse 1.5s ease-in-out ${i * 0.2}s infinite`
                      : 'none',
                    '@keyframes star-pulse': {
                      '0%,100%': { opacity: 0.7, transform: 'scale(1)' },
                      '50%': { opacity: 1, transform: 'scale(1.3)' },
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Rarity label */}
          <Typography
            sx={{
              mt: 0.4,
              color: rc,
              fontWeight: 900,
              fontSize: '0.6rem',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              textShadow: isHolo ? `0 0 10px ${alpha(rc, 0.6)}` : 'none',
            }}
          >
            {RARITY_LABELS[part.rarity] || part.rarity}
          </Typography>

          {/* System badge */}
          {part.system && (
            <Typography
              sx={{
                fontSize: '0.5rem',
                fontWeight: 700,
                color: alpha('#fff', 0.3),
                mt: 0.2,
                letterSpacing: 0.5,
              }}
            >
              {part.system === 'BX'
                ? 'XTREME'
                : part.system === 'UX'
                  ? 'ULTIMATE'
                  : part.system === 'CX'
                    ? 'CUSTOM'
                    : part.system}
            </Typography>
          )}
        </Box>

        {/* ── Corner ornaments (Super Rare+) ── */}
        {isHolo && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            {/* Top-left */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 16,
                height: 16,
                borderTop: `1.5px solid ${alpha(rc, 0.4)}`,
                borderLeft: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRadius: 0,
              }}
            />
            {/* Top-right */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 16,
                height: 16,
                borderTop: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRight: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRadius: 0,
              }}
            />
            {/* Bottom-left */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                width: 16,
                height: 16,
                borderBottom: `1.5px solid ${alpha(rc, 0.4)}`,
                borderLeft: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRadius: 0,
              }}
            />
            {/* Bottom-right */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                width: 16,
                height: 16,
                borderBottom: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRight: `1.5px solid ${alpha(rc, 0.4)}`,
                borderRadius: 0,
              }}
            />
          </Box>
        )}

        {/* ── Animated shine sweep ── */}
        {(part.rarity === 'LEGENDARY' || part.rarity === 'SECRET') && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              pointerEvents: 'none',
              background: `linear-gradient(105deg, transparent 35%, ${alpha('#fff', 0.05)} 42%, ${alpha('#fff', 0.15)} 50%, ${alpha('#fff', 0.05)} 58%, transparent 65%)`,
              backgroundSize: '300% 100%',
              animation: 'tcg-shine 4s ease-in-out infinite',
              '@keyframes tcg-shine': {
                '0%': { backgroundPosition: '250% 0' },
                '100%': { backgroundPosition: '-100% 0' },
              },
            }}
          />
        )}

        {/* ── Sparkle particles (LEGENDARY/SECRET) ── */}
        {part.rarity === 'SECRET' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 6,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  top: `${15 + i * 14}%`,
                  left: `${10 + ((i * 17) % 80)}%`,
                  boxShadow: '0 0 4px #fff, 0 0 8px rgba(255,255,255,0.5)',
                  animation: `sparkle-${i % 3} ${1.5 + i * 0.3}s ease-in-out infinite`,
                  '@keyframes sparkle-0': {
                    '0%,100%': { opacity: 0, transform: 'scale(0)' },
                    '50%': { opacity: 1, transform: 'scale(1)' },
                  },
                  '@keyframes sparkle-1': {
                    '0%,100%': {
                      opacity: 0,
                      transform: 'scale(0) translateY(0)',
                    },
                    '50%': {
                      opacity: 0.8,
                      transform: 'scale(1.2) translateY(-3px)',
                    },
                  },
                  '@keyframes sparkle-2': {
                    '0%,100%': { opacity: 0 },
                    '40%': { opacity: 1 },
                    '60%': { opacity: 1 },
                    '100%': { opacity: 0 },
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

interface BoosterTabProps {
  allParts: Part[];
}

export function BoosterTab({ allParts }: BoosterTabProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [revealedParts, setRevealedParts] = useState<PulledPart[]>([]);
  const [_pendingParts, _setPendingParts] = useState<PulledPart[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [currency, setCurrency] = useState(500);
  const [message, setMessage] = useState<string | null>(null);

  // Load real currency if logged in
  useEffect(() => {
    if (isLoggedIn) {
      getUserCurrency().then((res) => {
        if (res.success && res.balance !== undefined) {
          setCurrency(res.balance);
        }
      });
    }
  }, [isLoggedIn]);

  // Client-side random pull (fallback when not logged in)
  const doClientPull = useCallback(
    (line: string, count: number) => {
      const lineParts = allParts.filter((p) => p.system === line || !p.system);
      if (lineParts.length === 0) return [];

      const rarities = ['COMMON', 'RARE', 'SUPER_RARE', 'LEGENDARY', 'SECRET'];
      const weights = [60, 25, 10, 4, 1];

      const results: PulledPart[] = [];
      for (let i = 0; i < count; i++) {
        // Pick rarity
        const roll = Math.random() * 100;
        let cumulative = 0;
        let rarity = 'COMMON';
        for (let r = 0; r < rarities.length; r++) {
          cumulative += weights[r] ?? 0;
          if (roll < cumulative) {
            rarity = rarities[r] ?? 'COMMON';
            break;
          }
        }

        // Guarantee at least 1 Super Rare+ on multi
        if (
          count > 1 &&
          i === count - 1 &&
          !results.some((r) =>
            ['SUPER_RARE', 'LEGENDARY', 'SECRET'].includes(r.rarity),
          )
        ) {
          const epicRoll = Math.random() * 100;
          rarity =
            epicRoll < 70
              ? 'SUPER_RARE'
              : epicRoll < 95
                ? 'LEGENDARY'
                : 'SECRET';
        }

        const part = lineParts[Math.floor(Math.random() * lineParts.length)];
        if (!part) continue;
        results.push({
          id: part.id,
          name: part.name,
          type: part.type,
          imageUrl: part.imageUrl,
          rarity,
          beyType: part.beyType,
        });
      }
      return results;
    },
    [allParts],
  );

  const handleDailyClaim = useCallback(async () => {
    if (!isLoggedIn) {
      setCurrency((c) => c + 50);
      setMessage('Mode démo : +50 BeyCoins !');
      return;
    }
    const res = await claimDaily();
    if (res.success) {
      setCurrency(res.newBalance ?? currency);
      setMessage(`+${res.amount} BeyCoins ! (Série : ${res.streak} jours)`);
    } else {
      setMessage(res.message ?? 'Erreur');
    }
  }, [isLoggedIn, currency]);

  const handlePull = useCallback(
    async (count: number) => {
      if (!selectedLine) return;
      const cost = count === 1 ? 100 : 450;
      if (currency < cost) {
        setMessage('Pas assez de BeyCoins !');
        return;
      }

      setPulling(true);
      setShowAnimation(true);
      setMessage(null);

      let parts: PulledPart[];

      if (isLoggedIn) {
        // Server-side pull with real persistence
        const line = selectedLine as 'BX' | 'UX' | 'CX';
        const res =
          count === 1 ? await pullBooster(line) : await pullMulti(line);
        if (res.success && res.parts) {
          parts = res.parts;
          setCurrency(res.newBalance ?? currency - cost);
        } else {
          setShowAnimation(false);
          setPulling(false);
          setMessage(res.message ?? 'Erreur lors du pull');
          return;
        }
      } else {
        // Client-side demo mode
        parts = doClientPull(selectedLine, count);
        setCurrency((c) => c - cost);
      }

      // Store parts — animation onComplete will trigger reveal
      _setPendingParts(parts);
    },
    [selectedLine, currency, doClientPull, isLoggedIn],
  );

  const _handleAnimationComplete = useCallback(() => {
    setShowAnimation(false);
    setRevealedParts(_pendingParts);
    setShowReveal(true);
    setPulling(false);
    _setPendingParts([]);
  }, [_pendingParts]);

  return (
    <Box>
      {/* Currency display — stacks on mobile */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 1.5, sm: 0 },
          mb: 3,
          p: 2,
          borderRadius: 3,
          bgcolor: alpha('#f59e0b', 0.05),
          border: '1px solid',
          borderColor: alpha('#f59e0b', 0.15),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/bbx-icons/orangeStar.webp"
            alt="BeyCoins"
            sx={{ width: 28, height: 28 }}
          />
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: '900',
                color: '#f59e0b',
                lineHeight: 1,
              }}
            >
              {currency}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: '600',
              }}
            >
              BeyCoins{!isLoggedIn ? ' (démo)' : ''}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          onClick={handleDailyClaim}
          sx={{
            borderColor: alpha('#22c55e', 0.3),
            color: '#22c55e',
            fontWeight: 900,
            borderRadius: 2,
            py: 1,
            minHeight: 44,
            '&:hover': { bgcolor: alpha('#22c55e', 0.1) },
          }}
        >
          + Récompense quotidienne
        </Button>
      </Box>
      {message && (
        <Typography
          sx={{
            mb: 2,
            fontWeight: 700,
            fontSize: '0.85rem',
            color:
              message.includes('+') || message.includes('BeyCoins')
                ? '#22c55e'
                : '#ef4444',
          }}
        >
          {message}
        </Typography>
      )}
      {/* Pack selection */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: '900',
          mb: 2,
        }}
      >
        Choisissez un Booster
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 4,
        }}
      >
        {PACK_LINES.map((pack) => (
          <Card
            key={pack.id}
            variant="outlined"
            onClick={() => setSelectedLine(pack.id)}
            sx={{
              cursor: 'pointer',
              borderRadius: 4,
              borderColor:
                selectedLine === pack.id ? pack.color : alpha(pack.color, 0.15),
              borderWidth: selectedLine === pack.id ? 2 : 1,
              bgcolor:
                selectedLine === pack.id
                  ? alpha(pack.color, 0.08)
                  : 'background.paper',
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: pack.color,
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 24px ${alpha(pack.color, 0.2)}`,
              },
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 3 }, textAlign: 'center' }}>
              <Box
                component="img"
                src={pack.img}
                alt={pack.name}
                sx={{
                  width: { xs: 40, sm: 64 },
                  height: { xs: 40, sm: 64 },
                  mx: 'auto',
                  mb: { xs: 1, sm: 2 },
                  filter:
                    selectedLine === pack.id
                      ? 'none'
                      : 'grayscale(0.3) opacity(0.7)',
                  transition: 'filter 0.3s',
                }}
              />
              <Typography
                sx={{
                  fontWeight: '900',
                  color: pack.color,
                  fontSize: { xs: '0.8rem', sm: '1.1rem' },
                }}
              >
                {pack.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                {pack.desc}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box>
      {/* Pull buttons */}
      {selectedLine && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'center',
          }}
        >
          <Button
            variant="contained"
            fullWidth={false}
            disabled={pulling || currency < 100}
            onClick={() => handlePull(1)}
            sx={{
              fontWeight: 900,
              borderRadius: 3,
              px: { xs: 3, sm: 4 },
              py: 1.5,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              minHeight: 48,
              flex: { xs: 1, sm: 'none' },
              bgcolor: PACK_LINES.find((p) => p.id === selectedLine)?.color,
              '&:hover': {
                bgcolor: alpha(
                  PACK_LINES.find((p) => p.id === selectedLine)?.color ||
                    '#fff',
                  0.8,
                ),
              },
            }}
          >
            Pull x1 — 100 ★
          </Button>
          <Button
            variant="contained"
            fullWidth={false}
            disabled={pulling || currency < 450}
            onClick={() => handlePull(5)}
            sx={{
              fontWeight: 900,
              borderRadius: 3,
              px: { xs: 3, sm: 4 },
              py: 1.5,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              minHeight: 48,
              flex: { xs: 1, sm: 'none' },
              bgcolor: '#f59e0b',
              '&:hover': { bgcolor: alpha('#f59e0b', 0.8) },
            }}
          >
            Pull x5 — 450 ★ (1 Super Rare+ garanti)
          </Button>
        </Box>
      )}
      {/* Drop rates */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            display: 'block',
          }}
        >
          Taux : Commune 35% · Rare 22% · Super Rare 10% · Légendaire 3% · Raté
          30%
        </Typography>
      </Box>
      {/* VFX Animation overlay */}
      {showAnimation && (
        <RevealAnimation
          onComplete={_handleAnimationComplete}
          packColor={
            PACK_LINES.find((p) => p.id === selectedLine)?.color || '#f59e0b'
          }
        />
      )}
      {/* Reveal dialog — professional layout */}
      <Dialog
        open={showReveal}
        onClose={() => setShowReveal(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#08080c',
              borderRadius: { xs: 0, sm: 5 },
              border: { sm: '1px solid' },
              borderColor: { sm: alpha('#f59e0b', 0.15) },
              overflow: 'hidden',
              maxHeight: '95vh',
            },
          },
        }}
        fullScreen={typeof window !== 'undefined' && window.innerWidth < 600}
      >
        <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflow: 'auto' }}>
          {/* ── Header banner ── */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mb: 1,
              }}
            >
              <Box
                component="img"
                src="/bbx-icons/orangeStar.webp"
                alt=""
                sx={{
                  width: 28,
                  height: 28,
                  animation: 'spin 3s linear infinite',
                  '@keyframes spin': {
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: '900',
                  color: '#fff',
                  letterSpacing: 1,
                }}
              >
                {revealedParts.length > 1
                  ? `${revealedParts.length}x Pull`
                  : 'Résultat'}
              </Typography>
              <Box
                component="img"
                src="/bbx-icons/orangeStar.webp"
                alt=""
                sx={{
                  width: 28,
                  height: 28,
                  animation: 'spin 3s linear reverse infinite',
                }}
              />
            </Box>

            {/* Rarity summary chips */}
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {(
                ['SECRET', 'LEGENDARY', 'SUPER_RARE', 'RARE', 'COMMON'] as const
              )
                .filter((r) => revealedParts.some((p) => p.rarity === r))
                .map((r) => {
                  const count = revealedParts.filter(
                    (p) => p.rarity === r,
                  ).length;
                  const c = RARITY_COLORS[r] || '#888';
                  return (
                    <Chip
                      key={r}
                      label={`${count}× ${RARITY_LABELS[r]}`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        bgcolor: alpha(c, 0.12),
                        color: c,
                        border: '1px solid',
                        borderColor: alpha(c, 0.25),
                        boxShadow: ['LEGENDARY', 'SECRET'].includes(r)
                          ? `0 0 8px ${alpha(c, 0.3)}`
                          : 'none',
                      }}
                    />
                  );
                })}
            </Box>
          </Box>

          {/* ── Cards grid ── */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 1, sm: 1.5 },
              justifyContent: 'center',
              mb: 3,
            }}
          >
            {revealedParts.map((part, i) => (
              <RevealedCard
                key={`${part.id}-${i}`}
                part={part}
                index={i}
                total={revealedParts.length}
              />
            ))}
          </Box>

          {/* ── Action buttons ── */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {selectedLine && currency >= 100 && (
              <Button
                variant="contained"
                onClick={() => {
                  setShowReveal(false);
                  handlePull(1);
                }}
                disabled={pulling}
                sx={{
                  fontWeight: 900,
                  borderRadius: 3,
                  px: 3,
                  bgcolor: PACK_LINES.find((p) => p.id === selectedLine)?.color,
                  '&:hover': {
                    bgcolor: alpha(
                      PACK_LINES.find((p) => p.id === selectedLine)?.color ||
                        '#fff',
                      0.8,
                    ),
                  },
                }}
              >
                Pull x1 — 100 ★
              </Button>
            )}
            {selectedLine && currency >= 450 && (
              <Button
                variant="contained"
                onClick={() => {
                  setShowReveal(false);
                  handlePull(5);
                }}
                disabled={pulling}
                sx={{
                  fontWeight: 900,
                  borderRadius: 3,
                  px: 3,
                  bgcolor: '#f59e0b',
                  '&:hover': { bgcolor: alpha('#f59e0b', 0.8) },
                }}
              >
                Pull x5 — 450 ★
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={() => setShowReveal(false)}
              sx={{
                fontWeight: 900,
                borderRadius: 3,
                borderColor: alpha('#fff', 0.15),
                color: alpha('#fff', 0.7),
                px: 3,
              }}
            >
              Fermer
            </Button>
          </Box>

          {/* ── Balance reminder ── */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: alpha('#f59e0b', 0.5), fontWeight: 700 }}
            >
              Solde : {currency} ★
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
