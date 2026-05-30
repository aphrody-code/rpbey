import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { TierListBuilder } from "@/components/polls/TierListBuilder";
import { TIER_LIST_KIND_LABELS } from "@/components/polls/shared";
import { createPageMetadata } from "@/lib/seo-utils";
import { getTierList } from "@/server/dal/polls";
import { readVoter } from "@/server/api/voter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tierList } = await getTierList(slug, {});
  if (!tierList) {
    return createPageMetadata({
      title: "Tier list introuvable — RPBey",
      description: "Cette tier list n'existe pas ou a été supprimée.",
      path: `/sondages/tier-list/${slug}`,
    });
  }
  return createPageMetadata({
    title: `Tier List ${tierList.title} — RPBey`,
    description:
      tierList.description ??
      `Compose ta tier list « ${tierList.title} » (${TIER_LIST_KIND_LABELS[tierList.kind]}) et compare-la à la communauté Beyblade.`,
    path: `/sondages/tier-list/${slug}`,
  });
}

export default async function TierListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const voter = await readVoter();
  const { tierList } = await getTierList(slug, voter);
  if (!tierList) notFound();

  return <TierListBuilder slug={slug} initialTierList={tierList} />;
}
