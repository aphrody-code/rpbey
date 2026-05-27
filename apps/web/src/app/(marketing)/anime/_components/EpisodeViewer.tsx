'use client';

import { Download, Language, OndemandVideo } from '@mui/icons-material';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { EpisodePlayerWrapper } from './EpisodePlayerWrapper';

interface Source {
  id: string;
  type: string;
  url: string;
  quality: string;
  language: string;
  priority: number;
}

interface EpisodeViewerProps {
  title: string;
  sources: Source[];
  savedProgress: number;
  episodeId: string;
  duration: number;
  seriesSlug?: string;
  onEnded?: () => void;
}

function getSourceLabel(source: Source): string {
  const url = source.url;
  if (url.includes('sibnet.ru')) return 'Sibnet';
  if (url.includes('vidmoly.net')) return 'VidMoly';
  if (url.includes('vk.com')) return 'VK Video';
  if (url.includes('dailymotion.com')) return 'Dailymotion';
  if (url.includes('youtube.com') || source.type === 'YOUTUBE')
    return 'YouTube';
  if (url.includes('drive.google.com')) return 'Google Drive';
  if (url.includes('sendvid.com')) return 'SendVid';
  return source.type === 'MP4' ? 'MP4' : 'Lecteur';
}

function isDownloadSource(source: Source): boolean {
  return source.url.includes('drive.google.com/uc?export=download');
}

function getPlayerSrc(source: Source): string {
  if (source.type === 'YOUTUBE' && !source.url.includes('youtube.com')) {
    return `youtube/${source.url}`;
  }
  return source.url;
}

export function EpisodeViewer({
  title,
  sources,
  savedProgress,
  episodeId,
  duration,
  seriesSlug,
  onEnded,
}: EpisodeViewerProps) {
  const streamingSources = sources.filter((s) => !isDownloadSource(s));
  const downloadSources = sources.filter(isDownloadSource);

  const languages = [...new Set(streamingSources.map((s) => s.language))];
  const [selectedLang, setSelectedLang] = useState(
    languages.includes('VF') ? 'VF' : languages[0] || 'VF',
  );

  const langSources = streamingSources.filter(
    (s) => s.language === selectedLang,
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const activeSource = langSources[activeIdx] || langSources[0];

  const hasControls =
    languages.length > 1 ||
    langSources.length > 1 ||
    downloadSources.length > 0;

  if (!activeSource) {
    return (
      <Box
        sx={{
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#111',
          borderRadius: { xs: 0, md: 3 },
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
          }}
        >
          Aucune source disponible pour cet épisode.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Player */}
      <EpisodePlayerWrapper
        title={title}
        src={getPlayerSrc(activeSource)}
        sourceType={activeSource.type}
        savedProgress={savedProgress}
        episodeId={episodeId}
        duration={duration}
        startTime={
          seriesSlug === 'beyblade-x' && selectedLang === 'VOSTFR' ? 4 : 0
        }
        onEnded={onEnded}
      />
      {/* Controls bar — glassmorphism */}
      {hasControls && (
        <Box
          sx={{
            mt: 1,
            mx: { xs: 1, md: 0 },
            px: 2,
            py: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Language selector */}
          {languages.length > 1 && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: 'center',
              }}
            >
              <Language sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }} />
              {languages.map((lang) => (
                <Chip
                  key={lang}
                  label={lang}
                  size="small"
                  onClick={() => {
                    setSelectedLang(lang);
                    setActiveIdx(0);
                  }}
                  sx={{
                    height: 26,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    bgcolor:
                      selectedLang === lang
                        ? 'var(--rpb-primary)'
                        : 'rgba(255,255,255,0.06)',
                    color:
                      selectedLang === lang ? 'white' : 'rgba(255,255,255,0.5)',
                    border:
                      selectedLang === lang
                        ? '1px solid var(--rpb-primary)'
                        : '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      bgcolor:
                        selectedLang === lang
                          ? 'var(--rpb-primary)'
                          : 'rgba(255,255,255,0.1)',
                    },
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Divider */}
          {languages.length > 1 && langSources.length > 1 && (
            <Box
              sx={{
                width: 1,
                height: 20,
                bgcolor: 'rgba(255,255,255,0.08)',
                display: { xs: 'none', md: 'block' },
              }}
            />
          )}

          {/* Source selector */}
          {langSources.length > 1 && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: 'center',
              }}
            >
              <OndemandVideo
                sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}
              />
              {langSources.map((src, i) => (
                <Chip
                  key={src.id}
                  label={getSourceLabel(src)}
                  size="small"
                  onClick={() => setActiveIdx(i)}
                  sx={{
                    height: 26,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    bgcolor:
                      activeIdx === i
                        ? 'rgba(255,255,255,0.12)'
                        : 'transparent',
                    color: activeIdx === i ? 'white' : 'rgba(255,255,255,0.4)',
                    border:
                      activeIdx === i
                        ? '1px solid rgba(255,255,255,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: 'white',
                    },
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Download */}
          {downloadSources.length > 0 && (
            <Tooltip title="Télécharger (Google Drive)" arrow>
              <Button
                component="a"
                href={downloadSources[0]?.url}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                startIcon={<Download sx={{ fontSize: '16px !important' }} />}
                sx={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.72rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1.5,
                  minWidth: 'auto',
                  border: '1px solid rgba(255,255,255,0.06)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.15)',
                  },
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Télécharger
                </Box>
              </Button>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
}
