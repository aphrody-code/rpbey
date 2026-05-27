'use client';

import { alpha, Box, useTheme } from '@mui/material';

interface StatRadarProps {
  stats: {
    attack: number;
    defense: number;
    stamina: number;
    dash: number;
    burst: number;
    weight: number;
  };
  size?: number;
  color?: string;
}

export function StatRadar({
  stats,
  size = 200,
  color: colorProp,
}: StatRadarProps) {
  const theme = useTheme();
  const color = colorProp ?? theme.palette.primary.main;

  /**
   * Normalization Strategy:
   * Beyblade X stats usually range from 0 to 100 (heuristic) or 0-10 (official).
   * Our system uses 0-100 range.
   * Weight: UX/CX beys range from 30g to 50g+. We'll set 60g as the 100% mark.
   */
  const normalizeStat = (val: number) => Math.min(Math.max(val, 0), 100);
  const normalizeWeight = (w: number) =>
    Math.min(Math.max((w / 60) * 100, 0), 100);

  const data = [
    { label: 'ATK', value: normalizeStat(stats.attack) },
    { label: 'DEF', value: normalizeStat(stats.defense) },
    { label: 'STA', value: normalizeStat(stats.stamina) },
    { label: 'DSH', value: normalizeStat(stats.dash) },
    { label: 'BST', value: normalizeStat(stats.burst) },
    { label: 'WGT', value: normalizeWeight(stats.weight) },
  ];

  const numStats = data.length;
  const angleStep = (Math.PI * 2) / numStats;

  // Internal coordinate system is 0-200
  const center = 100;
  const radius = 70; // Leave 30px for labels

  // Generate background polygons (the grid)
  const levels = [0.2, 0.4, 0.6, 0.8, 1];
  const gridPolygons = levels.map((level) => {
    const points = data.map((_, i) => {
      const x = center + radius * level * Math.cos(i * angleStep - Math.PI / 2);
      const y = center + radius * level * Math.sin(i * angleStep - Math.PI / 2);
      return `${x},${y}`;
    });
    return points.join(' ');
  });

  // Generate the data polygon path
  const dataPoints = data
    .map((d, i) => {
      const r = (d.value / 100) * radius;
      const x = center + r * Math.cos(i * angleStep - Math.PI / 2);
      const y = center + r * Math.sin(i * angleStep - Math.PI / 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: size,
        aspectRatio: '1/1',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient
            id="statGradient"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </radialGradient>
        </defs>

        {/* Grid lines (Hexagons) */}
        {gridPolygons.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke={alpha(theme.palette.divider, 0.05 + i * 0.05)}
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines (Spokes) */}
        {data.map((_, i) => {
          const x = center + radius * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + radius * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke={alpha(theme.palette.divider, 0.1)}
              strokeWidth="0.5"
              strokeDasharray="1,1"
            />
          );
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const labelDist = radius + 18;
          const x = center + labelDist * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + labelDist * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fill={theme.palette.text.primary}
              fontSize="8"
              fontWeight="900"
              textAnchor="middle"
              alignmentBaseline="middle"
              style={{ letterSpacing: 0.5, opacity: 0.8 }}
            >
              {d.label}
            </text>
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoints}
          fill="url(#statGradient)"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Outer Circle Rim for polish */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={alpha(color, 0.15)}
          strokeWidth="0.5"
        />

        {/* Center Point */}
        <circle cx={center} cy={center} r="1.5" fill={theme.palette.divider} />
      </svg>
    </Box>
  );
}
