import { type Metadata } from "next";
import { TeamsDirectory } from "@/components/teams/TeamsDirectory";
import { createPageMetadata } from "@/lib/seo-utils";
import { getTeamsLeaderboard, listTeams } from "@/server/dal/teams";

export const metadata: Metadata = createPageMetadata({
  title: "Équipes & Clans Beyblade — RPBey",
  description:
    "Annuaire des équipes et clans Beyblade de la communauté RPBey : rosters, classements, points et recrutement. Rejoins un clan ou crée le tien.",
  path: "/equipes",
});

export default async function EquipesPage() {
  const [initialList, leaderboard] = await Promise.all([
    listTeams({ page: 1, pageSize: 24, sort: "points" }),
    getTeamsLeaderboard(20),
  ]);

  return <TeamsDirectory initialList={initialList} leaderboard={leaderboard} />;
}
