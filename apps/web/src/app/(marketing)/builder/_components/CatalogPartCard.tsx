"use client";

import { CheckCircle, Close, InfoOutlined } from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Image from "next/image";
import { useState } from "react";
import { type Part } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  ATTACK: "#ef4444",
  DEFENSE: "#3b82f6",
  STAMINA: "#22c55e",
  BALANCE: "#a855f7",
};

const STAT_LABELS: Record<string, { label: string; color: string }> = {
  attack: { label: "ATK", color: "#ef4444" },
  defense: { label: "DEF", color: "#3b82f6" },
  stamina: { label: "END", color: "#22c55e" },
  dash: { label: "DSH", color: "#fbbf24" },
};

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function parseStat(val: string | number | null | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const match = String(val).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

const ALL_STATS: { key: keyof Part; label: string; color: string }[] = [
  { key: "attack", label: "Attaque", color: "#ef4444" },
  { key: "defense", label: "Défense", color: "#3b82f6" },
  { key: "stamina", label: "Endurance", color: "#22c55e" },
  { key: "dash", label: "Dash", color: "#fbbf24" },
  { key: "burst", label: "Anti-Burst", color: "#a855f7" },
];

const SYSTEM_LABELS: Record<string, string> = {
  BX: "Xtreme",
  UX: "Ultimate",
  CX: "Custom",
  COLLAB: "Collab",
};

interface CatalogPartCardProps {
  part: Part;
  isUsed: boolean;
  onClick: () => void;
}

export function CatalogPartCard({ part, isUsed, onClick }: CatalogPartCardProps) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const color = (part.beyType && TYPE_COLORS[part.beyType]) || "#6b7280";

  const renderFallback = () => (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: (theme) => alpha(theme.palette.divider, 0.08),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 0,
      }}
    >
      <Typography
        variant="h4"
        sx={{
          color: "text.disabled",
          fontWeight: "900",
          opacity: 0.3,
        }}
      >
        {part.name.charAt(0)}
      </Typography>
    </Box>
  );

  const renderImage = () => {
    if (!part.imageUrl || imgError) {
      return renderFallback();
    }

    if (isExternalUrl(part.imageUrl)) {
      return (
        <img
          src={part.imageUrl}
          alt={part.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))",
          }}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      );
    }

    return (
      <Image
        src={part.imageUrl}
        alt={part.name}
        fill
        sizes="100px"
        style={{
          objectFit: "contain",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))",
        }}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isUsed ? 0.45 : 1,
        pointerEvents: isUsed ? "none" : "auto",
        borderRadius: 4,
        borderColor: isUsed ? "divider" : alpha(color, 0.1),
        bgcolor: isUsed ? alpha("#000", 0.02) : "background.paper",
        "&:hover": {
          transform: isUsed ? "none" : "translateY(-6px)",
          boxShadow: isUsed ? "none" : `0 12px 30px -10px ${alpha(color, 0.45)}`,
          borderColor: color,
          "& .part-image-box": {
            transform: "scale(1.1) rotate(5deg)",
          },
        },
        position: "relative",
        overflow: "visible",
      }}
    >
      <CardActionArea onClick={onClick} disabled={isUsed} sx={{ height: "100%", borderRadius: 4 }}>
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            p: 1.5,
            pt: 2.5,
            "&:last-child": { pb: 1.5 },
          }}
        >
          {/* Type Badge */}
          {part.beyType && (
            <Box
              sx={{
                position: "absolute",
                top: -10,
                right: 12,
                bgcolor: color,
                color: "#fff",
                px: 1.2,
                py: 0.3,
                borderRadius: 2,
                fontSize: "0.65rem",
                fontWeight: "900",
                boxShadow: `0 4px 10px ${alpha(color, 0.4)}`,
                zIndex: 2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {part.beyType}
            </Box>
          )}

          {isUsed && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                bgcolor: "rgba(255,255,255,0.6)",
                backdropFilter: "grayscale(1)",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
              }}
            >
              <CheckCircle sx={{ color: "text.secondary", opacity: 0.5, fontSize: 32 }} />
            </Box>
          )}

          <Box
            className="part-image-box"
            sx={{
              position: "relative",
              width: 90,
              height: 90,
              transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {renderImage()}
          </Box>

          <Box sx={{ textAlign: "center", width: "100%", mt: 0.5 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: "900",
                display: "block",
                lineHeight: 1.2,
                color: "text.primary",
                fontSize: "0.8rem",
              }}
            >
              {part.name}
            </Typography>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 1,
                mt: 0.25,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.65rem",
                  fontWeight: "bold",
                }}
              >
                {part.weight ? `${part.weight}g` : SYSTEM_LABELS[part.system || "BX"]}
              </Typography>
            </Box>
          </Box>

          {/* Stat Bars Grid */}
          <Box
            sx={{
              display: "flex",
              gap: 0.4,
              width: "100%",
              alignItems: "center",
              mt: 0.5,
            }}
          >
            <Box sx={{ display: "flex", gap: 0.4, flex: 1 }}>
              {(["attack", "defense", "stamina", "dash"] as const).map((stat) => {
                const val = part[stat as keyof Part];
                if (!val) return null;
                const numericVal = typeof val === "number" ? val : parseInt(String(val), 10);
                const statInfo = STAT_LABELS[stat] ?? {
                  label: stat,
                  color: "#888",
                };
                return (
                  <Tooltip
                    key={stat}
                    title={`${statInfo.label}: ${numericVal}`}
                    arrow
                    placement="top"
                  >
                    <Box
                      sx={{
                        flex: 1,
                        height: 5,
                        bgcolor: alpha(statInfo.color, 0.1),
                        borderRadius: 3,
                        overflow: "hidden",
                        cursor: "help",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.min(numericVal, 100)}%`,
                          height: "100%",
                          bgcolor: statInfo.color,
                          borderRadius: 3,
                          boxShadow: `0 0 4px ${alpha(statInfo.color, 0.4)}`,
                        }}
                      />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>

            <IconButton
              size="small"
              component="span"
              onClick={(e) => {
                e.stopPropagation();
                setStatsOpen(true);
              }}
              sx={{
                p: 0.3,
                color: "text.disabled",
                "&:hover": {
                  color: color,
                  bgcolor: alpha(color, 0.1),
                },
                ml: 0.5,
              }}
            >
              <InfoOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </CardContent>
      </CardActionArea>
      {/* Stats Modal */}
      <Dialog
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 5,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            pb: 2,
            pt: 3,
            px: 3,
            bgcolor: alpha(color, 0.05),
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: "900",
                letterSpacing: -0.5,
              }}
            >
              {part.name}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Chip
                label={part.type}
                size="small"
                sx={{
                  fontWeight: "900",
                  fontSize: "0.65rem",
                  height: 22,
                  borderRadius: 2,
                  textTransform: "uppercase",
                  bgcolor: "text.primary",
                  color: "background.paper",
                }}
              />
              {part.beyType && (
                <Chip
                  label={part.beyType}
                  size="small"
                  sx={{
                    fontWeight: "900",
                    fontSize: "0.65rem",
                    height: 22,
                    borderRadius: 2,
                    textTransform: "uppercase",
                    bgcolor: color,
                    color: "#fff",
                  }}
                />
              )}
            </Box>
          </Box>
          <IconButton onClick={() => setStatsOpen(false)} sx={{ bgcolor: "action.hover" }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", gap: 3, mb: 4, alignItems: "center" }}>
            <Box
              sx={{
                position: "relative",
                width: 120,
                height: 120,
                flexShrink: 0,
                filter: `drop-shadow(0 10px 20px ${alpha(color, 0.3)})`,
                transform: "rotate(-5deg)",
              }}
            >
              {renderImage()}
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                flex: 1,
              }}
            >
              {[
                {
                  label: "Poids",
                  value: part.weight ? `${part.weight}g` : "?",
                },
                { label: "Système", value: SYSTEM_LABELS[part.system || "BX"] },
                { label: "Rotation", value: part.spinDirection || "Droite" },
              ].map((item) => (
                <Box key={item.label} sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: "bold",
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: "900",
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography
              variant="overline"
              sx={{
                fontWeight: "900",
                color: "text.disabled",
              }}
            >
              Statistiques de Combat
            </Typography>
            {ALL_STATS.map(({ key, label, color: statColor }) => {
              const val = parseStat(part[key] as string | number | null);
              if (!val) return null;
              return (
                <Box key={key}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: "bold",
                        color: "text.secondary",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: "900",
                        color: statColor,
                      }}
                    >
                      {val}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(val, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(statColor, 0.1),
                      "& .MuiLinearProgress-bar": {
                        bgcolor: statColor,
                        borderRadius: 4,
                        boxShadow: `0 0 10px ${alpha(statColor, 0.4)}`,
                      },
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
