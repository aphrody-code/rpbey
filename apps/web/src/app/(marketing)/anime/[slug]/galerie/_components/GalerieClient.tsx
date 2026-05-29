"use client";

import { Close, OpenInNew } from "@mui/icons-material";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";

/**
 * Bouton flottant translucide (glassmorphism) réutilisé dans la lightbox.
 * `styled()` car le même override apparaît sur 2 boutons (fermer / ouvrir) ;
 * seule la position `right` reste un one-off via `sx`. En styled() : pas de
 * shorthand `bgcolor` ni de string palette `common.white` (non résolus hors sx).
 */
const GlassIconButton = styled(IconButton)({
  position: "fixed",
  top: 16,
  color: "#fff",
  backgroundColor: "color-mix(in srgb, #000 60%, transparent)",
  backdropFilter: "blur(8px)",
  "&:hover": { backgroundColor: "color-mix(in srgb, #000 82%, transparent)" },
});

export interface FrameItem {
  id: string;
  imageUrl: string;
  thumbUrl: string | null;
  episodeNumber: number | null;
  characterNames: string[];
}

interface GalerieClientProps {
  frames: FrameItem[];
}

/**
 * Grille interactive + lightbox.
 * RSC parent passe les données ; ce composant prend en charge
 * hover, skeleton lazy-load et ouverture plein écran.
 */
export function GalerieClient({ frames }: GalerieClientProps) {
  const [lightbox, setLightbox] = useState<FrameItem | null>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  const handleLoad = (id: string) => setLoaded((prev) => ({ ...prev, [id]: true }));

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 0.75, sm: 1 },
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
            lg: "repeat(5, 1fr)",
            xl: "repeat(6, 1fr)",
          },
        }}
      >
        {frames.map((f) => {
          const alt =
            f.characterNames.length > 0
              ? f.characterNames.join(", ")
              : `Frame épisode ${f.episodeNumber ?? "?"}`;
          const isLoaded = loaded[f.id];
          return (
            <Box
              key={f.id}
              onClick={() => setLightbox(f)}
              sx={{
                position: "relative",
                aspectRatio: "16 / 9",
                overflow: "hidden",
                borderRadius: { xs: 1, sm: 1.5 },
                // surface token — suit le thème sans recalcul JS
                bgcolor: "action.hover",
                cursor: "pointer",
                transition: "transform .18s cubic-bezier(.4,0,.2,1), box-shadow .18s",
                "&:hover": {
                  transform: "scale(1.04)",
                  zIndex: 2,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                  "& .frame-overlay": { opacity: 1 },
                },
              }}
            >
              {/* Skeleton affiché jusqu'au chargement réel */}
              {!isLoaded && (
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height="100%"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    // Skeleton utilise action.hover / wave par défaut — pas de surcharge
                    transform: "none",
                  }}
                />
              )}

              {/* Vignette CDN */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.thumbUrl ?? f.imageUrl}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => handleLoad(f.id)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: isLoaded ? 1 : 0,
                  transition: "opacity .3s",
                }}
              />

              {/* Hover overlay — dégradé sombre, pas de couleur brand */}
              <Box
                className="frame-overlay"
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, color-mix(in srgb, #000 75%, transparent) 0%, transparent 50%)",
                  opacity: 0,
                  transition: "opacity .18s",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  p: 1,
                }}
              >
                {f.characterNames.length > 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      // text.primary = blanc en dark, noir en light → safe
                      color: "text.primary",
                      fontWeight: 700,
                      fontSize: "0.6rem",
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {f.characterNames.join(", ")}
                  </Typography>
                )}
              </Box>

              {/* Badge épisode — couleur brand via CSS var */}
              {f.episodeNumber != null && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 0.75,
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    color: "primary.contrastText",
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 85%, #000)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  Ép. {f.episodeNumber}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Lightbox */}
      <Dialog
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        maxWidth={false}
        slotProps={{
          // Backdrop opaque — on reste en rgba car c'est intentionnellement
          // plus sombre que n'importe quel token de surface
          backdrop: { sx: { bgcolor: "color-mix(in srgb, #000 92%, transparent)" } },
        }}
        sx={{
          "& .MuiDialog-paper": {
            bgcolor: "transparent",
            boxShadow: "none",
            maxWidth: "95vw",
            maxHeight: "95vh",
            m: 1,
          },
        }}
      >
        <DialogContent sx={{ p: 0, position: "relative", overflow: "visible" }}>
          {lightbox && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.imageUrl}
                alt={
                  lightbox.characterNames.length > 0
                    ? lightbox.characterNames.join(", ")
                    : `Frame épisode ${lightbox.episodeNumber ?? "?"}`
                }
                style={{
                  display: "block",
                  maxWidth: "90vw",
                  maxHeight: "88vh",
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />

              {/* Barre d'infos en bas */}
              {(lightbox.characterNames.length > 0 || lightbox.episodeNumber != null) && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -44,
                    left: 0,
                    right: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                  }}
                >
                  {lightbox.episodeNumber != null && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.disabled", fontSize: "0.75rem" }}
                    >
                      Épisode {lightbox.episodeNumber}
                    </Typography>
                  )}
                  {lightbox.characterNames.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    >
                      {lightbox.characterNames.join(", ")}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Bouton fermer */}
              <GlassIconButton
                onClick={() => setLightbox(null)}
                size="small"
                aria-label="Fermer"
                sx={{ right: 16 }}
              >
                <Close />
              </GlassIconButton>

              {/* Ouvrir en plein format — lien natif, pas de nativeButton needed */}
              <Tooltip title="Ouvrir en plein format">
                <GlassIconButton
                  onClick={() => window.open(lightbox.imageUrl, "_blank", "noreferrer")}
                  size="small"
                  aria-label="Ouvrir en plein format"
                  sx={{ right: 56 }}
                >
                  <OpenInNew fontSize="small" />
                </GlassIconButton>
              </Tooltip>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
