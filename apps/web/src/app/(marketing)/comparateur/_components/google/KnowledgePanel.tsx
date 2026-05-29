"use client";

import { OpenInNew, ShoppingCart, Storefront } from "@mui/icons-material";
import { Box, Button, Chip, Divider, Link as MuiLink, Stack, Typography } from "@mui/material";
import NextLink from "@/components/ui/NextLink";
import type { BxProductGroup, PartAnalysis, RecommendedProduct } from "../types";
import {
  BORDER,
  CHIP_BG,
  LINK_BLUE,
  PRICE_GOOD,
  SURFACE,
  SURFACE_SCRIM,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from "./tokens";

// Couleur de tier meta — valeurs sémantiques issues du design-system RPB
function tierColor(tier: "S" | "A" | "B" | "C"): string {
  if (tier === "S") return "#f59e0b";
  if (tier === "A") return "var(--rpb-price-good, #22c55e)";
  if (tier === "B") return "#3b82f6";
  return "#6b7280";
}

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

interface KnowledgePanelProps {
  group: BxProductGroup;
  reco: RecommendedProduct | null;
  related: BxProductGroup[];
}

export function KnowledgePanel({ group, reco, related }: KnowledgePanelProps) {
  const slug = group.slug ?? group.key;
  const minPrice = group.cheapestEur;
  const maxPrice =
    group.offers.reduce((m, o) => (o.priceEur != null && o.priceEur > m ? o.priceEur : m), 0) ||
    null;
  const image = group.cheapest?.image ?? null;

  const parts: PartAnalysis[] = reco?.includedParts ?? [];
  const tier = reco?.includedParts[0]?.tier ?? null;

  return (
    <Box
      sx={{
        bgcolor: SURFACE,
        borderRadius: 3,
        p: 2.5,
        border: "1px solid",
        borderColor: BORDER,
        position: "sticky",
        top: 80,
        maxHeight: "calc(100vh - 100px)",
        overflowY: "auto",
      }}
    >
      {/* Titre entite */}
      <Typography
        component="h2"
        sx={{
          fontSize: "1.35rem",
          fontWeight: 700,
          color: TEXT_PRIMARY,
          mb: 1.5,
          lineHeight: 1.2,
        }}
      >
        {group.name}
      </Typography>

      {/* Image produit */}
      {image ? (
        <Box
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            mb: 2,
            bgcolor: SURFACE_SCRIM,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 180,
          }}
        >
          {}
          <Box
            component="img"
            src={image}
            alt={group.name}
            loading="lazy"
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              p: 1,
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            borderRadius: 2,
            bgcolor: SURFACE_SCRIM,
            height: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <Storefront sx={{ fontSize: 40, color: TEXT_TERTIARY }} />
        </Box>
      )}

      {/* Fourchette de prix */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 0.75 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", color: PRICE_GOOD }}>
          {minPrice != null ? EUR.format(minPrice) : "—"}
        </Typography>
        {maxPrice != null && maxPrice !== minPrice && (
          <Typography sx={{ color: TEXT_SECONDARY, fontSize: "0.85rem" }}>
            a {EUR.format(maxPrice)}
          </Typography>
        )}
      </Stack>

      {/* Nb boutiques */}
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
        <Storefront sx={{ fontSize: 15, color: TEXT_TERTIARY }} />
        <Typography sx={{ fontSize: "0.82rem", color: TEXT_SECONDARY }}>
          {group.shopCount} boutique{group.shopCount > 1 ? "s" : ""}
        </Typography>
      </Stack>

      {/* Tier meta + score */}
      {tier && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <Chip
            label={`Tier ${tier}`}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: "0.72rem",
              height: 20,
              color: tierColor(tier),
              bgcolor: `color-mix(in srgb, ${tierColor(tier)} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tierColor(tier)} 30%, transparent)`,
              "& .MuiChip-label": { px: 1 },
            }}
          />
          {reco?.metaRelevanceScore != null && (
            <Typography sx={{ fontSize: "0.72rem", color: TEXT_TERTIARY }}>
              Score meta : {(reco.metaRelevanceScore * 100).toFixed(0)}/100
            </Typography>
          )}
        </Stack>
      )}

      {/* Pieces incluses */}
      {parts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: TEXT_TERTIARY,
              mb: 0.75,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Pieces incluses
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
            {parts.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  color: TEXT_SECONDARY,
                  bgcolor: CHIP_BG,
                  border: "1px solid",
                  borderColor: BORDER,
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* CTA Comparer */}
      <Button
        component={NextLink}
        href={`/comparateur/${slug}`}
        variant="contained"
        fullWidth
        startIcon={<ShoppingCart sx={{ fontSize: 16 }} />}
        sx={{
          bgcolor: "var(--rpb-primary)",
          color: "var(--rpb-primary-on-container, #fff)",
          fontWeight: 700,
          fontSize: "0.875rem",
          textTransform: "none",
          borderRadius: 2,
          py: 1,
          mb: 2,
          "&:hover": {
            bgcolor: "color-mix(in srgb, var(--rpb-primary) 85%, #000)",
          },
        }}
      >
        Comparer {group.shopCount} offre{group.shopCount > 1 ? "s" : ""}
      </Button>

      <Divider sx={{ borderColor: BORDER, mb: 2 }} />

      {/* Recherches associees */}
      {related.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: TEXT_TERTIARY,
              mb: 1,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Recherches associees
          </Typography>
          <Stack spacing={0.5}>
            {related.slice(0, 6).map((r) => (
              <MuiLink
                key={r.key}
                component={NextLink}
                href={`/comparateur/recherche?q=${encodeURIComponent(r.name)}`}
                sx={{
                  fontSize: "0.82rem",
                  color: LINK_BLUE,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                <OpenInNew sx={{ fontSize: 12, opacity: 0.6 }} />
                {r.name}
              </MuiLink>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
