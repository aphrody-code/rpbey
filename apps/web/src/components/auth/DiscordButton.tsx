'use client';

import Button, { type ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useCallback, useState } from 'react';
import { DiscordIcon } from '@/components/ui/Icons';
import { signIn } from '@/lib/auth-client';

interface DiscordButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  callbackURL?: string;
  text?: string;
  loadingText?: string;
}

export function DiscordButton({
  callbackURL = '/dashboard',
  text = 'Se connecter avec Discord',
  loadingText = 'Connexion...',
  variant = 'contained',
  size = 'large',
  fullWidth = true,
  ...props
}: DiscordButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: 'discord',
        callbackURL,
      });
    } catch (error) {
      console.error('Discord sign in error:', error);
      setLoading(false);
    }
  }, [callbackURL]);

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      onClick={handleClick}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <DiscordIcon size={20} />
        )
      }
      sx={{
        backgroundColor: '#5865F2',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#4752C4',
        },
        '&:disabled': {
          backgroundColor: '#5865F2',
          opacity: 0.7,
        },
        textTransform: 'none',
        fontWeight: 600,
        py: 1.5,
        ...props.sx,
      }}
      {...props}
    >
      {loading ? loadingText : text}
    </Button>
  );
}

// Compact version for header/navbar
export function DiscordButtonCompact({
  callbackURL = '/dashboard',
  ...props
}: Omit<DiscordButtonProps, 'text' | 'loadingText' | 'fullWidth'>) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: 'discord',
        callbackURL,
      });
    } catch (error) {
      console.error('Discord sign in error:', error);
      setLoading(false);
    }
  }, [callbackURL]);

  return (
    <Button
      variant="contained"
      size="small"
      onClick={handleClick}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <DiscordIcon size={16} />
        )
      }
      sx={{
        backgroundColor: '#5865F2',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#4752C4',
        },
        textTransform: 'none',
        fontWeight: 500,
        ...props.sx,
      }}
      {...props}
    >
      Connexion
    </Button>
  );
}
