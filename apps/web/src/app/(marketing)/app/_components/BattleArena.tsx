'use client';

import { Box, Button, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Matter from 'matter-js';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeyStats {
  name: string;
  attack: number;
  defense: number;
  stamina: number;
  dash: number;
  burst: number;
  weight: number;
  type: string;
  color: string;
  imageUrl?: string | null;
}

type GamePhase = 'select' | 'launch-p1' | 'launch-p2' | 'battle' | 'result';
type BattleMode = 'ai' | 'pvp';

interface LaunchParams {
  power: number; // 0-1
  angle: number; // radians
}

interface BattleEvent {
  time: number;
  type: 'collision' | 'burst' | 'over' | 'spin' | 'xtreme';
  message: string;
  color?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ARENA_RADIUS = 220;
const ARENA_CENTER = { x: 250, y: 250 };
const CANVAS_SIZE = 500;
const BEY_RADIUS = 18;
const OVER_ZONE_RADIUS = ARENA_RADIUS - 15; // Over line
const XTREME_ZONE_RADIUS = ARENA_RADIUS + 10; // Xtreme line (outside)
const MAX_SPIN = 1000;
const SPIN_DECAY_BASE = 0.15; // per frame
const FRICTION_GROUND = 0.002;
const COLLISION_BURST_DAMAGE = 8;
const TYPE_COLORS: Record<string, string> = {
  ATTACK: '#ef4444',
  DEFENSE: '#3b82f6',
  STAMINA: '#22c55e',
  BALANCE: '#a855f7',
};

// ─── Physics helpers ─────────────────────────────────────────────────────────

function typeAdvantage(atk: string, def: string): number {
  if (atk === 'BALANCE' || def === 'BALANCE') return 1;
  if (atk === 'ATTACK' && def === 'STAMINA') return 1.3;
  if (atk === 'STAMINA' && def === 'DEFENSE') return 1.3;
  if (atk === 'DEFENSE' && def === 'ATTACK') return 1.3;
  if (atk === 'STAMINA' && def === 'ATTACK') return 0.7;
  if (atk === 'DEFENSE' && def === 'STAMINA') return 0.7;
  if (atk === 'ATTACK' && def === 'DEFENSE') return 0.7;
  return 1;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Launch Power Gauge ──────────────────────────────────────────────────────

function LaunchGauge({
  player,
  color,
  onLaunch,
}: {
  player: string;
  color: string;
  onLaunch: (params: LaunchParams) => void;
}) {
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [angle, setAngle] = useState(
    player === 'P1' ? -Math.PI / 4 : (Math.PI * 3) / 4,
  );
  const animRef = useRef<number>(0);
  const directionRef = useRef(1);

  // Power oscillates while holding
  useEffect(() => {
    if (!charging) return;
    const tick = () => {
      setPower((p) => {
        const next = p + directionRef.current * 2;
        if (next >= 100) directionRef.current = -1;
        if (next <= 0) directionRef.current = 1;
        return clamp(next, 0, 100);
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [charging]);

  const handleStart = useCallback(() => {
    setCharging(true);
    directionRef.current = 1;
  }, []);

  const handleRelease = useCallback(() => {
    setCharging(false);
    onLaunch({ power: power / 100, angle });
  }, [power, angle, onLaunch]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        p: 3,
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: '900',
          color,
        }}
      >
        {player} — Lancement !
      </Typography>
      {/* Angle selector */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: '700',
          }}
        >
          Angle
        </Typography>
        <input
          type="range"
          min={-180}
          max={180}
          value={Math.round((angle * 180) / Math.PI)}
          onChange={(e) => setAngle((Number(e.target.value) * Math.PI) / 180)}
          style={{ width: 160, accentColor: color }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: '900',
            color,
            minWidth: 40,
          }}
        >
          {Math.round((angle * 180) / Math.PI)}°
        </Typography>
      </Box>
      {/* Power gauge */}
      <Box
        sx={{
          width: 240,
          height: 24,
          borderRadius: 12,
          bgcolor: alpha(color, 0.1),
          border: '2px solid',
          borderColor: alpha(color, 0.3),
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            width: `${power}%`,
            height: '100%',
            bgcolor: power > 80 ? '#ef4444' : power > 50 ? '#f59e0b' : color,
            borderRadius: 10,
            transition: charging ? 'none' : 'width 0.1s',
            boxShadow:
              power > 80 ? `0 0 12px ${alpha('#ef4444', 0.5)}` : 'none',
          }}
        />
        <Typography
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '0.75rem',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {Math.round(power)}%
        </Typography>
      </Box>
      {/* Launch button */}
      <Button
        variant="contained"
        onPointerDown={handleStart}
        onPointerUp={handleRelease}
        onPointerLeave={() => {
          if (charging) handleRelease();
        }}
        sx={{
          fontWeight: 900,
          borderRadius: 3,
          px: 5,
          py: 1.5,
          fontSize: '1rem',
          bgcolor: color,
          letterSpacing: 2,
          minWidth: 200,
          minHeight: 48,
          textTransform: 'uppercase',
          '&:hover': { bgcolor: alpha(color, 0.85) },
          '&:active': {
            transform: 'scale(0.95)',
            boxShadow: `0 0 20px ${alpha(color, 0.5)}`,
          },
        }}
      >
        {charging ? 'RELÂCHER !' : 'MAINTENIR POUR CHARGER'}
      </Button>
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
        }}
      >
        Maintenir le bouton pour charger la puissance, relâcher pour lancer
      </Typography>
    </Box>
  );
}

// ─── Main Arena Component ────────────────────────────────────────────────────

interface BattleArenaProps {
  p1Stats: BeyStats;
  p2Stats: BeyStats;
  mode: BattleMode;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  onBack: () => void;
}

export function BattleArena({
  p1Stats,
  p2Stats,
  mode,
  aiDifficulty = 'medium',
  onBack,
}: BattleArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const bey1Ref = useRef<Matter.Body | null>(null);
  const bey2Ref = useRef<Matter.Body | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const rafRef = useRef<number>(0);
  const spinRef = useRef<{ p1: number; p2: number }>({
    p1: MAX_SPIN,
    p2: MAX_SPIN,
  });
  const burstRef = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const eventsRef = useRef<BattleEvent[]>([]);
  const frameRef = useRef(0);

  const [phase, setPhase] = useState<GamePhase>('launch-p1');
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [winType, setWinType] = useState('');
  const [spins, setSpins] = useState({ p1: MAX_SPIN, p2: MAX_SPIN });

  // ── Initialize Matter.js engine ──
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 }, // Top-down view, no gravity
    });
    engineRef.current = engine;

    return () => {
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      Matter.Engine.clear(engine);
    };
  }, []);

  // ── Launch handler (ref to avoid self-reference in useCallback) ──
  const handleLaunchRef = useRef<
    (player: 'p1' | 'p2', params: LaunchParams) => void
  >(() => {});

  const handleLaunch = useCallback(
    (player: 'p1' | 'p2', params: LaunchParams) => {
      const engine = engineRef.current;
      if (!engine) return;

      const stats = player === 'p1' ? p1Stats : p2Stats;
      const color = TYPE_COLORS[stats.type] || '#888';

      // Starting position: p1 bottom-left, p2 top-right
      const startX =
        player === 'p1'
          ? ARENA_CENTER.x - ARENA_RADIUS * 0.6
          : ARENA_CENTER.x + ARENA_RADIUS * 0.6;
      const startY =
        player === 'p1'
          ? ARENA_CENTER.y + ARENA_RADIUS * 0.6
          : ARENA_CENTER.y - ARENA_RADIUS * 0.6;

      // Mass from weight stat (clamped 0.8-2.5)
      const mass = clamp(0.8 + (stats.weight || 30) * 0.04, 0.8, 2.5);

      const bey = Matter.Bodies.circle(startX, startY, BEY_RADIUS, {
        restitution: 0.8,
        friction: FRICTION_GROUND,
        frictionAir: clamp(0.005 + (1 - stats.dash / 200) * 0.008, 0.002, 0.02),
        density: mass * 0.001,
        label: player,
        render: { fillStyle: color },
      });

      Matter.Composite.add(engine.world, bey);

      if (player === 'p1') {
        bey1Ref.current = bey;
      } else {
        bey2Ref.current = bey;
      }

      // Apply launch force
      const forceMag = 0.015 + params.power * 0.035;
      const fx = Math.cos(params.angle) * forceMag;
      const fy = Math.sin(params.angle) * forceMag;
      Matter.Body.applyForce(bey, bey.position, { x: fx, y: fy });

      // Set angular velocity (spin)
      const spinSpeed = 0.3 + params.power * 0.2;
      Matter.Body.setAngularVelocity(
        bey,
        player === 'p1' ? spinSpeed : -spinSpeed,
      );

      // Set initial spin based on stamina
      spinRef.current[player] =
        MAX_SPIN *
        (0.5 + (stats.stamina / 200) * 0.5) *
        (0.6 + params.power * 0.4);

      // Advance phase
      if (player === 'p1') {
        if (mode === 'ai') {
          // AI launches automatically
          setTimeout(() => {
            const aiPower =
              aiDifficulty === 'hard'
                ? 0.75 + Math.random() * 0.25
                : aiDifficulty === 'medium'
                  ? 0.5 + Math.random() * 0.4
                  : 0.2 + Math.random() * 0.6;
            const aiAngle =
              (Math.PI * 3) / 4 + (Math.random() - 0.5) * (Math.PI / 3);
            handleLaunchRef.current('p2', { power: aiPower, angle: aiAngle });
          }, 800);
          setPhase('battle');
        } else {
          setPhase('launch-p2');
        }
      } else {
        setPhase('battle');
      }
    },
    [mode, aiDifficulty, p1Stats, p2Stats],
  );

  useEffect(() => {
    handleLaunchRef.current = handleLaunch;
  }, [handleLaunch]);

  // ── Start battle loop (as ref to avoid circular deps) ──
  const _startBattleRef = useRef<() => void>(() => {});

  // ── Game functions as refs (avoids circular useCallback deps) ──
  const endBattleFn = useCallback((winnerName: string, type: string) => {
    if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
    cancelAnimationFrame(rafRef.current);
    setWinner(winnerName);
    setWinType(type);
    setPhase('result');
  }, []);

  const _updateGameFn = useCallback(() => {
    const b1 = bey1Ref.current;
    const b2 = bey2Ref.current;
    if (!b1 || !b2) return;

    // Spin decay
    const p1Decay = SPIN_DECAY_BASE * (1 - p1Stats.stamina / 250);
    const p2Decay = SPIN_DECAY_BASE * (1 - p2Stats.stamina / 250);
    spinRef.current.p1 = Math.max(0, spinRef.current.p1 - p1Decay);
    spinRef.current.p2 = Math.max(0, spinRef.current.p2 - p2Decay);

    const spinRatio1 = spinRef.current.p1 / MAX_SPIN;
    const spinRatio2 = spinRef.current.p2 / MAX_SPIN;

    if (spinRatio1 < 0.3) {
      Matter.Body.setVelocity(b1, {
        x: b1.velocity.x * (0.98 + spinRatio1 * 0.02),
        y: b1.velocity.y * (0.98 + spinRatio1 * 0.02),
      });
    }
    if (spinRatio2 < 0.3) {
      Matter.Body.setVelocity(b2, {
        x: b2.velocity.x * (0.98 + spinRatio2 * 0.02),
        y: b2.velocity.y * (0.98 + spinRatio2 * 0.02),
      });
    }

    for (const [bey, label] of [
      [b1, 'p1'],
      [b2, 'p2'],
    ] as const) {
      const dx = bey.position.x - ARENA_CENTER.x;
      const dy = bey.position.y - ARENA_CENTER.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > OVER_ZONE_RADIUS) {
        const pushForce = 0.002 * ((dist - OVER_ZONE_RADIUS) / 30);
        Matter.Body.applyForce(bey, bey.position, {
          x: (-dx / dist) * pushForce,
          y: (-dy / dist) * pushForce,
        });
      }

      if (dist > XTREME_ZONE_RADIUS + BEY_RADIUS) {
        const loser = label;
        endBattleFn(
          loser === 'p1' ? p2Stats.name : p1Stats.name,
          'Xtreme Finish !',
        );
        return;
      }
    }

    const p1BurstThreshold = 50 + p1Stats.burst * 2;
    const p2BurstThreshold = 50 + p2Stats.burst * 2;

    if (burstRef.current.p1 >= p1BurstThreshold) {
      endBattleFn(p2Stats.name, 'Burst Finish !');
      return;
    }
    if (burstRef.current.p2 >= p2BurstThreshold) {
      endBattleFn(p1Stats.name, 'Burst Finish !');
      return;
    }

    if (spinRef.current.p1 <= 0 && spinRef.current.p2 <= 0) {
      endBattleFn(
        p1Stats.stamina >= p2Stats.stamina ? p1Stats.name : p2Stats.name,
        'Double Spin Finish !',
      );
      return;
    }
    if (spinRef.current.p1 <= 0) {
      endBattleFn(p2Stats.name, 'Spin Finish !');
      return;
    }
    if (spinRef.current.p2 <= 0) {
      endBattleFn(p1Stats.name, 'Spin Finish !');
      return;
    }

    if (frameRef.current % 10 === 0) {
      setSpins({ ...spinRef.current });
      setEvents([...eventsRef.current].slice(-5));
    }
  }, [p1Stats, p2Stats, endBattleFn]);

  // ── Draw arena + beys ──
  const _drawArenaFn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Stadium background
    ctx.save();
    const stGrad = ctx.createRadialGradient(
      ARENA_CENTER.x,
      ARENA_CENTER.y,
      0,
      ARENA_CENTER.x,
      ARENA_CENTER.y,
      ARENA_RADIUS + 20,
    );
    stGrad.addColorStop(0, '#1a1a22');
    stGrad.addColorStop(0.85, '#12121a');
    stGrad.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = stGrad;
    ctx.beginPath();
    ctx.arc(ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS + 20, 0, Math.PI * 2);
    ctx.fill();

    // Over zone ring
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ARENA_CENTER.x, ARENA_CENTER.y, OVER_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Xtreme zone ring
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(ARENA_CENTER.x, ARENA_CENTER.y, XTREME_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stadium border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Center cross
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ARENA_CENTER.x - 20, ARENA_CENTER.y);
    ctx.lineTo(ARENA_CENTER.x + 20, ARENA_CENTER.y);
    ctx.moveTo(ARENA_CENTER.x, ARENA_CENTER.y - 20);
    ctx.lineTo(ARENA_CENTER.x, ARENA_CENTER.y + 20);
    ctx.stroke();
    ctx.restore();

    // Draw beys
    const drawBey = (
      body: Matter.Body | null,
      stats: BeyStats,
      spin: number,
      label: string,
    ) => {
      if (!body) return;
      const { x, y } = body.position;
      const color = TYPE_COLORS[stats.type] || '#888';
      const spinRatio = spin / MAX_SPIN;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(body.angle);

      // Glow
      if (spinRatio > 0.1) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 + spinRatio * 15;
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, BEY_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${Math.round(40 + spinRatio * 60)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, BEY_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Spin indicator lines (rotate with body)
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + spinRatio * 0.5})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.lineTo(
          Math.cos(a) * BEY_RADIUS * 0.85,
          Math.sin(a) * BEY_RADIUS * 0.85,
        );
        ctx.stroke();
      }

      ctx.restore();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - BEY_RADIUS - 6);
    };

    drawBey(bey1Ref.current, p1Stats, spinRef.current.p1, p1Stats.name);
    drawBey(bey2Ref.current, p2Stats, spinRef.current.p2, p2Stats.name);

    // Spin trails
    for (const [body, spin, color] of [
      [
        bey1Ref.current,
        spinRef.current.p1,
        TYPE_COLORS[p1Stats.type] || '#888',
      ],
      [
        bey2Ref.current,
        spinRef.current.p2,
        TYPE_COLORS[p2Stats.type] || '#888',
      ],
    ] as const) {
      if (!body || spin < 100) continue;
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed < 1) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(0.3, speed * 0.05);
      ctx.strokeStyle = color;
      ctx.lineWidth = BEY_RADIUS * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(body.position.x, body.position.y);
      ctx.lineTo(
        body.position.x - body.velocity.x * 3,
        body.position.y - body.velocity.y * 3,
      );
      ctx.stroke();
      ctx.restore();
    }
  }, [p1Stats, p2Stats]);

  useEffect(() => {
    _startBattleRef.current = () => {
      const engine = engineRef.current;
      if (!engine) return;

      // Collision handling
      Matter.Events.on(engine, 'collisionStart', (event) => {
        for (const pair of event.pairs) {
          const a = pair.bodyA;
          const b = pair.bodyB;

          // Bey vs Bey collision
          if (
            (a.label === 'p1' && b.label === 'p2') ||
            (a.label === 'p2' && b.label === 'p1')
          ) {
            const p1Body = a.label === 'p1' ? a : b;
            const p2Body = a.label === 'p1' ? b : a;

            const relSpeed = Math.sqrt(
              (p1Body.velocity.x - p2Body.velocity.x) ** 2 +
                (p1Body.velocity.y - p2Body.velocity.y) ** 2,
            );

            // Burst damage
            const p1Dmg =
              ((COLLISION_BURST_DAMAGE *
                p2Stats.attack *
                typeAdvantage(p2Stats.type, p1Stats.type)) /
                Math.max(1, p1Stats.defense)) *
              relSpeed;
            const p2Dmg =
              ((COLLISION_BURST_DAMAGE *
                p1Stats.attack *
                typeAdvantage(p1Stats.type, p2Stats.type)) /
                Math.max(1, p2Stats.defense)) *
              relSpeed;

            burstRef.current.p1 += p1Dmg;
            burstRef.current.p2 += p2Dmg;

            // Spin loss on collision
            spinRef.current.p1 -= relSpeed * 2 * (1 - p1Stats.defense / 200);
            spinRef.current.p2 -= relSpeed * 2 * (1 - p2Stats.defense / 200);

            if (relSpeed > 3) {
              eventsRef.current.push({
                time: frameRef.current,
                type: 'collision',
                message: `Impact ! (${relSpeed.toFixed(1)})`,
                color: '#f59e0b',
              });
            }
          }
        }
      });

      // Start physics runner
      const runner = Matter.Runner.create({ delta: 1000 / 60 });
      runnerRef.current = runner;
      Matter.Runner.run(runner, engine);

      // Start render loop
      const render = () => {
        frameRef.current++;
        _updateGameFn();
        _drawArenaFn();
        rafRef.current = requestAnimationFrame(render);
      };
      rafRef.current = requestAnimationFrame(render);
    };
  }, [p1Stats, p2Stats, _drawArenaFn, _updateGameFn]);

  // ── Auto-start battle when both beys are placed ──
  useEffect(() => {
    if (phase === 'battle' && bey1Ref.current && bey2Ref.current) {
      _startBattleRef.current();
    }
  }, [phase]);

  // ── Initial draw ──
  useEffect(() => {
    _drawArenaFn();
  }, [_drawArenaFn]);

  // ── Render ──
  return (
    <Box>
      {/* HUD */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          px: 1,
        }}
      >
        {/* P1 spin bar */}
        <Box sx={{ flex: 1, mr: 2 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: '900',
                color: TYPE_COLORS[p1Stats.type] || '#888',
              }}
            >
              {p1Stats.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: '700',
                color: 'text.secondary',
              }}
            >
              {Math.round(spins.p1)}
            </Typography>
          </Box>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${(spins.p1 / MAX_SPIN) * 100}%`,
                height: '100%',
                bgcolor: TYPE_COLORS[p1Stats.type] || '#888',
                borderRadius: 4,
                transition: 'width 0.15s',
              }}
            />
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            fontWeight: '900',
            color: 'text.disabled',
            px: 1,
          }}
        >
          VS
        </Typography>

        {/* P2 spin bar */}
        <Box sx={{ flex: 1, ml: 2 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: '700',
                color: 'text.secondary',
              }}
            >
              {Math.round(spins.p2)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: '900',
                color: TYPE_COLORS[p2Stats.type] || '#888',
              }}
            >
              {p2Stats.name}
            </Typography>
          </Box>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${(spins.p2 / MAX_SPIN) * 100}%`,
                height: '100%',
                bgcolor: TYPE_COLORS[p2Stats.type] || '#888',
                borderRadius: 4,
                transition: 'width 0.15s',
                ml: 'auto',
              }}
            />
          </Box>
        </Box>
      </Box>
      {/* Canvas */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            width: '100%',
            maxWidth: CANVAS_SIZE,
            height: 'auto',
            aspectRatio: '1',
            borderRadius: 16,
            border: '2px solid rgba(255,255,255,0.08)',
            background: '#08080c',
            touchAction: 'none',
          }}
        />

        {/* Launch overlay */}
        {(phase === 'launch-p1' || phase === 'launch-p2') && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              backdropFilter: 'blur(4px)',
            }}
          >
            <LaunchGauge
              player={phase === 'launch-p1' ? 'P1' : 'P2'}
              color={
                phase === 'launch-p1'
                  ? TYPE_COLORS[p1Stats.type] || '#ef4444'
                  : TYPE_COLORS[p2Stats.type] || '#3b82f6'
              }
              onLaunch={(params) =>
                handleLaunch(phase === 'launch-p1' ? 'p1' : 'p2', params)
              }
            />
          </Box>
        )}

        {/* Result overlay */}
        {phase === 'result' && winner && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.75)',
              borderRadius: 4,
              backdropFilter: 'blur(6px)',
              gap: 2,
            }}
          >
            <Chip
              label={winType}
              sx={{
                fontWeight: 900,
                fontSize: '0.9rem',
                bgcolor: alpha('#f59e0b', 0.15),
                color: '#f59e0b',
                px: 2,
                height: 32,
              }}
            />
            <Typography
              variant="h4"
              sx={{
                fontWeight: '900',
                color: '#fff',
                textShadow: '0 0 20px rgba(255,255,255,0.3)',
              }}
            >
              {winner}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: '700',
                color: 'text.secondary',
              }}
            >
              VICTOIRE !
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  // Reset everything
                  if (engineRef.current) {
                    Matter.Composite.clear(engineRef.current.world, false);
                  }
                  bey1Ref.current = null;
                  bey2Ref.current = null;
                  spinRef.current = { p1: MAX_SPIN, p2: MAX_SPIN };
                  burstRef.current = { p1: 0, p2: 0 };
                  eventsRef.current = [];
                  frameRef.current = 0;
                  setWinner(null);
                  setWinType('');
                  setEvents([]);
                  setSpins({ p1: MAX_SPIN, p2: MAX_SPIN });
                  setPhase('launch-p1');
                  _drawArenaFn();
                }}
                sx={{
                  fontWeight: 900,
                  borderRadius: 3,
                  bgcolor: 'primary.main',
                  px: 3,
                }}
              >
                REJOUER
              </Button>
              <Button
                variant="outlined"
                onClick={onBack}
                sx={{
                  fontWeight: 900,
                  borderRadius: 3,
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  px: 3,
                }}
              >
                RETOUR
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      {/* Battle log */}
      {events.length > 0 && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.3)',
            maxHeight: 80,
            overflow: 'auto',
          }}
        >
          {events.map((e, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{
                display: 'block',
                color: e.color || '#888',
                fontWeight: 700,
                fontSize: '0.7rem',
              }}
            >
              {e.message}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
