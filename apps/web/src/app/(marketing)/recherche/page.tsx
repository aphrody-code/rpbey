import { type Metadata } from "next";
import { Suspense } from "react";
import { computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { getRecommendations } from "@/lib/recommendation-engine";
import { createPageMetadata } from "@/lib/seo-utils";
import { ComparateurSearch } from "../comparateur/_components/google/ComparateurSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Recherche Beyblade X — le moteur de recherche RPB",
  description:
    "Le moteur de recherche Beyblade : toupies, pieces, combos, tournois, bladers, anime, lexique et boutiques. Prix en temps reel sur 100+ boutiques.",
  path: "/recherche",
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
