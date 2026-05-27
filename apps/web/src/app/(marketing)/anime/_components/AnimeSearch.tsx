'use client';

import { Search as SearchIcon } from '@mui/icons-material';
import {
  Box,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchAnime } from '@/server/actions/anime';

interface SearchResult {
  series: Array<{
    id: string;
    slug: string;
    title: string;
    titleFr: string | null;
    year: number;
  }>;
  episodes: Array<{
    id: string;
    number: number;
    title: string;
    titleFr: string | null;
    series: { slug: string; title: string };
  }>;
}

export function AnimeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    const data = await searchAnime(q);
    setResults(data);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        px: { xs: 1.5, md: 4 },
        mb: { xs: 2, md: 3 },
      }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder="Rechercher un anime ou un épisode..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onFocus={() => results && setOpen(true)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          maxWidth: { xs: '100%', md: 500 },
          '& .MuiOutlinedInput-root': {
            borderRadius: { xs: 2, md: 3 },
            bgcolor: 'rgba(255,255,255,0.05)',
            minHeight: { xs: 44, md: 'auto' },
          },
        }}
      />

      {open &&
        results &&
        (results.series.length > 0 || results.episodes.length > 0) && (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              top: '100%',
              left: { xs: 16, md: 32 },
              right: { xs: 16, md: 'auto' },
              width: { md: 500 },
              maxHeight: 400,
              overflow: 'auto',
              zIndex: 1300,
              mt: 1,
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {results.series.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    pt: 1.5,
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 700,
                  }}
                >
                  SÉRIES
                </Typography>
                <List dense disablePadding>
                  {results.series.map((s) => (
                    <ListItemButton
                      key={s.id}
                      onClick={() => handleSelect(`/anime/${s.slug}`)}
                    >
                      <ListItemText
                        primary={s.titleFr || s.title}
                        secondary={`${s.year}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}

            {results.episodes.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    pt: 1.5,
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 700,
                  }}
                >
                  ÉPISODES
                </Typography>
                <List dense disablePadding>
                  {results.episodes.map((ep) => (
                    <ListItemButton
                      key={ep.id}
                      onClick={() =>
                        handleSelect(`/anime/${ep.series.slug}/${ep.number}`)
                      }
                    >
                      <ListItemText
                        primary={`EP ${ep.number} - ${ep.titleFr || ep.title}`}
                        secondary={ep.series.title}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}
          </Paper>
        )}
    </Box>
  );
}
