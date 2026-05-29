import { type Metadata } from "next";
import { Suspense } from "react";
import { computeGroups, groupSlug, loadCatalog } from "@/lib/bx-catalog";
import { getRecommendations } from "@/server/services/recommend";
import { createPageMetadata } from "@/lib/seo-utils";
import { SearchClient } from "./_components/SearchClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Recherche Beyblade — le moteur de recherche RPB (toutes saisons)",
  description:
    "Le moteur de recherche Beyblade complet : toupies et beys de toutes les generations (Bakuten, Metal, Burst, X), pieces, combos, tournois, bladers, anime, lexique et boutiques.",
  path: "/search",
});

export default async function SearchPage() {
  const catalog = await loadCatalog();
  const groups = catalog ? computeGroups(catalog) : [];
  for (const g of groups) {
    g.slug = groupSlug(g);
  }

  const recommendations = await getRecommendations();

  return (
    // Suspense requis par useSearchParams() dans SearchClient (Next 16 App Router)
    <Suspense fallback={null}>
      <SearchClient groups={groups} recommendations={recommendations} />
    </Suspense>
  );
}
