'use client';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import useSWR from 'swr';
import { type FeedMyProduct } from '@/lib/feedmy';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function FeedMyPartnership() {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const discountCode = 'RPB10';
  const discountUrl = 'https://feedmy.fr/discount/RPB10';

  const { data: products } = useSWR<FeedMyProduct[]>(
    '/api/marketing/feedmy',
    fetcher,
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(discountCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      variant="elevated"
      sx={{
        // Mobile-first padding
        p: { xs: 2.5, sm: 3, md: 4 },
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(
          theme.palette.background.paper,
          1,
        )} 100%)`,
        border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        // Responsive shadow
        boxShadow: {
          xs: `0 10px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
          md: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
        position: 'relative',
        overflow: 'hidden',
        // MD3 Expressive shape
        borderRadius: { xs: 3, sm: 4, md: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: { xs: '150px', md: '200px' },
          height: { xs: '150px', md: '200px' },
          background: `radial-gradient(circle at center, ${alpha(
            theme.palette.primary.main,
            0.2,
          )} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Sponsor badge - visible on all devices */}
      <Box
        sx={{
          position: 'absolute',
          top: { xs: 12, sm: 20 },
          right: { xs: -30, sm: -35 },
          bgcolor: 'secondary.main',
          color: '#000',
          px: { xs: 5, sm: 6 },
          py: 0.5,
          transform: 'rotate(45deg)',
          fontWeight: 'bold',
          fontSize: { xs: '0.65rem', sm: '0.75rem' },
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1,
        }}
      >
        SPONSOR
      </Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 3, md: 4 }}
        sx={{
          alignItems: 'center',
        }}
      >
        <Box
          component="img"
          src="/partners/feedmy-announcement.webp"
          alt="FeedMy x RPB Annonce"
          sx={{
            // Reduced mobile sizing
            width: { xs: 200, sm: 280, md: 250 },
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 2,
            boxShadow: theme.shadows[4],
            flexShrink: 0,
            transform: { md: 'rotate(-3deg)' },
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': {
              transform: { md: 'rotate(0deg) scale(1.05)' },
            },
          }}
        />

        <Box sx={{ flexGrow: 1, textAlign: 'left' }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '0.7rem', md: '0.75rem' },
            }}
          >
            Sponsor Officiel
          </Typography>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 'bold',

              // Fluid typography
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
            }}
          >
            FeedMy x RPB
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mb: { xs: 2, md: 3 },

              // Fluid typography
              fontSize: { xs: '0.9rem', md: '1rem' },

              lineHeight: 1.6,
            }}
          >
            FeedMy devient le sponsor attitré de la RPB ! Profitez de{' '}
            <strong>lots et concours de QUALITÉ</strong> lors de nos événements.
            <br />
            Utilisez le code <strong>{discountCode}</strong> pour{' '}
            <strong>-10% sur tout le site</strong> et bénéficiez de la{' '}
            <strong>livraison offerte dès 100€ d'achats</strong>.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 2 }}
            sx={{
              alignItems: { xs: 'stretch', md: 'center' },
            }}
          >
            {/* Copy code box - MD3 touch target */}
            <Box
              role="button"
              tabIndex={0}
              aria-label="Copier le code promo RPB10"
              onClick={handleCopyCode}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCopyCode();
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                borderRadius: { xs: 2, md: 2 },
                px: { xs: 2, md: 2 },
                py: { xs: 1.25, md: 1 },
                // MD3 touch target
                minHeight: { xs: 48, md: 'auto' },
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  borderColor: theme.palette.primary.main,
                  transform: 'scale(1.02)',
                },
                '&:active': {
                  transform: 'scale(0.98)',
                },
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: theme.palette.primary.main,
                  mr: 2,
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                }}
              >
                {discountCode}
              </Typography>
              {copied ? (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: 'success.main',
                  }}
                >
                  Copié !
                </Typography>
              ) : (
                <ContentCopyIcon
                  sx={{
                    fontSize: { xs: 16, md: 18 },
                    color: theme.palette.primary.main,
                  }}
                />
              )}
            </Box>

            <Button
              variant="contained"
              color="primary"
              endIcon={<LaunchIcon />}
              href={discountUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                // MD3 touch target
                minHeight: { xs: 48, md: 48 },
                py: { xs: 1.25, md: 1.5 },
                borderRadius: { xs: 2, md: 2 },
                fontSize: { xs: '0.9rem', md: '0.875rem' },
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:active': {
                  transform: 'scale(0.98)',
                },
              }}
            >
              Utiliser le code
            </Button>
          </Stack>
        </Box>
      </Stack>
      {products && products.length > 0 && (
        <Box
          sx={{
            mt: { xs: 3, md: 4 },
            pt: { xs: 2.5, md: 3 },
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              color: 'text.secondary',
              mb: { xs: 1.5, md: 2 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1,
              fontSize: { xs: '0.8rem', md: '0.875rem' },
            }}
          >
            <LocalOfferIcon fontSize="small" />
            Derniers arrivages Beyblade
          </Typography>
          <Box
            sx={{
              display: 'flex',
              overflowX: 'auto',
              gap: 2,
              pb: 2,
              px: { xs: 0.5, md: 0 },
              // Hide scrollbar but allow swipe
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              mx: { xs: -1, md: 0 },
            }}
          >
            {products.map((product) => (
              <Box
                key={product.id}
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 140, sm: 180, md: 'calc(25% - 16px)' },
                }}
              >
                <Box
                  component="a"
                  href={`https://feedmy.fr/products/${product.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'block',
                    textDecoration: 'none',
                    transition:
                      'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    '&:hover': { transform: 'translateY(-4px) scale(1.02)' },
                    '&:active': { transform: 'scale(0.98)' },
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      paddingTop: '100%',
                      bgcolor: 'background.default',
                      // MD3 Expressive shape
                      borderRadius: { xs: 1.5, md: 2 },
                      overflow: 'hidden',
                      mb: { xs: 0.75, md: 1 },
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    {product.images[0] && (
                      <Box
                        component="img"
                        src={product.images[0].src}
                        alt={product.title}
                        loading="lazy"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    noWrap
                    title={product.title}
                    sx={{
                      color: 'text.primary',
                      fontWeight: 'bold',
                      display: 'block',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    }}
                  >
                    {product.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{
                      fontWeight: 'bold',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    }}
                  >
                    {product.variants[0]?.price} €
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Card>
  );
}
