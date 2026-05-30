import { EmojiEvents, OpenInNew } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { type Product, type WithContext } from "schema-dts";
import { JsonLd } from "@/components/seo/JsonLd";
import NextLink from "@/components/ui/NextLink";
import ProductIntel from "@/app/(marketing)/comparateur/_components/ProductIntel";
import { type BxProductGroup, computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import {
  createPageMetadata,
  generateBreadcrumbJsonLd,
  baseUrl,
  getAbsoluteImageUrl,
} from "@/lib/seo-utils";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = true;

const REGION_LABEL: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  UK: "Royaume-Uni",
  EU: "Europe",
  US: "USA",
  JP: "Japon",
  INT: "International",
};
const REGION_FLAG: Record<string, string> = {
  FR: "🇫🇷",
  BE: "🇧🇪",
  CH: "🇨🇭",
  UK: "🇬🇧",
  EU: "🇪🇺",
  US: "🇺🇸",
  JP: "🇯🇵",
  INT: "🌍",
};
const MEDAL = ["#FFD700", "#C0C0C0", "#CD7F32"];

const eur = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(v);
const native = (v: number | null | undefined, c: string) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: c === "?" ? "EUR" : c,
        maximumFractionDigits: c === "JPY" ? 0 : 2,
      }).format(v);

async function findGroup(slug: string): Promise<BxProductGroup | null> {
  const catalog = await loadCatalog();
  if (!catalog) return null;
  return computeGroups(catalog).find((g) => groupSlug(g) === slug) ?? null;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const catalog = await loadCatalog();
  if (!catalog) return [];
  return computeGroups(catalog).map((g) => ({ slug: groupSlug(g) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await findGroup(slug);
  if (!g)
    return createPageMetadata({
      title: "Produit introuvable | RPB",
      description: "",
      path: `/comparateur/${slug}`,
    });
  const price = g.cheapestEur != null ? ` dès ${eur(g.cheapestEur)}` : "";
  return createPageMetadata({
    title: `Acheter ${g.name}${g.code ? ` (${g.code})` : ""} au meilleur prix${price} | Beyblade X — RPB`,
    description: `Comparez le prix de ${g.name}${g.code ? ` (${g.code})` : ""} sur ${g.shopCount} boutiques Beyblade X (France, Europe, UK, USA, Japon).${price ? ` Meilleur prix${price}.` : ""} Trouvez où l'acheter au meilleur tarif.`,
    path: `/comparateur/${slug}`,
    image: g.cheapest?.image ?? undefined,
  });
}

export default async function ProductComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await findGroup(slug);
  if (!g) notFound();

  const prices = g.offers.map((o) => o.priceEur).filter((n): n is number => n != null);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const savePct =
    low != null && high != null && high > low ? Math.round((1 - low / high) * 100) : 0;

  const currentYear = new Date().getFullYear();
  const priceValidUntil = `${currentYear + 1}-12-31`;

  const productLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: g.name,
    ...(g.code ? { sku: g.code, mpn: g.code } : {}),
    category: "Beyblade X",
    brand: { "@type": "Brand", name: "Takara Tomy" },
    image: getAbsoluteImageUrl(g.cheapest?.image),
    url: `${baseUrl}/comparateur/${slug}`,
    description: `${g.name}${g.code ? ` (${g.code})` : ""} — toupie Beyblade X. Comparez les prix sur ${g.shopCount} boutiques.`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      ...(low != null ? { lowPrice: low } : {}),
      ...(high != null ? { highPrice: high } : {}),
      offerCount: g.offers.length,
      offers: g.offers.slice(0, 30).map((o) => ({
        "@type": "Offer",
        url: o.url,
        ...(o.priceEur != null ? { price: o.priceEur, priceCurrency: "EUR" } : {}),
        availability: o.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        priceValidUntil,
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: o.shop },
      })),
    },
  };

  const accent = "var(--rpb-primary)";
  const accent2 = "var(--rpb-secondary)";

  return (
    <Box
      className="bbx-scanlines"
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          height: "60vh",
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(var(--rpb-primary-rgb),0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, position: "relative" }}>
        <JsonLd
          data={generateBreadcrumbJsonLd([
            { name: "Accueil", item: "/" },
            { name: "Comparateur Beyblade X", item: "/comparateur" },
            { name: g.name, item: `/comparateur/${slug}` },
          ])}
        />
        <JsonLd data={productLd} />

        <MuiLink
          component={NextLink}
          href="/comparateur"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "text.secondary",
            textDecoration: "none",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            "&:hover": {
              color: accent,
              transform: "translateX(-4px)",
            },
          }}
        >
          ← Retour au comparateur
        </MuiLink>

        {/* HERO — frame "champion" métallique */}
        <Box
          sx={{
            mt: 2,
            p: { xs: 3, md: 5 },
            borderRadius: 5,
            position: "relative",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--rpb-primary) 8%, transparent), color-mix(in srgb, var(--rpb-secondary) 6%, transparent))",
            boxShadow: "0 10px 40px -15px rgba(0,0,0,0.3)",
            "&::after": {
              content: '""',
              position: "absolute",
              top: -80,
              right: -80,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: `conic-gradient(from 0deg, ${accent}, ${accent2}, ${accent})`,
              filter: "blur(70px)",
              opacity: 0.35,
            },
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={4}
            sx={{ position: "relative", alignItems: { md: "center" } }}
          >
            {g.cheapest?.image && (
              <Box
                sx={{
                  flexShrink: 0,
                  width: { xs: 140, md: 180 },
                  height: { xs: 140, md: 180 },
                  borderRadius: 4,
                  overflow: "hidden",
                  bgcolor: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.4)",
                  alignSelf: { xs: "center", md: "flex-start" },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 1.5,
                }}
              >
                <Box
                  component="img"
                  src={g.cheapest.image}
                  alt={g.name}
                  fetchPriority="high"
                  width={180}
                  height={180}
                  sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  label="BEYBLADE X"
                  sx={{
                    fontWeight: 900,
                    fontSize: "0.62rem",
                    letterSpacing: 1.2,
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 18%, transparent)",
                    color: accent,
                  }}
                />
                {g.code && (
                  <Chip size="small" label={g.code} sx={{ fontWeight: 800, fontSize: "0.65rem" }} />
                )}
              </Stack>
              <Typography
                component="h1"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "1.8rem", md: "2.6rem" },
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  mb: 2,
                }}
              >
                Acheter {g.name}
                <br />
                <Box
                  component="span"
                  sx={{
                    background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  au meilleur prix
                </Box>
              </Typography>

              {low != null && (
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 2, flexWrap: "wrap", mb: 3 }}
                >
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: 1.2,
                        fontWeight: 800,
                        fontSize: "0.6rem",
                        display: "block",
                        mb: 0.25,
                      }}
                    >
                      Meilleur prix
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 900,
                        fontSize: { xs: "2.2rem", md: "2.8rem" },
                        lineHeight: 1,
                        color: "#22c55e",
                      }}
                    >
                      {eur(low)}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    {g.cheapest && (
                      <Typography
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.92rem",
                          fontWeight: 500,
                        }}
                      >
                        chez{" "}
                        <strong style={{ color: "var(--mui-palette-text-primary)" }}>
                          {g.cheapest.shop}
                        </strong>{" "}
                        {REGION_FLAG[g.cheapest.region] ?? ""}
                      </Typography>
                    )}
                    {savePct > 0 && (
                      <Chip
                        size="small"
                        label={`économisez ${savePct}%`}
                        sx={{
                          mt: 0.5,
                          fontWeight: 900,
                          fontSize: "0.68rem",
                          bgcolor: "rgba(34,197,94,0.12)",
                          color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.3)",
                        }}
                      />
                    )}
                  </Box>
                </Stack>
              )}

              {/* Barre de spread min → max */}
              {low != null && high != null && high > low && (
                <Box sx={{ mt: 3, maxWidth: 460 }}>
                  <Box
                    sx={{
                      position: "relative",
                      height: 6,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, #22c55e, ${accent2}, #ef4444)`,
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        left: 0,
                        top: -4,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        bgcolor: "#22c55e",
                        border: "3px solid #1c1c1e",
                        boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                        transform: "translateX(-50%)",
                      }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        right: 0,
                        top: -4,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        bgcolor: "#ef4444",
                        border: "3px solid #1c1c1e",
                        boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                        transform: "translateX(50%)",
                      }}
                    />
                  </Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#22c55e",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                      }}
                    >
                      min {eur(low)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {g.shopCount} boutiques
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#ef4444",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                      }}
                    >
                      max {eur(high)}
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Box>
          </Stack>
        </Box>

        {/* OFFRES — podium médaillé */}
        <Typography variant="h6" sx={{ fontWeight: 900, mt: 5, mb: 2, letterSpacing: "-0.01em" }}>
          Toutes les offres ({g.offers.length})
        </Typography>
        <Stack spacing={1.5}>
          {g.offers.map((o, i) => {
            const medal = MEDAL[i];
            return (
              <Box
                key={`${o.domain}-${i}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 1.5, md: 3 },
                  p: { xs: 1.5, md: 2.25 },
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: i === 0 ? "rgba(34,197,94,0.45)" : "divider",
                  background:
                    i === 0
                      ? "rgba(34,197,94,0.06)"
                      : "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                  boxShadow: i === 0 ? "0 4px 20px -5px rgba(34,197,94,0.12)" : "none",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  "&:hover": {
                    transform: "translateX(6px)",
                    borderColor: i === 0 ? "#22c55e" : accent,
                    boxShadow:
                      i === 0
                        ? "0 6px 24px -4px rgba(34,197,94,0.2)"
                        : `0 6px 20px -5px color-mix(in srgb, var(--rpb-primary) 15%, transparent)`,
                  },
                }}
              >
                <Box sx={{ width: 36, textAlign: "center", flexShrink: 0 }}>
                  {medal ? (
                    <EmojiEvents
                      sx={{
                        color: medal,
                        fontSize: 28,
                        filter: `drop-shadow(0 0 5px ${medal}60)`,
                      }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        fontWeight: 800,
                        color: "text.secondary",
                        fontSize: "0.85rem",
                      }}
                    >
                      #{i + 1}
                    </Typography>
                  )}
                </Box>
                <Avatar
                  src={o.image ?? undefined}
                  alt={o.shop}
                  variant="rounded"
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    flexShrink: 0,
                    display: { xs: "none", sm: "flex" },
                  }}
                >
                  {o.shop.slice(0, 2)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.25 }}>
                    <Typography
                      noWrap
                      sx={{
                        fontWeight: i === 0 ? 800 : 700,
                        fontSize: "0.95rem",
                      }}
                    >
                      {o.shop}
                    </Typography>
                    {i === 0 && (
                      <Chip
                        size="small"
                        label="MEILLEUR PRIX"
                        sx={{
                          height: 16,
                          fontSize: "0.55rem",
                          fontWeight: 900,
                          bgcolor: "#22c55e",
                          color: "#fff",
                          boxShadow: "0 2px 6px rgba(34,197,94,0.3)",
                          px: 0.5,
                        }}
                      />
                    )}
                  </Stack>
                  <Chip
                    size="small"
                    label={`${REGION_FLAG[o.region] ?? ""} ${REGION_LABEL[o.region] ?? o.region}`}
                    sx={{
                      height: 18,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      bgcolor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "text.secondary",
                    }}
                  />
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: "1.1rem", md: "1.3rem" },
                      color: i === 0 ? "#22c55e" : "text.primary",
                      lineHeight: 1,
                    }}
                  >
                    {eur(o.priceEur)}
                  </Typography>
                  {o.currency !== "EUR" && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.72rem",
                        display: "block",
                        mt: 0.25,
                      }}
                    >
                      {native(o.price, o.currency)}
                    </Typography>
                  )}
                </Box>
                <Button
                  component={MuiLink}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  variant={i === 0 ? "contained" : "outlined"}
                  size="small"
                  endIcon={<OpenInNew sx={{ fontSize: "14px !important" }} />}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 2.5,
                    textTransform: "none",
                    fontWeight: 800,
                    px: 2,
                    py: 0.75,
                    transition: "all 0.2s ease-in-out",
                    ...(i === 0
                      ? {
                          background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                          color: "#fff",
                          boxShadow: `0 4px 14px color-mix(in srgb, var(--rpb-primary) 35%, rgba(0,0,0,0.2))`,
                          "&:hover": {
                            boxShadow: `0 6px 20px color-mix(in srgb, var(--rpb-primary) 50%, rgba(0,0,0,0.3))`,
                          },
                        }
                      : {
                          borderColor: "color-mix(in srgb, var(--rpb-primary) 30%, transparent)",
                          color: accent,
                          "&:hover": {
                            borderColor: accent,
                            bgcolor: "color-mix(in srgb, var(--rpb-primary) 4%, transparent)",
                          },
                        }),
                  }}
                >
                  Voir
                </Button>
              </Box>
            );
          })}
        </Stack>

        {/* Intel produit : tier méta, combos gagnants, buzz, produits similaires. */}
        <ProductIntel group={g} />

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
            mt: 3,
            opacity: 0.6,
          }}
        >
          Prix convertis en € à titre indicatif (taux approximatifs). Vérifiez le prix final sur la
          boutique. Liens marchands.
        </Typography>
      </Container>
    </Box>
  );
}
