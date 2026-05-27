'use client';

import { alpha, useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { type StardustBlader } from '@/lib/types';
import { StardustBladerDialog } from './StardustBladerDialog';

const ACCENT = '#60A5FA';

interface Props {
  bladers: StardustBlader[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export function StardustBladersTable({ bladers, totalPages, currentPage }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<StardustBlader | null>(null);

  const handlePageChange = (_e: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', value.toString());
    router.push(`/tournaments/stardust?${params.toString()}`);
  };

  return (
    <Box>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${ACCENT}15`,
          borderRadius: 4,
          mb: 3,
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: `${ACCENT}08` }}>
              {['Blader', 'Titres', 'W-L Cumul', 'Tournois'].map((l) => (
                <TableCell
                  key={l}
                  sx={{
                    py: 2,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '0.65rem',
                    letterSpacing: 1,
                  }}
                >
                  {l}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {bladers.map((b) => {
              const total = b.totalWins + b.totalLosses;
              const winrate = total > 0 ? ((b.totalWins / total) * 100).toFixed(1) : '-';
              return (
                <TableRow
                  key={b.id}
                  hover
                  onClick={() => setSelected(b)}
                  sx={{
                    cursor: 'pointer',
                    '& td': { py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.02)' },
                    '&:hover': { bgcolor: `${alpha(ACCENT, 0.08)} !important` },
                  }}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: 800, color: '#fff' }}>
                      {b.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 900, color: ACCENT }}>
                      🏆 {b.tournamentWins}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      <Box component="span" sx={{ color: 'success.main' }}>
                        {b.totalWins}
                      </Box>
                      <Box component="span" sx={{ color: 'text.secondary', mx: 0.25 }}>
                        -
                      </Box>
                      <Box component="span" sx={{ color: 'error.main' }}>
                        {b.totalLosses}
                      </Box>
                      <Typography
                        component="span"
                        sx={{
                          ml: 1,
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                        }}
                      >
                        ({winrate}%)
                      </Typography>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ opacity: 0.75 }}>{b.tournamentsCount}</Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            {bladers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Aucun blader enregistré.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            size={isMobile ? 'small' : 'large'}
            showFirstButton
            showLastButton
          />
        </Box>
      )}
      <StardustBladerDialog
        blader={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </Box>
  );
}
