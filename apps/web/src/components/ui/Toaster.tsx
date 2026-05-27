'use client';

import { useTheme } from '@mui/material/styles';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  const theme = useTheme();

  return (
    <SonnerToaster
      theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{
        style: {
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          fontFamily: theme.typography.fontFamily,
        },
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toaster]:border-l-4 group-[.toaster]:border-l-red-600',
          success:
            'group-[.toaster]:border-l-4 group-[.toaster]:border-l-green-600',
          warning:
            'group-[.toaster]:border-l-4 group-[.toaster]:border-l-yellow-500',
          info: 'group-[.toaster]:border-l-4 group-[.toaster]:border-l-blue-500',
        },
      }}
    />
  );
}
