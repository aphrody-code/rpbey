'use client';

import { Avatar, Box, Tooltip, Typography } from '@mui/material';
import Image from 'next/image';
import { type Deck } from './DeckCard';

interface DeckBoxDisplayProps {
  deck: Deck;
}

export function DeckBoxDisplay({ deck }: DeckBoxDisplayProps) {
  // We extract the three beys from the deck, sorted by position
  const sortedBeys = deck?.beys
    ? [...deck.beys].sort((a, b) => a.position - b.position)
    : [];

  // Approximate relative coordinates for the 3 holes in the deckbox.png image
  // The image shows an open box with 3 slots aligned horizontally at the bottom half
  const positions = [
    { left: '21%', top: '65%', width: '22%' }, // Left slot
    { left: '50%', top: '65%', width: '22%' }, // Center slot
    { left: '79%', top: '65%', width: '22%' }, // Right slot
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', mb: 6 }}>
      {/* Title with RPB Branding */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: '900',
            color: 'primary.main',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            display: 'inline-block',
            position: 'relative',

            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -4,
              left: '10%',
              width: '80%',
              height: 3,
              bgcolor: 'secondary.main',
              borderRadius: 1,
            },
          }}
        >
          {deck.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1.5,
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          ÉQUIPEMENT ACTIF SÉLECTIONNÉ
        </Typography>
      </Box>
      {/* Main Container */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1.6',
          borderRadius: 4,
          overflow: 'visible', // Changed to visible for hover effects to pop out
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          bgcolor: '#000',
          '&::before': {
            // Internal shadow / glow
            content: '""',
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 100px rgba(var(--rpb-primary-rgb), 0.15)',
            zIndex: 1,
            pointerEvents: 'none',
          },
        }}
      >
        {/* Background Deckbox Image */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Image
            src="/deckbox.webp"
            alt="Deckbox"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />

          {/* Credit Tag */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(0,0,0,0.5)',
              px: 1,
              py: 0.5,
              borderRadius: 2,
              backdropFilter: 'blur(4px)',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          >
            <Avatar
              src="https://cdn.discordapp.com/avatars/381213310881628160/a_9fb38402c14cee1832dc4e67779dcd95.gif"
              sx={{
                width: 16,
                height: 16,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '0.6rem',
                fontWeight: '900',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              DECK BOX BY LOUP
            </Typography>
          </Box>
        </Box>

        {/* Overlay Beys */}
        {sortedBeys.map((bey, index) => {
          if (!bey.blade?.imageUrl) return null;
          const pos = positions[index];
          if (!pos) return null;

          const imageUrl = bey.blade.imageUrl;
          const isExternal =
            imageUrl.startsWith('http') && !imageUrl.includes('rpbey.fr');

          const fullBeyName =
            `${bey.blade?.name} ${bey.ratchet?.name || ''} ${bey.bit?.name || ''}`.trim();

          return (
            <Tooltip
              key={bey.id}
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 'bold',
                    }}
                  >
                    {fullBeyName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'secondary.main', display: 'block' }}
                  >
                    {bey.blade.beyType || 'TYPE INCONNU'}
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  aspectRatio: '1',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2,
                  perspective: '1000px',
                }}
              >
                {/* Shadow at bottom of slot */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: '5%',
                    left: '10%',
                    width: '80%',
                    height: '20%',
                    bgcolor: 'rgba(0,0,0,0.6)',
                    borderRadius: '50%',
                    filter: 'blur(8px)',
                    zIndex: 0,
                  }}
                />

                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    // Initial "inside the box" state
                    transform: 'rotateX(45deg) scaleY(0.85) scale(0.95)',
                    filter:
                      'drop-shadow(0 15px 12px rgba(0,0,0,0.8)) saturate(0.9)',

                    '&:hover': {
                      transform:
                        'rotateX(0deg) scaleY(1) scale(1.25) translateY(-30px)',
                      filter:
                        'drop-shadow(0 30px 20px rgba(0,0,0,0.9)) saturate(1.2)',
                      zIndex: 10,
                    },
                    transition:
                      'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                >
                  {isExternal ? (
                    <img
                      src={imageUrl}
                      alt={bey.blade.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))',
                      }}
                    />
                  ) : (
                    <Image
                      src={imageUrl}
                      alt={bey.blade.name}
                      fill
                      style={{
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))',
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
