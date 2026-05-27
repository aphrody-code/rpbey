import { Search as SearchIcon } from '@mui/icons-material';
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import type React from 'react';

type SearchInputProps = TextFieldProps & {
  onSearch?: (value: string) => void;
};

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  onChange,
  ...props
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event);
    }
    if (onSearch) {
      onSearch(event.target.value);
    }
  };

  return (
    <TextField
      placeholder="Rechercher..."
      variant="outlined"
      size="small"
      onChange={handleChange}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          bgcolor: 'background.paper',
        },
        minWidth: 250,
      }}
      {...props}
    />
  );
};
