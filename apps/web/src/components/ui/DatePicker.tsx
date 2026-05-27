import {
  DatePicker as MuiDatePicker,
  type DatePickerProps as MuiDatePickerProps,
} from '@mui/x-date-pickers/DatePicker';
import type React from 'react';

export type DatePickerProps = MuiDatePickerProps & {
  label?: string;
};

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  slotProps,
  ...props
}) => {
  return (
    <MuiDatePicker
      label={label}
      slotProps={{
        textField: {
          size: 'small',
          fullWidth: true,
          ...slotProps?.textField,
        },
        ...slotProps,
      }}
      {...props}
    />
  );
};
