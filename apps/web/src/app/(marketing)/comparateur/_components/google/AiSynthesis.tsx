"use client";

import * as React from "react";
import { AutoAwesome, Language } from "@mui/icons-material";
import { Box, Chip, Divider, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import type { BxProductGroup, RecommendedProduct } from "../types";
import { GoogleSearchField } from "./GoogleSearchField";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import {
  BORDER,
  CHIP_BG,
  GRADIENT_AI,
  LINK_BLUE,
  ON_GRADIENT,
  PRICE_GOOD,
  SURFACE,
  SURFACE_HOVER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from "./tokens";

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

// Extrait le nom de domaine court
function shortDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Chip de citation inline tracee vers une URL reelle du dataset
function CitationChip({ url, label }: { url: string; label: string }) {
  return (
    <MuiLink
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.4,
        px: 0.75,
        py: 0.1,
        ml: 0.5,
        borderRadius: "12px",
        bgcolor: `color-mix(in srgb, var(--rpb-primary) 12%, ${CHIP_BG})`,
        border: "1px solid color-mix(in srgb, var(--rpb-primary) 20%, transparent)",
        fontSize: "0.72rem",
        color: LINK_BLUE,
        textDecoration: "none",
        verticalAlign: "middle",
        lineHeight: 1.4,
        "&:hover": {
          bgcolor: `color-mix(in srgb, var(--rpb-primary) 20%, ${SURFACE_HOVER})`,
        },
      }}
    >
      {label}
    </MuiLink>
  );
}

// Carte source dans le panneau droite
function SourceCard({ url, title }: { url: string; title: string }) {
  const domain = shortDomain(url);
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  return (
    <MuiLink
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        p: 1.25,
        borderRadius: 2,
        bgcolor: SURFACE_HOVER,
        border: "1px solid",
        borderColor: BORDER,
        textDecoration: "none",
        mb: 1,
        "&:hover": { borderColor: "var(--rpb-primary)" },
        transition: "border-color 0.15s",
      }}
    >
      {}
      <Box
        component="img"
        src={faviconSrc}
        alt=""
        width={16}
        height={16}
        sx={{ width: 16, height: 16, mt: 0.25, flexShrink: 0 }}
      />
      <Box>
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 500,
            color: TEXT_PRIMARY,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.68rem", color: TEXT_TERTIARY, mt: 0.25 }}>
          {domain}
        </Typography>
      </Box>
    </MuiLink>
  );
}

interface AiSynthesisProps {
  query: string;
  group: BxProductGroup | null;
  reco: RecommendedProduct | null;
  suggestions: GlobalSearchItem[];
  onNewSearch: (v: string) => void;
}

/**
 * Rendu 100% algorithmique — aucun LLM.
 * Un gabarit deterministe assemble la reponse a partir des donnees du dataset.
 * Chaque assertion cite sa source reelle (offre boutique ou fiche produit).
 */
export function AiSynthesis({ query, group, reco, suggestions, onNewSearch }: AiSynthesisProps) {
  const [newQuery, setNewQuery] = React.useState("");

  // Calcul des donnees source une seule fois
  const minPrice = group?.cheapestEur ?? null;
  const maxPrice =
    group?.offers.reduce((m, o) => (o.priceEur != null && o.priceEur > m ? o.priceEur : m), 0) ??
    null;
  const cheapestOffer = group?.cheapest ?? null;
  const shopCount = group?.shopCount ?? 0;
  const parts = reco?.includedParts ?? [];
  const topReco = reco ?? null;

  // Sources deduites par domaine (offres boutiques uniques)
  const sourcesByDomain = React.useMemo(() => {
    if (!group) return [];
    const seen = new Set<string>();
    return group.offers
      .filter((o) => {
        if (!o.url || seen.has(o.domain)) return false;
        seen.add(o.domain);
        return true;
      })
      .slice(0, 8)
      .map((o) => ({ url: o.url, title: o.title, domain: o.domain }));
  }, [group]);

  if (!group) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography sx={{ color: TEXT_TERTIARY }}>
          Aucune synthese disponible pour &quot;{query}&quot;.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
      {/* Colonne principale — reponse algorithmique */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Bulle requete utilisateur */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
          <Chip
            label={query}
            sx={{
              bgcolor: SURFACE_HOVER,
              color: TEXT_PRIMARY,
              fontWeight: 500,
              fontSize: "0.9rem",
              height: "auto",
              py: 0.75,
              px: 0.5,
              borderRadius: "18px",
              border: "1px solid",
              borderColor: BORDER,
              "& .MuiChip-label": { px: 1.5 },
            }}
          />
        </Box>

        {/* Indicateur de reponse algorithmique */}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <Box
            sx={{
              width: 20,
              height: 20,
              background: GRADIENT_AI,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AutoAwesome sx={{ fontSize: 12, color: ON_GRADIENT }} />
          </Box>
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: TEXT_TERTIARY,
              fontStyle: "italic",
            }}
          >
            Synthese algorithmique — toutes les donnees sont tracees vers leur source.
          </Typography>
        </Stack>

        {/* Paragraphe d'introduction */}
        <Typography
          component="p"
          sx={{ fontSize: "1rem", color: TEXT_PRIMARY, lineHeight: 1.7, mb: 2 }}
        >
          <Box component="span" sx={{ fontWeight: 600 }}>
            {group.name}
          </Box>
          {group.code && (
            <Box component="span" sx={{ color: TEXT_SECONDARY }}>
              {" "}
              ({group.code})
            </Box>
          )}{" "}
          est disponible sur{" "}
          <Box component="span" sx={{ fontWeight: 600, color: TEXT_PRIMARY }}>
            {shopCount} boutique{shopCount > 1 ? "s" : ""}
          </Box>
          , a partir de{" "}
          <Box component="span" sx={{ fontWeight: 700, color: PRICE_GOOD }}>
            {minPrice != null ? EUR.format(minPrice) : "—"}
          </Box>
          {maxPrice != null && maxPrice !== minPrice && (
            <>
              {" "}
              jusqu&apos;a{" "}
              <Box component="span" sx={{ color: TEXT_SECONDARY }}>
                {EUR.format(maxPrice)}
              </Box>
            </>
          )}
          .
          {cheapestOffer && (
            <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
          )}
        </Typography>

        <Divider sx={{ borderColor: BORDER, my: 2 }} />

        {/* Section : Meilleur prix */}
        {cheapestOffer && (
          <Box sx={{ mb: 3 }}>
            <Typography
              component="h3"
              sx={{
                fontSize: "1rem",
                fontWeight: 700,
                color: TEXT_PRIMARY,
                mb: 1,
              }}
            >
              Meilleur prix
            </Typography>
            <Typography
              sx={{
                fontSize: "0.9rem",
                color: TEXT_SECONDARY,
                lineHeight: 1.6,
              }}
            >
              La meilleure offre actuellement est{" "}
              <MuiLink
                href={cheapestOffer.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: LINK_BLUE,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {shortDomain(cheapestOffer.url)}
              </MuiLink>{" "}
              a{" "}
              <Box component="span" sx={{ fontWeight: 700, color: PRICE_GOOD }}>
                {cheapestOffer.priceEur != null ? EUR.format(cheapestOffer.priceEur) : "—"}
              </Box>{" "}
              ({cheapestOffer.currency}).
              <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
            </Typography>
          </Box>
        )}

        {/* Section : Meta */}
        {topReco && topReco.includedParts.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              component="h3"
              sx={{
                fontSize: "1rem",
                fontWeight: 700,
                color: TEXT_PRIMARY,
                mb: 1,
              }}
            >
              Niveau meta
            </Typography>
            <Stack spacing={0.75}>
              {topReco.includedParts.slice(0, 3).map((p) => (
                <Typography
                  key={p.id}
                  component="p"
                  sx={{
                    fontSize: "0.9rem",
                    color: TEXT_SECONDARY,
                    lineHeight: 1.6,
                  }}
                >
                  <Box component="span" sx={{ fontWeight: 600, color: TEXT_PRIMARY }}>
                    {p.name}
                  </Box>{" "}
                  ({p.type}) — Tier{" "}
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {p.tier}
                  </Box>
                  , score {(p.metaScore * 100).toFixed(0)}/100.
                  <CitationChip
                    url="https://www.wbo.co.uk/forum/beyblades/beyblade-x"
                    label="WBO"
                  />
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* Section : Composition */}
        {parts.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              component="h3"
              sx={{
                fontSize: "1rem",
                fontWeight: 700,
                color: TEXT_PRIMARY,
                mb: 1,
              }}
            >
              Composition
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
              {parts.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.name} (${p.type})`}
                  size="small"
                  sx={{
                    height: "auto",
                    py: 0.4,
                    fontSize: "0.75rem",
                    color: TEXT_SECONDARY,
                    bgcolor: CHIP_BG,
                    border: "1px solid",
                    borderColor: BORDER,
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Section : Combo recommande */}
        {topReco && (
          <Box sx={{ mb: 3 }}>
            <Typography
              component="h3"
              sx={{
                fontSize: "1rem",
                fontWeight: 700,
                color: TEXT_PRIMARY,
                mb: 1,
              }}
            >
              Combo recommande
            </Typography>
            <Typography
              sx={{
                fontSize: "0.9rem",
                color: TEXT_SECONDARY,
                lineHeight: 1.6,
              }}
            >
              Score global :{" "}
              <Box component="span" sx={{ fontWeight: 700, color: TEXT_PRIMARY }}>
                {(topReco.overallScore * 100).toFixed(0)}/100
              </Box>{" "}
              (meta {(topReco.metaRelevanceScore * 100).toFixed(0)}, efficacite prix{" "}
              {(topReco.priceEfficiencyScore * 100).toFixed(0)}).
              {cheapestOffer && (
                <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
              )}
            </Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: BORDER, my: 3 }} />

        {/* Barre de relance */}
        <Box>
          <Typography sx={{ fontSize: "0.8rem", color: TEXT_TERTIARY, mb: 1.5 }}>
            Demander autre chose
          </Typography>
          <GoogleSearchField
            value={newQuery}
            suggestions={suggestions}
            aiMode
            maxWidth="100%"
            onChange={setNewQuery}
            onSubmit={(v) => {
              setNewQuery("");
              onNewSearch(v);
            }}
            onToggleAi={() => onNewSearch(newQuery)}
          />
        </Box>
      </Box>

      {/* Panneau sources (droite) */}
      <Box sx={{ width: 240, flexShrink: 0, display: { xs: "none", lg: "block" } }}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: SURFACE,
            border: "1px solid",
            borderColor: BORDER,
            borderRadius: 3,
            p: 2,
            position: "sticky",
            top: 80,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <Language sx={{ fontSize: 16, color: TEXT_TERTIARY }} />
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: TEXT_PRIMARY }}>
              {sourcesByDomain.length} source
              {sourcesByDomain.length > 1 ? "s" : ""}
            </Typography>
          </Stack>
          {sourcesByDomain.map((s) => (
            <SourceCard key={s.domain} url={s.url} title={s.title} />
          ))}
        </Paper>
      </Box>
    </Box>
  );
}
