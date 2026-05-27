'use client';

import Button, { type ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useCallback, useState } from 'react';
import { TwitchIcon } from '@/components/ui/Icons';
import { signIn } from '@/lib/auth-client';

interface TwitchButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  callbackURL?: string;
  text?: string;
  loadingText?: string;
}

export function TwitchButton({
  callbackURL = '/dashboard',
  text = 'Se connecter avec Twitch',
  loadingText = 'Connexion...',
  variant = 'contained',
  size = 'large',
  fullWidth = true,
  ...props
}: TwitchButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: 'twitch',
        callbackURL,
      });
    } catch (error) {
      console.error('Twitch sign in error:', error);
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
          <TwitchIcon size={20} />
        )
      }
      sx={{
        backgroundColor: '#9146FF',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#772CE8',
        },
        '&:disabled': {
          backgroundColor: '#9146FF',
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
