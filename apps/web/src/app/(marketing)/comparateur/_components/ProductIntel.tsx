import { AutoAwesome, EmojiEvents, Forum, Whatshot } from "@mui/icons-material";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { TIER_COLOR, type Tier } from "@/lib/beyblade-entity";
import type { BxProductGroup } from "@/lib/bx-catalog";
import NextLink from "@/components/ui/NextLink";
import { getProductIntel } from "@/server/services/entity-graph";

/**
 * Section « intelligence produit » de la page `/comparateur/[slug]` — server
 * component qui réunit, via le graphe d'entités (`getProductIntel`), les faits
 * compétitifs jusque-là invisibles sur une fiche prix :
 *   - tier méta + score WBO + buzz communautaire de la blade,
 *   - meilleurs combos gagnants la contenant,
 *   - produits sémantiquement proches (voisins denses).
 * Best-effort : rend `null` si aucune intel n'est disponible (le reste de la fiche
 * — prix, offres — n'en dépend pas). Aucune dépendance aux composants de recherche.
 */

const eur = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 2,
        fontWeight: 900,
        fontSize: "1.05rem",
        color: "#fff",
        background: `linear-gradient(135deg, ${TIER_COLOR[tier]}, color-mix(in srgb, ${TIER_COLOR[tier]} 60%, #000))`,
        boxShadow: `0 4px 14px ${TIER_COLOR[tier]}55`,
        flexShrink: 0,
      }}
    >
      {tier}
    </Box>
  );
}

const sectionTitleSx = {
  fontWeight: 900,
  mt: 5,
  mb: 2,
  letterSpacing: "-0.01em",
  display: "flex",
  alignItems: "center",
  gap: 1,
} as const;

export default async function ProductIntel({ group }: { group: BxProductGroup }) {
  const intel = await getProductIntel(group);
  const hasMeta = intel.tier != null || intel.metaScore != null || intel.community != null;
  if (!hasMeta && intel.topCombos.length === 0 && intel.related.length === 0) return null;

  const accent = "var(--rpb-primary)";
  const accent2 = "var(--rpb-secondary)";

  return (
    <>
      {/* ── Carte compétitif & méta ───────────────────────────────────── */}
      {hasMeta && (
        <>
          <Typography variant="h6" sx={sectionTitleSx}>
            <AutoAwesome sx={{ fontSize: 22, color: accent }} />
            Analyse compétitive
            {intel.blade && (
              <Typography
                component="span"
                sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.9rem" }}
              >
                · {intel.blade}
              </Typography>
            )}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {intel.tier != null && (
              <Box
                sx={{
                  flex: 1,
                  minWidth: 150,
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <TierBadge tier={intel.tier} />
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.62rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontWeight: 800,
                      color: "text.secondary",
                    }}
                  >
                    Tier méta WBO
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: "1rem" }}>
                    {intel.tier}-tier
                    {intel.metaScore != null && (
                      <Box
                        component="span"
                        sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.82rem" }}
                      >
                        {" "}
                        · {intel.metaScore}/100
                      </Box>
                    )}
                  </Typography>
                </Box>
              </Box>
            )}
            {intel.community != null && intel.community.score > 0 && (
              <Box
                sx={{
                  flex: 1,
                  minWidth: 150,
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Whatshot sx={{ color: "#f59e0b", fontSize: 30, flexShrink: 0 }} />
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.62rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontWeight: 800,
                      color: "text.secondary",
                    }}
                  >
                    Buzz communauté
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: "1rem" }}>
                    {intel.community.score}/100
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                    {[
                      intel.community.xEngagement ? `${intel.community.xEngagement} likes X` : null,
                      intel.community.redditScore
                        ? `${intel.community.redditScore} pts Reddit`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Mentionnée par la communauté"}
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </>
      )}

      {/* ── Top combos gagnants ───────────────────────────────────────── */}
      {intel.topCombos.length > 0 && (
        <>
          <Typography variant="h6" sx={sectionTitleSx}>
            <EmojiEvents sx={{ fontSize: 22, color: "#FFD700" }} />
            Combos gagnants en tournoi
          </Typography>
          <Stack spacing={1}>
            {intel.topCombos.map((c) => (
              <Box
                key={c.label}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: { xs: 1.25, md: 1.75 },
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                }}
              >
                {c.tier && <TierBadge tier={c.tier} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
                    {c.label}
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                    score méta {c.combinedMetaScore}/100 · vu {c.count}×
                    {c.topPlayer ? ` · top: ${c.topPlayer}` : ""}
                  </Typography>
                </Box>
                {c.winCount > 0 && (
                  <Chip
                    size="small"
                    label={`${c.winCount} 🏆`}
                    sx={{
                      fontWeight: 900,
                      fontSize: "0.7rem",
                      bgcolor: "rgba(255,215,0,0.12)",
                      color: "#FFD700",
                      border: "1px solid rgba(255,215,0,0.3)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Box>
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", mt: 1, opacity: 0.6 }}
          >
            <Forum sx={{ fontSize: 12, verticalAlign: "middle", mr: 0.5 }} />
            Combinaisons issues des résultats de tournois WBO, enrichies du score méta.
          </Typography>
        </>
      )}

      {/* ── Produits similaires (voisins sémantiques) ─────────────────── */}
      {intel.related.length > 0 && (
        <>
          <Typography variant="h6" sx={sectionTitleSx}>
            <AutoAwesome sx={{ fontSize: 22, color: accent2 }} />
            Produits similaires
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(6, 1fr)",
              },
              gap: 1.5,
            }}
          >
            {intel.related.map((r) => (
              <Box
                key={r.slug}
                component={NextLink}
                href={`/comparateur/${r.slug}`}
                sx={{
                  p: 1.25,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: accent,
                    boxShadow:
                      "0 8px 24px -8px color-mix(in srgb, var(--rpb-primary) 25%, transparent)",
                  },
                }}
              >
                <Box
                  sx={{
                    aspectRatio: "1",
                    borderRadius: 2,
                    bgcolor: "rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0.5,
                    overflow: "hidden",
                  }}
                >
                  {r.imageUrl ? (
                    <Box
                      component="img"
                      src={r.imageUrl}
                      alt={r.name}
                      loading="lazy"
                      sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <Typography sx={{ fontSize: "1.4rem", opacity: 0.3 }}>🌀</Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.name}
                </Typography>
                {r.cheapestEur != null && (
                  <Typography
                    sx={{ fontWeight: 900, fontSize: "0.82rem", color: "#22c55e", mt: "auto" }}
                  >
                    {eur(r.cheapestEur)}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}
    </>
  );
}
