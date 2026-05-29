import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getAnalyticsSummary } from "@/lib/analytics";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics temps réel",
  description: "Trafic en direct, pages vues, top pages, referrers et événements métier de la RPB.",
};

export default async function AdminAnalyticsPage() {
  await connection();

  const session = await requireAdmin();
  if (!session) {
    redirect("/sign-in?callbackUrl=/admin/analytics");
  }

  const initial = await getAnalyticsSummary();

  return <AnalyticsDashboard initial={initial} />;
}
