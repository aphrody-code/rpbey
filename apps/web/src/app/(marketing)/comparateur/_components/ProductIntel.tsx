import { AutoAwesome, EmojiEvents, Forum, MenuBook, Whatshot } from "@mui/icons-material";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { TIER_COLOR, type Tier } from "@/lib/beyblade-entity";
import type { BxProductGroup } from "@/lib/bx-catalog";
import NextLink from "@/components/ui/NextLink";
import { getProductIntel } from "@/server/services/entity-graph";

/**
 * Section « intelligence produit » de la page `/comparateur/[slug]` — server
 * component qui réunit, via le graphe d'entités (`getProductIntel`), les faits
 * compétitifs jusque-là invisibles sur une fiche prix :
 *   - fiche encyclopédique wiki (génération, type, système, JP, image, résumé),
 *   - tier méta + score WBO + buzz communautaire de la blade,
 *   - meilleurs combos gagnants la contenant,
 *   - produits sémantiquement proches (voisins denses + fallback même-blade).
 *
 * UI Material 3 expressive : en-têtes à pastille tonale, cartes `surface-container`
 * + bordure `outline-variant`, barres de score, mouvement ressort au survol.
 * Best-effort : rend `null` si aucune intel n'est disponible.
 */

// Mouvement « expressif » M3 (ressort léger au survol).
const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const CARD_SX = {
  borderRadius: 4,
  border: "1px solid",
  borderColor: "var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))",
  bgcolor: "var(--md-sys-color-surface-container, rgba(255,255,255,0.03))",
} as const;

const eur = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

const GEN_LABEL: Record<string, string> = {
  ORIGINAL: "Original",
  HMS: "HMS",
  METAL: "Metal",
  BURST: "Burst",
  X: "Beyblade X",
};

/** En-tête de section : pastille tonale + titre + complément optionnel. */
function SectionHeader({
  icon,
  title,
  accent,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, mt: 5, mb: 2 }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 2.5,
          flexShrink: 0,
          color: accent,
          bgcolor: `color-mix(in srgb, ${accent} 16%, transparent)`,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1.1, flex: 1 }}
      >
        {title}
      </Typography>
      {trailing}
    </Stack>
  );
}

/** Barre de score 0-100 (couleur paramétrable). */
function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <Box
      sx={{
        position: "relative",
        height: 6,
        mt: 0.75,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          width: `${Math.max(0, Math.min(100, value))}%`,
          borderRadius: 3,
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} 50%, transparent), ${color})`,
        }}
      />
    </Box>
  );
}

function TierBadge({ tier, size = 34 }: { tier: Tier; size?: number }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 2,
        fontWeight: 900,
        fontSize: size > 30 ? "1.05rem" : "0.85rem",
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

export default async function ProductIntel({ group }: { group: BxProductGroup }) {
  const intel = await getProductIntel(group);
  const hasMeta = intel.tier != null || intel.metaScore != null || intel.community != null;
  if (!hasMeta && intel.topCombos.length === 0 && intel.related.length === 0 && !intel.wiki)
    return null;

  const accent = "var(--rpb-primary)";
  const accent2 = "var(--rpb-secondary)";

  return (
    <>
      {/* ── Fiche encyclopédique (Beyblade Wiki) ──────────────────────── */}
      {intel.wiki && (intel.wiki.summary || intel.wiki.generation || intel.wiki.jpName) && (
        <>
          <SectionHeader
            icon={<MenuBook sx={{ fontSize: 20 }} />}
            title="Fiche encyclopédique"
            accent={accent2}
          />
          <Box sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
              {intel.wiki.imageUrl && (
                <Box
                  sx={{
                    width: { xs: "100%", sm: 132 },
                    flexShrink: 0,
                    aspectRatio: { xs: "16/9", sm: "1" },
                    borderRadius: 3,
                    overflow: "hidden",
                    bgcolor: "rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    component="img"
                    src={intel.wiki.imageUrl}
                    alt={intel.wiki.title}
                    loading="lazy"
                    sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </Box>
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mb: 1 }}>
                  {intel.wiki.generation && (
                    <Chip
                      size="small"
                      label={GEN_LABEL[intel.wiki.generation] ?? intel.wiki.generation}
                      sx={{
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        bgcolor: "color-mix(in srgb, var(--rpb-secondary) 18%, transparent)",
                        color: accent2,
                      }}
                    />
                  )}
                  {intel.wiki.beyType && (
                    <Chip
                      size="small"
                      label={intel.wiki.beyType}
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                    />
                  )}
                  {intel.wiki.system && (
                    <Chip
                      size="small"
                      label={intel.wiki.system}
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                    />
                  )}
                  {intel.wiki.jpName && (
                    <Chip
                      size="small"
                      label={intel.wiki.jpName}
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: "0.65rem", opacity: 0.85 }}
                    />
                  )}
                </Stack>
                {intel.wiki.summary && (
                  <Typography
                    sx={{ fontSize: "0.88rem", lineHeight: 1.55, color: "text.secondary" }}
                  >
                    {intel.wiki.summary}
                  </Typography>
                )}
                <Typography
                  component="a"
                  href={intel.wiki.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "inline-block",
                    mt: 1.25,
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    color: accent2,
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Lire sur le Beyblade Wiki →
                </Typography>
              </Box>
            </Stack>
          </Box>
        </>
      )}

      {/* ── Analyse compétitive & méta ────────────────────────────────── */}
      {hasMeta && (
        <>
          <SectionHeader
            icon={<AutoAwesome sx={{ fontSize: 20 }} />}
            title="Analyse compétitive"
            accent={accent}
            trailing={
              intel.blade ? (
                <Chip
                  size="small"
                  label={intel.blade}
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.68rem",
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 14%, transparent)",
                    color: accent,
                  }}
                />
              ) : undefined
            }
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {intel.tier != null && (
              <Box
                sx={{
                  ...CARD_SX,
                  flex: 1,
                  minWidth: 170,
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <TierBadge tier={intel.tier} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
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
                        {" · "}
                        {intel.metaScore}/100
                      </Box>
                    )}
                  </Typography>
                  {intel.metaScore != null && (
                    <ScoreBar value={intel.metaScore} color={TIER_COLOR[intel.tier]} />
                  )}
                </Box>
              </Box>
            )}
            {intel.community != null && intel.community.score > 0 && (
              <Box
                sx={{
                  ...CARD_SX,
                  flex: 1,
                  minWidth: 170,
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Whatshot sx={{ color: "#f59e0b", fontSize: 30, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
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
                  <Typography noWrap sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                    {[
                      intel.community.xEngagement ? `${intel.community.xEngagement} likes X` : null,
                      intel.community.redditScore
                        ? `${intel.community.redditScore} pts Reddit`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Mentionnée par la communauté"}
                  </Typography>
                  <ScoreBar value={intel.community.score} color="#f59e0b" />
                </Box>
              </Box>
            )}
          </Stack>
        </>
      )}

      {/* ── Top combos gagnants ───────────────────────────────────────── */}
      {intel.topCombos.length > 0 && (
        <>
          <SectionHeader
            icon={<EmojiEvents sx={{ fontSize: 20 }} />}
            title="Combos gagnants en tournoi"
            accent="#FFD700"
          />
          <Stack spacing={1}>
            {intel.topCombos.map((c, i) => (
              <Box
                key={c.label}
                sx={{
                  ...CARD_SX,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: { xs: 1.25, md: 1.75 },
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: "0.8rem",
                    color: "text.disabled",
                    width: 18,
                    flexShrink: 0,
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </Typography>
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
          <SectionHeader
            icon={<AutoAwesome sx={{ fontSize: 20 }} />}
            title="Produits similaires"
            accent={accent2}
          />
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
                  ...CARD_SX,
                  position: "relative",
                  p: 1.25,
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  transition: `transform 0.3s ${SPRING}, border-color 0.25s, box-shadow 0.25s`,
                  "&:hover": {
                    transform: "translateY(-5px)",
                    borderColor: accent,
                    boxShadow:
                      "0 10px 28px -10px color-mix(in srgb, var(--rpb-primary) 30%, transparent)",
                  },
                }}
              >
                {r.similarity > 0 && (
                  <Box
                    title={`${Math.round(r.similarity * 100)}% de similarité`}
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      px: 0.75,
                      height: 18,
                      borderRadius: 9,
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: "0.58rem",
                      fontWeight: 900,
                      color: accent,
                      bgcolor: "color-mix(in srgb, var(--rpb-primary) 18%, rgba(0,0,0,0.55))",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {Math.round(r.similarity * 100)}%
                  </Box>
                )}
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
