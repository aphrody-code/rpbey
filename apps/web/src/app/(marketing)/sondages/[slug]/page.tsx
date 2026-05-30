import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { PollVote } from "@/components/polls/PollVote";
import { createPageMetadata } from "@/lib/seo-utils";
import { getPoll } from "@/server/dal/polls";
import { readVoter } from "@/server/api/voter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { poll } = await getPoll(slug, {});
  if (!poll) {
    return createPageMetadata({
      title: "Sondage introuvable — RPBey",
      description: "Ce sondage n'existe pas ou a été supprimé.",
      path: `/sondages/${slug}`,
    });
  }
  return createPageMetadata({
    title: `${poll.question} — Sondage RPBey`,
    description:
      poll.description ??
      `Vote dans le sondage « ${poll.question} » et découvre les résultats de la communauté Beyblade.`,
    path: `/sondages/${slug}`,
  });
}

export default async function PollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const voter = await readVoter();
  const { poll } = await getPoll(slug, voter);
  if (!poll) notFound();

  return <PollVote slug={slug} initialPoll={poll} />;
}
