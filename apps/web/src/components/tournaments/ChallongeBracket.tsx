'use client';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';

interface ChallongeBracketProps {
  challongeUrl: string;
  height?: number | string;
  title?: string;
  themeId?: string; // 7792 is a good dark theme base
  svgPath?: string;
}

export function ChallongeBracket({
  challongeUrl,
  height = 700,
  title,
  themeId = '1', // 1 is default, but we can customize
  svgPath,
}: ChallongeBracketProps) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const theme = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
  };

  const isSvgMode = !!svgPath;
  const isDark = theme.palette.mode === 'dark';

  // Construct optimized URL
  // theme: ID for styling
  // multiplier: Scales the bracket text/boxes
  // match_width_multiplier: Makes matches wider
  const embedUrl = `${challongeUrl}/module?theme=${themeId}&multiplier=1.0&match_width_multiplier=1.2&show_final_results=1&show_standings=1`;

  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        borderRadius: 4,
        border: '1px solid',
        borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : 'divider',
        bgcolor: isDark ? '#050505' : '#fff',
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 10px 40px rgba(0,0,0,0.5)'
          : '0 10px 30px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isDark
            ? 'linear-gradient(90deg, #0a0a0a 0%, #111 100%)'
            : 'rgba(0,0,0,0.01)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: loading ? 'warning.main' : '#22c55e',
              boxShadow: loading
                ? '0 0 12px rgba(245, 158, 11, 0.5)'
                : '0 0 12px rgba(34, 197, 94, 0.5)',
              animation: loading ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.5, transform: 'scale(1.2)' },
                '100%': { opacity: 1, transform: 'scale(1)' },
              },
            }}
          />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: '900',
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              color: isDark ? 'grey.300' : 'text.primary',
            }}
          >
            {title || 'BRACKET OFFICIEL'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Actualiser">
            <IconButton
              size="small"
              onClick={handleRefresh}
              sx={{ color: 'grey.500' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Plein écran">
            <IconButton
              size="small"
              component="a"
              href={challongeUrl}
              target="_blank"
              sx={{ color: 'grey.500' }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {/* Bracket Content */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height,
          bgcolor: isDark ? '#050505' : 'transparent',
          overflow: isSvgMode ? 'auto' : 'hidden',
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
          },
        }}
      >
        {isSvgMode ? (
          <Box
            component="img"
            src={svgPath}
            alt={title}
            sx={{
              width: '100%',
              height: 'auto',
              minHeight: '100%',
              objectFit: 'contain',
              p: 2,
              filter: isDark
                ? 'invert(1) hue-rotate(180deg) brightness(1.2)'
                : 'none',
            }}
            onLoad={() => setLoading(false)}
          />
        ) : (
          <>
            {loading && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isDark ? '#050505' : 'background.paper',
                }}
              >
                <Skeleton
                  variant="rectangular"
                  width="95%"
                  height="90%"
                  sx={{
                    borderRadius: 2,
                    bgcolor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.05)',
                  }}
                  animation="wave"
                />
              </Box>
            )}

            <iframe
              ref={iframeRef}
              key={key}
              title={title}
              src={embedUrl}
              width="100%"
              height="100%"
              scrolling="auto"
              onLoad={() => setLoading(false)}
              style={{
                border: 0,
                display: 'block',
                opacity: loading ? 0 : 1,
                transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: isDark
                  ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.1)'
                  : 'none',
                backgroundColor: isDark ? '#050505' : 'white',
              }}
            />

            {/* Dark Mode Overlay Mask to hide clunky white parts of Challonge if filters fail */}
            {isDark && !loading && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  border: '4px solid #050505',
                  borderRadius: 4,
                }}
              />
            )}
          </>
        )}
      </Box>
      {/* Footer Info */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'divider',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'grey.600', fontWeight: 700, letterSpacing: 1 }}
        >
          SYNCHRONISATION CHALLONGE LIVE • RPB OFFICIAL
        </Typography>
      </Box>
    </Box>
  );
}
