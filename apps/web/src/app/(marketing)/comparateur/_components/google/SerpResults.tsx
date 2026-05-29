"use client";

import { Language, Person, ShoppingBag, SportsScore, TravelExplore } from "@mui/icons-material";
import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import type { GlobalSearchItem, SearchCategory } from "@rpbey/api-contract";
import { LINK_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY } from "./tokens";

// Icone par categorie (fallback si pas de favicon)
function CategoryIcon({ category }: { category: SearchCategory }) {
  const sx = { fontSize: 20, color: TEXT_TERTIARY };
  switch (category) {
    case "product":
      return <ShoppingBag sx={sx} />;
    case "part":
      return <TravelExplore sx={sx} />;
    case "tournament":
      return <SportsScore sx={sx} />;
    case "blader":
      return <Person sx={sx} />;
    default:
      return <Language sx={sx} />;
  }
}

// Extrait le nom de domaine d'une URL pour l'afficher en breadcrumb
function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Badge couleur selon tier meta ou categorie
function badgeColor(badge: string): string {
  if (badge === "S") return "#f59e0b";
  if (badge === "A") return "#22c55e";
  if (badge === "B") return "#3b82f6";
  if (badge === "C") return "#6b7280";
  return "var(--rpb-primary)";
}

interface SerpResultsProps {
  items: GlobalSearchItem[];
  query: string;
}

export function SerpResults({ items, query }: SerpResultsProps) {
  if (items.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography sx={{ color: TEXT_TERTIARY, fontSize: "0.95rem" }}>
          Aucun resultat pour &quot;{query}&quot;
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {items.map((item) => {
        const hasDomain = item.url.startsWith("http");
        const domain = hasDomain ? domainFrom(item.url) : null;
        const faviconSrc = domain
          ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
          : null;

        return (
          <Box
            component="li"
            key={item.id}
            sx={{
              py: 2.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              "&:last-child": { borderBottom: "none" },
            }}
          >
            {/* Ligne site : favicon + nom + URL */}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  bgcolor: "var(--rpb-surface-main, #303134)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {faviconSrc ? (
                  <Box
                    component="img"
                    src={faviconSrc}
                    alt=""
                    width={16}
                    height={16}
                    sx={{ width: 16, height: 16, display: "block" }}
                  />
                ) : (
                  <CategoryIcon category={item.category} />
                )}
              </Box>
              <Box>
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    color: TEXT_PRIMARY,
                    display: "block",
                  }}
                >
                  {domain ?? item.subtitle}
                </Typography>
                {domain && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.72rem",
                      color: TEXT_SECONDARY,
                      display: "block",
                    }}
                  >
                    {item.url.length > 60 ? `${item.url.slice(0, 60)}...` : item.url}
                  </Typography>
                )}
              </Box>
            </Stack>

            {/* Titre lien bleu */}
            <MuiLink
              href={item.url || "#"}
              target={item.url.startsWith("http") ? "_blank" : undefined}
              rel={item.url.startsWith("http") ? "noopener noreferrer" : undefined}
              sx={{
                display: "block",
                fontSize: "1.1rem",
                fontWeight: 400,
                color: LINK_BLUE,
                textDecoration: "none",
                lineHeight: 1.3,
                mb: 0.5,
                "&:hover": { textDecoration: "underline" },
                "&:visited": { color: "var(--rpb-link-visited, #c58af9)" },
              }}
            >
              {item.title}
            </MuiLink>

            {/* Snippet */}
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: TEXT_SECONDARY,
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.details ?? item.subtitle}
            </Typography>

            {/* Badge prix / tier */}
            {item.badge && (
              <Chip
                label={item.price != null ? `${item.price.toFixed(2)} EUR` : item.badge}
                size="small"
                sx={{
                  mt: 1,
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: badgeColor(item.badge),
                  bgcolor: `color-mix(in srgb, ${badgeColor(item.badge)} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${badgeColor(item.badge)} 25%, transparent)`,
                  "& .MuiChip-label": { px: 1 },
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
