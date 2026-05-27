'use client';

import { Search } from '@mui/icons-material';
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';

interface ProductEntry {
  code: string;
  name: string;
  date: string;
}

const LINE_COLORS: Record<string, string> = {
  BX: '#ef4444',
  UX: '#3b82f6',
  CX: '#a855f7',
};

const LINE_FILTERS = [
  { label: 'Toutes', value: 'ALL' },
  { label: 'BX — Xtreme', value: 'BX', color: '#ef4444' },
  { label: 'UX — Ultimate', value: 'UX', color: '#3b82f6' },
  { label: 'CX — Custom', value: 'CX', color: '#a855f7' },
  { label: 'Spéciaux (BX-00)', value: 'SPECIAL', color: '#f59e0b' },
];

function parseDate(dateStr: string): Date {
  // Remove parenthetical notes
  const clean = dateStr.replace(/\s*\(.*\)/, '').trim();
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function getLine(code: string): string {
  if (code.startsWith('CX-')) return 'CX';
  if (code.startsWith('UX-')) return 'UX';
  return 'BX';
}

function isSpecial(product: ProductEntry): boolean {
  return (
    product.code === 'BX-00' ||
    product.code === 'UX-00' ||
    product.code === 'CX-00'
  );
}

function isFuture(product: ProductEntry): boolean {
  const d = parseDate(product.date);
  return d > new Date();
}

function getProductType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('random booster')) return 'Random Booster';
  if (lower.includes('starter')) return 'Starter';
  if (lower.includes('booster')) return 'Booster';
  if (lower.includes('deck set')) return 'Deck Set';
  if (lower.includes('set')) return 'Set';
  if (
    lower.includes('launcher') ||
    lower.includes('grip') ||
    lower.includes('case') ||
    lower.includes('stadium')
  )
    return 'Accessoire';
  if (lower.includes('metal coat')) return 'Metal Coat';
  if (lower.includes('multipack')) return 'Multipack';
  return 'Autre';
}

function getNote(dateStr: string): string | null {
  const match = dateStr.match(/\(([^)]+)\)/);
  return match?.[1] ?? null;
}

export function ProductCatalog({ products }: { products: ProductEntry[] }) {
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('ALL');
  const [showFutureOnly, setShowFutureOnly] = useState(false);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const da = parseDate(a.date);
      const db = parseDate(b.date);
      return db.getTime() - da.getTime();
    });
  }, [products]);

  const filtered = useMemo(() => {
    return sortedProducts.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());

      let matchLine = true;
      if (lineFilter === 'SPECIAL') {
        matchLine = isSpecial(p);
      } else if (lineFilter !== 'ALL') {
        matchLine = getLine(p.code) === lineFilter && !isSpecial(p);
      }

      const matchFuture = !showFutureOnly || isFuture(p);

      return matchSearch && matchLine && matchFuture;
    });
  }, [sortedProducts, search, lineFilter, showFutureOnly]);

  const futureCount = products.filter(isFuture).length;
  const specialCount = products.filter(isSpecial).length;

  return (
    <Box>
      {/* Stats row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {[
          { label: 'Total', value: products.length, color: '#6b7280' },
          {
            label: 'BX Xtreme',
            value: products.filter(
              (p) => getLine(p.code) === 'BX' && !isSpecial(p),
            ).length,
            color: '#ef4444',
          },
          {
            label: 'UX Ultimate',
            value: products.filter(
              (p) => getLine(p.code) === 'UX' && !isSpecial(p),
            ).length,
            color: '#3b82f6',
          },
          {
            label: 'CX Custom',
            value: products.filter(
              (p) => getLine(p.code) === 'CX' && !isSpecial(p),
            ).length,
            color: '#a855f7',
          },
          { label: 'Spéciaux', value: specialCount, color: '#f59e0b' },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(stat.color, 0.15),
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: '900',
                color: stat.color,
              }}
            >
              {stat.value}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {stat.label}
            </Typography>
          </Paper>
        ))}
      </Box>
      {/* Search & Filters */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Rechercher un produit ou code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: { xs: 0, sm: 280 },
            width: { xs: '100%', sm: 'auto' },
            '& .MuiOutlinedInput-root': { borderRadius: 3, fontWeight: 600 },
          }}
        />

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {LINE_FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              clickable
              onClick={() => setLineFilter(f.value)}
              sx={{
                fontWeight: 900,
                fontSize: '0.75rem',
                borderRadius: 2,
                bgcolor:
                  lineFilter === f.value
                    ? f.color || 'text.primary'
                    : 'transparent',
                color: lineFilter === f.value ? '#fff' : 'text.secondary',
                border: '1px solid',
                borderColor:
                  lineFilter === f.value
                    ? f.color || 'text.primary'
                    : 'divider',
              }}
            />
          ))}
          <Chip
            label={`À venir (${futureCount})`}
            clickable
            onClick={() => setShowFutureOnly(!showFutureOnly)}
            sx={{
              fontWeight: 900,
              fontSize: '0.75rem',
              borderRadius: 2,
              bgcolor: showFutureOnly ? '#22c55e' : 'transparent',
              color: showFutureOnly ? '#fff' : 'text.secondary',
              border: '1px solid',
              borderColor: showFutureOnly ? '#22c55e' : 'divider',
            }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            ml: 'auto',
            fontWeight: 600,
          }}
        >
          {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
      {/* Mobile: card layout */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {filtered.map((product, idx) => {
          const line = getLine(product.code);
          const lineColor = LINE_COLORS[line] || '#6b7280';
          const future = isFuture(product);
          const cleanDate = product.date.replace(/\s*\(.*\)/, '').trim();
          const pType = getProductType(product.name);

          return (
            <Paper
              key={`m-${product.code}-${idx}`}
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha(lineColor, 0.15),
                bgcolor: future ? alpha('#22c55e', 0.03) : 'transparent',
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Chip
                  label={product.code}
                  size="small"
                  sx={{
                    fontWeight: 900,
                    fontSize: '0.65rem',
                    fontFamily: 'monospace',
                    height: 20,
                    borderRadius: 1.5,
                    bgcolor: alpha(lineColor, 0.1),
                    color: lineColor,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontWeight: '600',
                  }}
                >
                  {pType}
                </Typography>
                {future && (
                  <Chip
                    label="À VENIR"
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.5rem',
                      fontWeight: 900,
                      bgcolor: '#22c55e',
                      color: '#fff',
                      ml: 'auto',
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: '700',
                  fontSize: '0.8rem',
                }}
              >
                {product.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.7rem',
                }}
              >
                {cleanDate}
              </Typography>
            </Paper>
          );
        })}
      </Box>
      {/* Desktop: table layout */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', sm: 'block' },
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 900, fontSize: '0.75rem' }}>
                CODE
              </TableCell>
              <TableCell sx={{ fontWeight: 900, fontSize: '0.75rem' }}>
                NOM
              </TableCell>
              <TableCell sx={{ fontWeight: 900, fontSize: '0.75rem' }}>
                TYPE
              </TableCell>
              <TableCell sx={{ fontWeight: 900, fontSize: '0.75rem' }}>
                DATE
              </TableCell>
              <TableCell sx={{ fontWeight: 900, fontSize: '0.75rem' }}>
                NOTE
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((product, idx) => {
              const line = getLine(product.code);
              const lineColor = LINE_COLORS[line] || '#6b7280';
              const future = isFuture(product);
              const cleanDate = product.date.replace(/\s*\(.*\)/, '').trim();
              const pType = getProductType(product.name);
              const note = getNote(product.date);

              return (
                <TableRow
                  key={`${product.code}-${idx}`}
                  sx={{
                    bgcolor: future ? alpha('#22c55e', 0.04) : 'transparent',
                    '&:hover': { bgcolor: alpha(lineColor, 0.06) },
                  }}
                >
                  <TableCell>
                    <Chip
                      label={product.code}
                      size="small"
                      sx={{
                        fontWeight: 900,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        height: 22,
                        borderRadius: 1.5,
                        bgcolor: alpha(lineColor, 0.1),
                        color: lineColor,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: '700',
                        fontSize: '0.8rem',
                      }}
                    >
                      {product.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                      }}
                    >
                      {pType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: '600',
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cleanDate}
                      </Typography>
                      {future && (
                        <Chip
                          label="À VENIR"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.55rem',
                            fontWeight: 900,
                            bgcolor: '#22c55e',
                            color: '#fff',
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {note && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.disabled',
                          fontSize: '0.65rem',
                          fontStyle: 'italic',
                        }}
                      >
                        {note}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
