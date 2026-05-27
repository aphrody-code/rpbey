'use client';

import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { type VideoInfo } from '@/lib/twitch';

interface VideoPlayerModalProps {
  open: boolean;
  video: VideoInfo | null;
  type: 'twitch' | 'youtube' | null;
  onClose: () => void;
  domain: string;
}

export function VideoPlayerModal({
  open,
  video,
  type,
  onClose,
  domain,
}: VideoPlayerModalProps) {
  const [hostname, setHostname] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostname(window.location.hostname);
    }
  }, []);

  if (!video || !type) return null;

  let embedUrl = '';
  if (type === 'youtube') {
    embedUrl = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`;
  } else if (type === 'twitch') {
    // Construct embed for Clip with dynamic parent
    const parent = hostname || domain;
    embedUrl = `https://clips.twitch.tv/embed?clip=${video.id}&parent=${parent}&autoplay=true`;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'black',
            backgroundImage: 'none',
            overflow: 'hidden',
            borderRadius: 2,
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Typography
          variant="h6"
          noWrap
          sx={{ color: 'white', flexGrow: 1, mr: 2 }}
        >
          {video.title}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0, aspectRatio: '16/9', bgcolor: 'black' }}>
        <iframe
          src={embedUrl}
          title={video.title}
          width="100%"
          height="100%"
          allowFullScreen
          style={{ border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </DialogContent>
    </Dialog>
  );
}
