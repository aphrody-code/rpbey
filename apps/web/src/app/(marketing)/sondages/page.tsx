import { type Metadata } from "next";
import { SondagesHub } from "@/components/polls/SondagesHub";
import { AWARDS_CATEGORY } from "@/components/polls/shared";
import { createPageMetadata } from "@/lib/seo-utils";
import { listPolls, listTierLists } from "@/server/dal/polls";

export const metadata: Metadata = createPageMetadata({
  title: "Sondages & Tier Lists Beyblade — RPBey",
  description:
    "Vote pour les Beyblade Awards France 2025, participe aux sondages de la communauté et compose tes tier lists : toupies, personnages et saisons. Le mot de la communauté Beyblade.",
  path: "/sondages",
});

export const dynamic = "force-dynamic";

export default async function SondagesPage() {
  const [awards, polls, tierLists] = await Promise.all([
    listPolls({ page: 1, pageSize: 100, category: AWARDS_CATEGORY }),
    listPolls({ page: 1, pageSize: 100 }),
    listTierLists({ page: 1, pageSize: 100 }),
  ]);

  // Les sondages « généraux » excluent les catégories d'awards (affichées à part).
  const generalPolls = polls.items.filter((p) => p.category !== AWARDS_CATEGORY);

  return <SondagesHub awards={awards.items} polls={generalPolls} tierLists={tierLists.items} />;
}
