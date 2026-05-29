import { LocalFireDepartment, Storefront } from "@mui/icons-material";
import { Box, Chip, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import { type Metadata } from "next";
import { type ItemList, type WithContext } from "schema-dts";
import { JsonLd } from "@/components/seo/JsonLd";
import NextLink from "@/components/ui/NextLink";
import { type BxProductGroup, computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { getRecommendations } from "@/lib/recommendation-engine";
import {
  createPageMetadata,
  generateBreadcrumbJsonLd,
  baseUrl,
  getAbsoluteImageUrl,
} from "@/lib/seo-utils";
import { ComparateurClient } from "./_components/ComparateurClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Comparateur de prix Beyblade X — toupies, lanceurs, stades | RPB",
  description:
    "Comparez les prix Beyblade X sur 100+ boutiques (France, Europe, UK, USA, Japon). Trouvez le meilleur prix pour chaque toupie, lanceur, ratchet, bit et stade. Mis à jour en continu.",
  path: "/comparateur",
});

const eur = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

function savePct(g: BxProductGroup): number {
  const ps = g.offers.map((o) => o.priceEur).filter((n): n is number => n != null);
  if (ps.length < 2) return 0;
  const lo = Math.min(...ps),
    hi = Math.max(...ps);
  return hi > lo ? Math.round((1 - lo / hi) * 100) : 0;
}

export default async function ComparateurPage() {
  const catalog = await loadCatalog();
  const groups: BxProductGroup[] = catalog ? computeGroups(catalog) : [];
  for (const g of groups) g.slug = groupSlug(g);

  const recommendations = await getRecommendations();

  const countries = catalog ? new Set(catalog.shops.map((s) => s.region)).size : 0;
  const topDeals = [...groups]
    .filter((g) => g.shopCount >= 3 && g.cheapestEur != null)
    .sort((a, b) => savePct(b) - savePct(a))
    .slice(0, 6);

  const itemList: WithContext<ItemList> | null =
    groups.length >= 3
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Comparateur de prix Beyblade X",
          numberOfItems: groups.length,
          itemListElement: groups.slice(0, 100).map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${baseUrl}/comparateur/${g.slug}`,
            name: g.name,
            image: getAbsoluteImageUrl(g.cheapest?.image),
          })),
        }
      : null;

  const accent = "var(--rpb-primary)";
  const accent2 = "var(--rpb-secondary)";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <JsonLd
        data={generateBreadcrumbJsonLd([
          { name: "Accueil", item: "/" },
          { name: "Comparateur Beyblade X", item: "/comparateur" },
        ])}
      />
      {itemList && <JsonLd data={itemList} />}

      {/* HERO */}
      <Box
        className="bbx-scanlines"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid",
          borderColor: "divider",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 80% at 50% -20%, rgba(var(--rpb-primary-rgb),0.22) 0%, transparent 65%)",
            pointerEvents: "none",
          },
        }}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, position: "relative" }}>
          <Chip
            size="small"
            label="100% BEYBLADE X · PRIX EN DIRECT"
            sx={{
              fontWeight: 900,
              fontSize: "0.62rem",
              letterSpacing: 1.5,
              mb: 2.5,
              bgcolor: "color-mix(in srgb, var(--rpb-primary) 12%, transparent)",
              color: accent,
              border: "1px solid color-mix(in srgb, var(--rpb-primary) 25%, transparent)",
              px: 0.5,
              textTransform: "uppercase",
              boxShadow: "0 0 20px rgba(var(--rpb-primary-rgb), 0.05)",
            }}
          />
          <Typography
            component="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: "2.2rem", md: "3.6rem" },
              lineHeight: { xs: 1.1, md: 1.0 },
              letterSpacing: "-0.04em",
              maxWidth: 900,
              textShadow: "0 2px 20px rgba(0,0,0,0.15)",
            }}
          >
            Le comparateur de prix{" "}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Beyblade X
            </Box>
          </Typography>
          <Typography
            sx={{
              color: "text.secondary",
              mt: 2,
              maxWidth: 720,
              fontSize: { xs: "0.95rem", md: "1.1rem" },
              lineHeight: 1.6,
            }}
          >
            Toupies, lanceurs, ratchets, bits et stades comparés sur 100+ boutiques — France,
            Europe, UK, USA, Japon. Trouve le meilleur prix, en direct.
          </Typography>
          {catalog && (
            <Stack
              direction="row"
              spacing={{ xs: 1.5, md: 2.5 }}
              sx={{ mt: 4, flexWrap: "wrap", rowGap: 1.5 }}
            >
              {[
                { n: catalog.productCount.toLocaleString("fr-FR"), l: "offres comparées" },
                { n: catalog.shopCount, l: "boutiques" },
                { n: groups.length, l: "produits" },
                { n: countries, l: "pays" },
              ].map((s) => (
                <Box
                  key={s.l}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "rgba(255, 255, 255, 0.01)",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
                    backdropFilter: "blur(8px)",
                    minWidth: { xs: 110, sm: 130 },
                    flexGrow: { xs: 1, sm: 0 },
                    boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.15)",
                    transition: "border-color 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    "&:hover": {
                      borderColor:
                        "color-mix(in srgb, var(--rpb-primary) 30%, var(--mui-palette-divider))",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: "1.4rem", md: "1.8rem" },
                      lineHeight: 1,
                      mb: 0.5,
                      background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {s.n}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontWeight: 800,
                      fontSize: "0.6rem",
                      display: "block",
                    }}
                  >
                    {s.l}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        {/* TOP DEALS */}
        {topDeals.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
              <LocalFireDepartment sx={{ color: accent2, fontSize: "1.6rem" }} />
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: "-0.01em" }}>
                Meilleurs deals du moment
              </Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2,1fr)",
                  sm: "repeat(3,1fr)",
                  md: "repeat(6,1fr)",
                },
                gap: 2,
              }}
            >
              {topDeals.map((g) => {
                const pct = savePct(g);
                return (
                  <MuiLink
                    key={g.slug}
                    component={NextLink}
                    href={`/comparateur/${g.slug}`}
                    sx={{
                      textDecoration: "none",
                      p: 2,
                      borderRadius: 4,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "surface.high",
                      backgroundImage:
                        "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      position: "relative",
                      overflow: "hidden",
                      "&:hover": {
                        transform: "translateY(-6px)",
                        borderColor: accent,
                        boxShadow: `0 12px 30px -4px color-mix(in srgb, var(--rpb-primary) 15%, rgba(0,0,0,0.3))`,
                        "& img": {
                          transform: "scale(1.08)",
                        },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        aspectRatio: "1",
                        borderRadius: 3,
                        bgcolor: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        mb: 0.5,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      {g.cheapest?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <Box
                          component="img"
                          src={g.cheapest.image}
                          alt={g.name}
                          loading="lazy"
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            padding: 1.5,
                            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                          }}
                        />
                      ) : (
                        <Storefront sx={{ color: "text.disabled", fontSize: 32 }} />
                      )}
                      {pct > 0 && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            bgcolor: "#22c55e",
                            color: "#fff",
                            fontSize: "0.62rem",
                            fontWeight: 900,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1.5,
                            boxShadow: "0 2px 10px rgba(34, 197, 94, 0.4)",
                            textTransform: "uppercase",
                          }}
                        >
                          -{pct}%
                        </Box>
                      )}
                    </Box>
                    <Typography
                      noWrap
                      sx={{ fontWeight: 800, fontSize: "0.85rem", color: "text.primary" }}
                    >
                      {g.name}
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{ alignItems: "baseline", justifyContent: "space-between", mt: "auto" }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color: "#22c55e",
                          fontSize: "1.05rem",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {eur(g.cheapestEur)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 500 }}
                      >
                        {g.shopCount} boutiques
                      </Typography>
                    </Stack>
                  </MuiLink>
                );
              })}
            </Box>
          </Box>
        )}

        {catalog ? (
          <ComparateurClient
            products={catalog.products}
            shops={catalog.shops}
            groups={groups}
            generatedAt={catalog.generatedAt}
            stats={catalog.stats}
            recommendations={recommendations}
          />
        ) : (
          <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
            Le catalogue n'est pas encore disponible.
          </Typography>
        )}
      </Container>
    </Box>
  );
}
