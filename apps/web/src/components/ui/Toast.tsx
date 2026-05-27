'use client';

import { type AlertColor } from '@mui/material/Alert';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { toast } from 'sonner';

interface ToastContextValue {
  showToast: (
    message: string,
    severity?: AlertColor,
    duration?: number,
  ) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number; // Kept for compatibility, but Sonner handles this internally
}

export function ToastProvider({ children }: ToastProviderProps) {
  const showToast = useCallback(
    (message: string, severity: AlertColor = 'info', duration = 4000) => {
      const options = { duration };

      switch (severity) {
        case 'success':
          toast.success(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        case 'warning':
          toast.warning(message, options);
          break;
        default:
          toast.info(message, options);
          break;
      }
    },
    [],
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) =>
      showToast(message, 'success', duration),
    [showToast],
  );

  const showError = useCallback(
    (message: string, duration?: number) =>
      showToast(message, 'error', duration),
    [showToast],
  );

  const showWarning = useCallback(
    (message: string, duration?: number) =>
      showToast(message, 'warning', duration),
    [showToast],
  );

  const showInfo = useCallback(
    (message: string, duration?: number) =>
      showToast(message, 'info', duration),
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
