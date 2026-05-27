'use client';

/**
 * PartSelector - Autocomplete component for selecting Beyblade parts
 */

import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import {
  type BeyType,
  type Part,
  type PartType,
} from '@/lib/types';

interface PartSelectorProps {
  type: PartType;
  value: Part | null;
  onChange: (part: Part | null) => void;
  disabled?: boolean;
  disabledPartIds?: string[];
  label?: string;
  error?: boolean;
  helperText?: string;
  dark?: boolean;
}

function getBeyTypeColor(beyType: BeyType | null): string {
  switch (beyType) {
    case 'ATTACK':
      return '#ef4444'; // red
    case 'DEFENSE':
      return '#3b82f6'; // blue
    case 'STAMINA':
      return '#22c55e'; // green
    case 'BALANCE':
      return '#a855f7'; // purple
    default:
      return '#6b7280'; // gray
  }
}

function getPartTypeLabel(type: PartType): string {
  switch (type) {
    case 'BLADE':
      return 'Blade';
    case 'RATCHET':
      return 'Ratchet';
    case 'BIT':
      return 'Bit';
    case 'LOCK_CHIP':
      return 'Lock Chip';
    case 'ASSIST_BLADE':
      return 'Assist Blade';
    default:
      return 'Part';
  }
}

export function PartSelector({
  type,
  value,
  onChange,
  disabled = false,
  disabledPartIds = [],
  label,
  error,
  helperText,
  dark = false,
}: PartSelectorProps) {
  const [options, setOptions] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Fetch parts on mount and when search changes
  const fetchParts = useCallback(
    async (search?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type });
        if (search) params.set('search', search);

        const response = await fetch(`/api/parts?${params}`);
        const result = await response.json();

        if (result.data) {
          // Sort by name for consistency
          setOptions(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch parts:', err);
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue) {
        fetchParts(inputValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, fetchParts]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      options={options}
      loading={loading}
      disabled={disabled}
      getOptionKey={(option) => option.id}
      getOptionLabel={(option) => option.name}
      getOptionDisabled={(option) => disabledPartIds.includes(option.id)}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? getPartTypeLabel(type)}
          error={error}
          helperText={helperText}
          variant={dark ? 'filled' : 'outlined'}
          sx={
            dark
              ? {
                  bgcolor: '#333',
                  borderRadius: 1,
                  '& .MuiInputBase-root': {
                    color: 'white',
                    bgcolor: '#333',
                  },
                  '& .MuiInputLabel-root': { color: '#aaa' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  '& .MuiFilledInput-root': {
                    bgcolor: '#333',
                    '&:hover': { bgcolor: '#444' },
                    '&.Mui-focused': { bgcolor: '#444' },
                  },
                }
              : {}
          }
          slotProps={{
            ...params.slotProps,

            input: {
              ...params.slotProps.input,
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
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}
          >
            <Avatar
              src={option.imageUrl || undefined}
              variant="rounded"
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'transparent',
                border: '1px solid #333',
              }}
            >
              {option.name.charAt(0)}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  {option.name}
                </Typography>
                {option.system && (
                  <Chip
                    label={option.system}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      bgcolor: '#444',
                      color: '#fff',
                    }}
                  />
                )}
              </Box>

              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'flex',
                  gap: 1,
                  mt: 0.5,
                }}
              >
                {option.beyType && (
                  <span
                    style={{
                      color: getBeyTypeColor(option.beyType),
                      fontWeight: 'bold',
                    }}
                  >
                    {option.beyType}
                  </span>
                )}
                {option.weight && <span>• {option.weight}g</span>}
                {option.spinDirection && <span>• {option.spinDirection}</span>}
              </Typography>
            </Box>
          </Box>
        );
      }}
    />
  );
}
