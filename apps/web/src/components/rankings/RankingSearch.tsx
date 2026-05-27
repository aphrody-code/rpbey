'use client';

import { Search as SearchIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Avatar,
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { debounce, parseAsString, useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';
import { searchBladers } from '@/server/actions/search';

interface SearchOption {
  name: string;
  image: string | null;
}

export default function RankingSearch({
  defaultValue = '',
}: {
  defaultValue?: string;
}) {
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({
      shallow: false,
      clearOnDefault: true,
    }),
  );
  const [inputValue, setInputValue] = useState(defaultValue || search);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch suggestions when input changes
  useEffect(() => {
    let active = true;

    if (inputValue.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        const results = await searchBladers(inputValue);
        if (active) {
          setOptions(results);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [inputValue]);

  return (
    <Autocomplete
      freeSolo
      options={options}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.name
      }
      filterOptions={(x) => x}
      inputValue={inputValue}
      onInputChange={(_, newValue) => {
        setInputValue(newValue);
        void setSearch(newValue || null, {
          limitUrlUpdates: newValue === '' ? undefined : debounce(400),
        });
      }}
      loading={loading}
      renderOption={(props, option) => (
        <li {...props} key={option.name}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Avatar
              src={option.image || undefined}
              sx={{ width: 24, height: 24 }}
            >
              {option.name[0]}
            </Avatar>
            <Typography variant="body2">{option.name}</Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Rechercher un Blader..."
          variant="outlined"
          size="small"
          slotProps={{
            ...params.slotProps,

            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color={inputValue ? 'primary' : 'action'} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
              borderRadius: 3,
              pr: '39px !important',
              transition: 'all 0.2s',
              '&.Mui-focused': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              },
            },
          }}
        />
      )}
    />
  );
}
