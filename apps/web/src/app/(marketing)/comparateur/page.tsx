import { Box, Container, Typography } from "@mui/material";
import { type Metadata } from "next";
import { type ItemList, type WithContext } from "schema-dts";
import { JsonLd } from "@/components/seo/JsonLd";
import { FrameBackdrop } from "@/components/ui/FrameBackdrop";
import { type BxProductGroup, computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { getRecommendations } from "@/server/services/recommend";
import {
  createPageMetadata,
  generateBreadcrumbJsonLd,
  baseUrl,
  getAbsoluteImageUrl,
} from "@/lib/seo-utils";
import { ComparateurClient } from "./_components/ComparateurClient";

export const metadata: Metadata = createPageMetadata({
  title: "Comparateur de prix Beyblade X — Bey, Launcher, Stadium, Blade, Ratchet, Bit | RPB",
  description:
    "Comparez les prix Beyblade X sur 100+ boutiques (France, Europe, UK, USA, Japon). Meilleur prix pour chaque Bey, Launcher, Stadium, Blade, Ratchet et Bit. Mis a jour en continu.",
  path: "/comparateur",
});

export default async function ComparateurPage() {
  const catalog = await loadCatalog();
  const groups: BxProductGroup[] = catalog ? computeGroups(catalog) : [];
  for (const g of groups) g.slug = groupSlug(g);

  const recommendations = await getRecommendations();

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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "transparent" }}>
      {/* Ambiance : toupies Beyblade X en fond (subtil — page data-dense). */}
      <FrameBackdrop series="beyblade-x" intensity={0.15} />
      <JsonLd
        data={generateBreadcrumbJsonLd([
          { name: "Accueil", item: "/" },
          { name: "Comparateur Beyblade X", item: "/comparateur" },
        ])}
      />
      {itemList && <JsonLd data={itemList} />}

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
        {/* Compact header — data first, no hero */}
        <Box sx={{ mb: 2.5 }}>
          <Typography
            component="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: "1.3rem", md: "1.7rem" },
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Comparateur prix{" "}
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Beyblade X
            </Box>
          </Typography>
          {catalog && (
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: 0.5 }}>
              {groups.length} produits · {catalog.shopCount} boutiques · France, Europe, UK, USA,
              Japon
            </Typography>
          )}
        </Box>

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
            Le catalogue n&apos;est pas encore disponible.
          </Typography>
        )}
      </Container>
    </Box>
  );
}
