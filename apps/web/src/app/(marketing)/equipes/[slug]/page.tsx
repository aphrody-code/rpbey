import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamDetailView } from "@/components/teams/TeamDetailView";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata, generateBreadcrumbJsonLd } from "@/lib/seo-utils";
import { getTeamBySlug } from "@/server/dal/teams";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { team } = await getTeamBySlug(slug);
  if (!team) {
    return createPageMetadata({
      title: "Équipe introuvable — RPBey",
      description: "Cette équipe n'existe pas ou a été dissoute.",
      path: `/equipes/${slug}`,
    });
  }

  const description =
    team.description?.slice(0, 200) ||
    `[${team.tag}] ${team.name} — ${team.memberCount} membre${
      team.memberCount > 1 ? "s" : ""
    }, ${team.totalPoints.toLocaleString("fr-FR")} points. Roster et statistiques de l'équipe Beyblade sur la RPBey.`;

  return createPageMetadata({
    title: `${team.name} [${team.tag}] — Équipe Beyblade RPBey`,
    description,
    path: `/equipes/${team.slug}`,
    image: team.logoUrl ?? team.bannerUrl ?? undefined,
    type: "profile",
  });
}

export default async function EquipeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { team } = await getTeamBySlug(slug);
  if (!team) notFound();

  return (
    <>
      <JsonLd
        data={generateBreadcrumbJsonLd([
          { name: "Équipes", item: "/equipes" },
          { name: team.name, item: `/equipes/${team.slug}` },
        ])}
      />
      <TeamDetailView team={team} />
    </>
  );
}
