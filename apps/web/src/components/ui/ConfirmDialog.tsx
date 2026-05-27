'use client';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { type ReactNode, useCallback, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }, [onConfirm]);

  const isLoading = loading || isSubmitting;

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
          <DialogContentText id="confirm-dialog-description">
            {message}
          </DialogContentText>
        ) : (
          message
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={isLoading} color="inherit">
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          color={confirmColor}
          variant="contained"
          autoFocus
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Hook for easier usage
interface UseConfirmDialogOptions {
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    options: UseConfirmDialogOptions;
    resolve: ((confirmed: boolean) => void) | null;
  }>({
    open: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = useCallback(
    (options: UseConfirmDialogOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({ open: true, options, resolve });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    dialogState.resolve?.(true);
    setDialogState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [dialogState]);

  const handleCancel = useCallback(() => {
    dialogState.resolve?.(false);
    setDialogState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [dialogState]);

  const ConfirmDialogComponent = (
    <ConfirmDialog
      open={dialogState.open}
      {...dialogState.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialogComponent };
}
