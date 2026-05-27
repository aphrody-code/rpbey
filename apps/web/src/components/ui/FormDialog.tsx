'use client';

import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import { type FormEvent, type ReactNode, useCallback, useState } from 'react';

interface FormDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  disabled?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
}

export function FormDialog({
  open,
  title,
  children,
  submitText = 'Enregistrer',
  cancelText = 'Annuler',
  loading = false,
  disabled = false,
  maxWidth = 'sm',
  onSubmit,
  onClose,
}: FormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        await onSubmit();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit],
  );

  const isLoading = loading || isSubmitting;
  const isDisabled = disabled || isLoading;

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: handleSubmit,
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, pr: 6 }}>
        {title}
        <IconButton
          aria-label="fermer"
          onClick={onClose}
          disabled={isLoading}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading} color="inherit">
          {cancelText}
        </Button>
        <Button
          type="submit"
          disabled={isDisabled}
          variant="contained"
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
