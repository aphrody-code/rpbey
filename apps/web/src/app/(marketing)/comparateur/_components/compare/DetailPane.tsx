"use client";

import { Close, OpenInNew, Shield } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import type { BxProductGroup, RecommendedProduct } from "../types";
import { fmtEur, fmtNative, savingPct } from "./fmt";
import { REGION_LABEL, TIER_BG, TIER_COLOR } from "./constants";

interface DetailPaneProps {
  group: BxProductGroup;
  rec: RecommendedProduct | null;
  onClose: () => void;
  compareCount: number;
  onAddToCompare: (g: BxProductGroup) => void;
  onRemoveFromCompare: (key: string) => void;
  isInCompare: boolean;
  canAddMore: boolean;
}

export function DetailPane({
  group,
  rec,
  onClose,
  compareCount: _compareCount,
  onAddToCompare,
  onRemoveFromCompare,
  isInCompare,
  canAddMore,
}: DetailPaneProps) {
  const pct = savingPct(group.cheapestEur, group.offers);
  const prices = group.offers.map((o) => o.priceEur).filter((n): n is number => n != null);
  const hi = prices.length ? Math.max(...prices) : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          pb: 2,
          mb: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
          pr: 5,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, fontSize: "1rem" }}>
            {group.name}
          </Typography>
          {group.code && (
            <Chip
              size="small"
              label={group.code}
              sx={{ fontWeight: 800, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.08)" }}
            />
          )}
        </Stack>

        {/* Price summary */}
        <Stack direction="row" sx={{ alignItems: "baseline", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.4rem", color: "#22c55e", lineHeight: 1 }}>
            {fmtEur(group.cheapestEur)}
          </Typography>
          {hi != null && hi > (group.cheapestEur ?? 0) && (
            <Typography
              sx={{ fontSize: "0.82rem", color: "text.disabled", textDecoration: "line-through" }}
            >
              {fmtEur(hi)}
            </Typography>
          )}
          {pct > 0 && (
            <Chip
              size="small"
              label={`-${pct}%`}
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 900,
                bgcolor: "rgba(34,197,94,0.12)",
                color: "#22c55e",
              }}
            />
          )}
        </Stack>

        {/* Price spread bar */}
        {prices.length >= 2 &&
          group.cheapestEur != null &&
          hi != null &&
          hi > group.cheapestEur && (
            <Box sx={{ mt: 1.5 }}>
              <Box
                sx={{
                  height: 4,
                  borderRadius: 2,
                  background: "linear-gradient(90deg, #22c55e, var(--rpb-secondary), #ef4444)",
                }}
              />
              <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5 }}>
                <Typography sx={{ fontSize: "0.65rem", color: "#22c55e", fontWeight: 700 }}>
                  min {fmtEur(group.cheapestEur)}
                </Typography>
                <Typography sx={{ fontSize: "0.65rem", color: "#ef4444", fontWeight: 700 }}>
                  max {fmtEur(hi)}
                </Typography>
              </Stack>
            </Box>
          )}

        {/* Compare button */}
        <Button
          size="small"
          variant={isInCompare ? "outlined" : "contained"}
          onClick={() => (isInCompare ? onRemoveFromCompare(group.key) : onAddToCompare(group))}
          disabled={!isInCompare && !canAddMore}
          sx={{
            mt: 1.5,
            textTransform: "none",
            fontWeight: 800,
            fontSize: "0.75rem",
            borderRadius: 2,
            ...(isInCompare
              ? { borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }
              : {
                  background: "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))",
                  color: "#fff",
                }),
          }}
        >
          {isInCompare ? "Retirer de la comparaison" : "Ajouter a la comparaison"}
        </Button>

        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            color: "text.secondary",
            "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.05)" },
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Recommendation scores */}
      {rec && (
        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: "0.65rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "text.secondary",
              mb: 1,
            }}
          >
            Scores Algorithme
          </Typography>
          <Stack spacing={0.75}>
            {[
              { label: "Meta relevance", value: rec.metaRelevanceScore, color: "#a855f7" },
              { label: "Hype", value: rec.hypeScore, color: "#f43f5e" },
              { label: "Price efficiency", value: rec.priceEfficiencyScore, color: "#06b6d4" },
              { label: "Overall", value: rec.overallScore, color: "var(--rpb-primary)" },
            ].map((s) => (
              <Stack key={s.label} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Typography
                  sx={{ fontSize: "0.72rem", color: "text.secondary", width: 110, flexShrink: 0 }}
                >
                  {s.label}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={s.value * 100}
                  sx={{
                    flex: 1,
                    height: 5,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.04)",
                    "& .MuiLinearProgress-bar": { bgcolor: s.color },
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    width: 32,
                    textAlign: "right",
                    color: s.color,
                  }}
                >
                  {Math.round(s.value * 100)}%
                </Typography>
              </Stack>
            ))}
          </Stack>
          {rec.classifications.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1 }}>
              {rec.classifications.map((c) => (
                <Chip
                  key={c}
                  size="small"
                  label={c}
                  sx={{
                    height: 18,
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    bgcolor: "rgba(255,255,255,0.06)",
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Offers list */}
      <Typography
        sx={{
          fontSize: "0.65rem",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: "text.secondary",
          mb: 1,
        }}
      >
        Offres ({group.offers.length} boutiques)
      </Typography>
      <Stack spacing={1} sx={{ mb: 3 }}>
        {group.offers.map((o, i) => (
          <Box
            component={motion.div}
            key={`${o.domain}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.03 }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: 3,
              border: "1px solid",
              borderColor: i === 0 ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.05)",
              bgcolor: i === 0 ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.01)",
              transition: "all 0.2s",
              "&:hover": {
                borderColor: i === 0 ? "#22c55e" : "rgba(255,255,255,0.15)",
                transform: "translateX(3px)",
              },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                <MuiLink
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    color: "text.primary",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    "&:hover": { color: "var(--rpb-primary)" },
                  }}
                >
                  {o.shop}
                  <OpenInNew sx={{ fontSize: 11, opacity: 0.6 }} />
                </MuiLink>
                {i === 0 && (
                  <Chip
                    size="small"
                    label="BEST PRICE"
                    sx={{
                      height: 14,
                      fontSize: "0.5rem",
                      fontWeight: 900,
                      bgcolor: "#22c55e",
                      color: "#fff",
                      px: 0.5,
                    }}
                  />
                )}
              </Stack>
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  {REGION_LABEL[o.region] ?? o.region}
                </Typography>
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    bgcolor: o.available ? "#22c55e" : "#f59e0b",
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  {o.available ? "En stock" : "Incertain"}
                </Typography>
              </Stack>
            </Box>

            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: "0.95rem",
                  color: i === 0 ? "#22c55e" : "text.primary",
                  lineHeight: 1.2,
                }}
              >
                {fmtEur(o.priceEur)}
              </Typography>
              {o.currency !== "EUR" && (
                <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  {fmtNative(o.price, o.currency)}
                </Typography>
              )}
              {i > 0 &&
                group.cheapestEur != null &&
                o.priceEur != null &&
                o.priceEur > group.cheapestEur && (
                  <Typography sx={{ fontSize: "0.62rem", color: "#f87171" }}>
                    +{fmtEur(o.priceEur - group.cheapestEur)}
                  </Typography>
                )}
            </Box>
          </Box>
        ))}
      </Stack>

      {/* Parts meta-analysis */}
      {rec && rec.includedParts.length > 0 && (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", pt: 2.5 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1.5 }}>
            <Shield sx={{ fontSize: 14, color: "#a855f7" }} />
            <Typography
              sx={{
                fontSize: "0.65rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "text.secondary",
              }}
            >
              Parts Meta-Analysis
            </Typography>
          </Stack>
          <Stack spacing={1.25}>
            {rec.includedParts.map((part) => (
              <Box
                key={part.id}
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 0.75 }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", lineHeight: 1.2 }}>
                      {part.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.62rem",
                        color: "text.secondary",
                        textTransform: "capitalize",
                      }}
                    >
                      {part.type}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`Tier ${part.tier}`}
                    sx={{
                      height: 18,
                      fontSize: "0.58rem",
                      fontWeight: 900,
                      bgcolor: TIER_BG[part.tier] ?? "rgba(255,255,255,0.08)",
                      color: TIER_COLOR[part.tier] ?? "#d1d5db",
                      border: "none",
                    }}
                  />
                </Stack>
                <Stack direction="row" sx={{ gap: 2, mb: 0.5 }}>
                  <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                    Usage:{" "}
                    <Box component="strong" sx={{ color: "text.primary" }}>
                      {part.usageCount}
                    </Box>
                  </Typography>
                  <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                    Score:{" "}
                    <Box component="strong" sx={{ color: "text.primary" }}>
                      {Math.round(part.metaScore * 100)}%
                    </Box>
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={part.normalizedUsage * 100}
                  sx={{
                    height: 3,
                    borderRadius: 1.5,
                    bgcolor: "rgba(255,255,255,0.04)",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: TIER_COLOR[part.tier] ?? "#9ca3af",
                    },
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
