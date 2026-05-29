import { type Metadata } from "next";
import { Suspense } from "react";
import { computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { getRecommendations } from "@/lib/recommendation-engine";
import { createPageMetadata } from "@/lib/seo-utils";
import { ComparateurSearch } from "../_components/google/ComparateurSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Recherche Beyblade X — comparateur RPB",
  description:
    "Recherchez une toupie, une piece, un blader ou un tournoi Beyblade X. Comparateur de prix en temps reel sur 100+ boutiques.",
  path: "/comparateur/recherche",
});

export default async function RecherchePage() {
  const catalog = await loadCatalog();
  const groups = catalog ? computeGroups(catalog) : [];
  for (const g of groups) {
    g.slug = groupSlug(g);
  }

  const recommendations = await getRecommendations();

  return (
    // Suspense requis par useSearchParams() dans ComparateurSearch (Next 16 App Router)
    <Suspense fallback={null}>
      <ComparateurSearch groups={groups} recommendations={recommendations} />
    </Suspense>
  );
}
